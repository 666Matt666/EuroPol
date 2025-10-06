const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeSupervisor } = require('./auth');

// GET /api/facturas - Obtener todas las facturas
router.get('/', authenticateToken, async (req, res, next) => {
  const { role, empresa_id } = req.user;
  try {
    let queryParams = [];
    // Consulta principal sin agregación JSON para compatibilidad con H2
    const query = `
      SELECT 
        f.id,
        f.codigo_factura,
        f.status,
        f.fecha_vencimiento,
        f.created_at,
        f.total,
        f.cliente_empresa_id,
        f.notas,
        f.presupuesto_id,
        e.nombre AS cliente_nombre,
        u.email AS creador_email,
        pres.codigo_presupuesto
      FROM facturas f
      JOIN empresas e ON f.cliente_empresa_id = e.id
      JOIN usuarios u ON f.created_by_user_id = u.id
      LEFT JOIN presupuestos pres ON f.presupuesto_id = pres.id
      ${role === 'usuario' ? 'WHERE f.cliente_empresa_id = $1' : ''}
      ORDER BY f.created_at DESC
    `;

    if (role === 'usuario') {
      queryParams.push(empresa_id);
    }

    const { rows: facturas } = await db.query(query, queryParams);

    // Para cada factura, obtenemos sus ítems por separado.
    // Esto es menos eficiente que un JOIN con JSON_AGG, pero es compatible con H2 y PG.
    for (const factura of facturas) {
      const itemsQuery = `SELECT * FROM factura_items WHERE factura_id = $1`;
      const { rows: items } = await db.query(itemsQuery, [factura.id]);
      factura.items = items;
    }

    res.json(facturas);
  } catch (error) {
    next(error);
  }
});

// GET /api/facturas/:id - Obtener una factura específica con sus ítems
router.get('/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;

  try {
    const facturaQuery = `SELECT * FROM facturas WHERE id = $1;`;
    const facturaResult = await db.query(facturaQuery, [id]);

    if (facturaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    const factura = facturaResult.rows[0];

    const itemsQuery = `SELECT * FROM factura_items WHERE factura_id = $1 ORDER BY id;`;
    const itemsResult = await db.query(itemsQuery, [id]);

    factura.items = itemsResult.rows;

    res.json(factura);
  } catch (error) {
    next(error);
  }
});

// POST /api/facturas - Crear una nueva factura con sus ítems
router.post('/', [authenticateToken, authorizeSupervisor], async (req, res, next) => {
  const { cliente_empresa_id, presupuesto_id, codigo_presupuesto, fecha_vencimiento, notas, items, total } = req.body;
  const { userId: created_by_user_id } = req.user;

  if (!cliente_empresa_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o los ítems de la factura.' });
  }

  // La transacción se maneja de forma diferente para SQLite
  const isSqlite = (process.env.DB_TYPE === 'h2' || process.env.DB_TYPE === 'sqlite');
  try {
    if (!isSqlite) await db.query('BEGIN');

    const year = new Date().getFullYear();
    const prefix = `FAC-${year}-`;
    const lastCodeQuery = `SELECT codigo_factura FROM facturas WHERE codigo_factura LIKE $1 ORDER BY id DESC LIMIT 1`;
    const lastCodeResult = await db.query(lastCodeQuery, [`${prefix}%`]);
    
    let nextNumber = 1;
    if (lastCodeResult.rows.length > 0) {
      const lastNumber = parseInt(lastCodeResult.rows[0].codigo_factura.split('-')[2], 10);
      nextNumber = lastNumber + 1;
    }
    const codigo_factura = `${prefix}${String(nextNumber).padStart(4, '0')}`;

    const facturaQuery = `
      INSERT INTO facturas (codigo_factura, cliente_empresa_id, created_by_user_id, presupuesto_id, codigo_presupuesto, fecha_vencimiento, notas, total, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'emitida')
      RETURNING id;
    `;
    const facturaValues = [codigo_factura, cliente_empresa_id, created_by_user_id, presupuesto_id || null, codigo_presupuesto || null, fecha_vencimiento || null, notas || null, total];
    const facturaResult = await db.query(facturaQuery, facturaValues);
    const facturaId = facturaResult.rows[0].id;

    const itemInsertPromises = items.map(item => {
      const itemQuery = `
        INSERT INTO factura_items (factura_id, producto_id, cantidad, precio_unitario, descripcion_item)
        VALUES ($1, $2, $3, $4, $5);
      `;
      const itemValues = [facturaId, item.producto_id, item.cantidad, item.precio_unitario, item.descripcion_item || null];
      return db.query(itemQuery, itemValues);
    });

    await Promise.all(itemInsertPromises);

    if (!isSqlite) await db.query('COMMIT');

    res.status(201).json({ id: facturaId, message: 'Factura creada exitosamente.' });

  } catch (error) {
    if (!isSqlite) await db.query('ROLLBACK');
    console.error('Error al crear la factura:', error);
    next(error);
  }
});

// PUT /api/facturas/:id - Actualizar una factura existente
router.put('/:id', [authenticateToken, authorizeSupervisor], async (req, res, next) => {
  const { id } = req.params;
  const { cliente_empresa_id, presupuesto_id, fecha_vencimiento, notas, items, total, codigo_presupuesto } = req.body;

  if (!cliente_empresa_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o los ítems de la factura.' });
  }

  const isSqlite = (process.env.DB_TYPE === 'h2' || process.env.DB_TYPE === 'sqlite');
  try {
    if (!isSqlite) await db.query('BEGIN');

    const facturaQuery = `
      UPDATE facturas
      SET cliente_empresa_id = $1, fecha_vencimiento = $2, notas = $3, total = $4, codigo_presupuesto = $5, presupuesto_id = $6
      WHERE id = $7;
    `;
    await db.query(facturaQuery, [cliente_empresa_id, fecha_vencimiento || null, notas || null, total, codigo_presupuesto, presupuesto_id, id]);

    await db.query('DELETE FROM factura_items WHERE factura_id = $1', [id]);

    const itemInsertPromises = items.map(item => {
      const itemQuery = `INSERT INTO factura_items (factura_id, producto_id, cantidad, precio_unitario, descripcion_item) VALUES ($1, $2, $3, $4, $5);`;
      const itemValues = [id, item.producto_id, item.cantidad, item.precio_unitario, item.descripcion_item || null];
      return db.query(itemQuery, itemValues);
    });
    await Promise.all(itemInsertPromises);

    if (!isSqlite) await db.query('COMMIT');

    res.json({ id: parseInt(id, 10), message: 'Factura actualizada exitosamente.' });
  } catch (error) {
    if (!isSqlite) await db.query('ROLLBACK');
    next(error);
  }
});

// DELETE /api/facturas/:id - Eliminar una factura
router.delete('/:id', [authenticateToken, authorizeSupervisor], async (req, res, next) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM facturas WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
