const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');
const kafkaService = require('../kafkaService');

// GET /api/productos - Obtener productos (todos para admin/supervisor, solo los propios para usuarios)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { userId, role, empresaId } = req.user;
    let query;
    let values = [];

    if (role === 'administrador' || role === 'supervisor') {
      // Los supervisores ven todos los productos
      query = `SELECT 
        p.id, p.sku, p.nombre_producto, p.created_by_user_id, p.empresa_id, p.dibujo_id, p.ancho_cm, p.alto_cm, p.fuelle_cm, p.espesor_micrones, p.color,
        m.nombre as material, d.ruta_archivo_imagen,
        d.nombre as dibujo
      FROM productos_bolsas p
      JOIN materiales m ON p.material_id = m.id
      LEFT JOIN dibujos d ON p.dibujo_id = d.id ORDER BY p.id;`;
    } else {
      // Los usuarios estándar ven los productos generales (empresa_id IS NULL) o los de su propia empresa.
      query = `
        SELECT p.id, p.sku, p.nombre_producto, p.created_by_user_id, p.empresa_id, p.dibujo_id, p.ancho_cm, p.alto_cm, p.fuelle_cm, p.espesor_micrones, p.color,
               m.nombre as material, d.ruta_archivo_imagen, d.nombre as dibujo
        FROM productos_bolsas p
        JOIN materiales m ON p.material_id = m.id
        LEFT JOIN dibujos d ON p.dibujo_id = d.id
        WHERE 
          p.empresa_id IS NULL -- Productos generales
          OR p.empresa_id = $1 -- Productos de la empresa del usuario
        ORDER BY p.id;
      `;
      values.push(empresaId);
    }

    const { rows } = await db.query(query, values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/productos - Crear un nuevo producto
router.post('/', authenticateToken, async (req, res, next) => {
  const {
    sku, nombre_producto, material_id, dibujo_id, ancho_cm, alto_cm, fuelle_cm, espesor_micrones, color, empresa_id
  } = req.body;

  if (!nombre_producto || !material_id || ancho_cm == null || alto_cm == null) {
    return res.status(400).json({ error: 'Nombre, material, ancho y alto son obligatorios.' });
  }

  try {
    const { userId, role, empresaId: userEmpresaId } = req.user;
    let productEmpresaId = null;

    if (role === 'administrador' || role === 'supervisor') {
      // Admins/Supervisors pueden asignar un producto a una empresa, o dejarlo general (null).
      productEmpresaId = empresa_id || null;
    } else {
      // Los productos de usuarios estándar siempre se asignan a su propia empresa.
      productEmpresaId = userEmpresaId;
    }

    const query = `
      INSERT INTO productos_bolsas (sku, nombre_producto, material_id, dibujo_id, ancho_cm, alto_cm, fuelle_cm, espesor_micrones, color, created_by_user_id, empresa_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [sku, nombre_producto, material_id, dibujo_id || null, ancho_cm, alto_cm, fuelle_cm || null, espesor_micrones || null, color, userId, productEmpresaId];
    const { rows } = await db.query(query, values);
    
    // --- LOG DE CREACIÓN CON KAFKA ---
    await kafkaService.sendAuditLog('PRODUCT_CREATED', req.user, {
      productId: rows[0].id,
      productName: rows[0].nombre_producto,
    });
    res.status(201).json(rows[0]);
  } catch (error) {
    // --- LOG DE ERROR DETALLADO ---
    console.error('[ERROR] Fallo al crear el producto:', error);
    next(error);
  }
});

// PUT /api/productos/:id - Actualizar un producto
router.put('/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const {
    sku, nombre_producto, material_id, dibujo_id, ancho_cm, alto_cm, fuelle_cm, espesor_micrones, color, empresa_id
  } = req.body;

  if (!nombre_producto || !material_id || ancho_cm == null || alto_cm == null) {
    return res.status(400).json({ error: 'Nombre, material, ancho y alto son obligatorios.' });
  }

  try {
    const { userId: modifierId, role } = req.user;
    let query;
    let values;

    if (role === 'administrador' || role === 'supervisor') {
      query = `
        UPDATE productos_bolsas
        SET sku = $1, nombre_producto = $2, material_id = $3, dibujo_id = $4, ancho_cm = $5, alto_cm = $6, fuelle_cm = $7, espesor_micrones = $8, color = $9, empresa_id = $10, modified_by_user_id = $11
        WHERE id = $12
        RETURNING *;
      `;
      values = [sku, nombre_producto, material_id, dibujo_id || null, ancho_cm, alto_cm, fuelle_cm || null, espesor_micrones || null, color, empresa_id || null, modifierId, id];
    } else {
      query = `
        UPDATE productos_bolsas
        SET sku = $1, nombre_producto = $2, material_id = $3, dibujo_id = $4, ancho_cm = $5, alto_cm = $6, fuelle_cm = $7, espesor_micrones = $8, color = $9, modified_by_user_id = $10
        WHERE id = $11 AND created_by_user_id = $10
        RETURNING *;
      `;
      values = [sku, nombre_producto, material_id, dibujo_id || null, ancho_cm, alto_cm, fuelle_cm || null, espesor_micrones || null, color, modifierId, id];
    }

    const { rows } = await db.query(query, values);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado o no tienes permiso para editarlo.' });
    }

    // --- LOG DE MODIFICACIÓN CON KAFKA ---
    await kafkaService.sendAuditLog('PRODUCT_UPDATED', req.user, {
      productId: rows[0].id,
      productName: rows[0].nombre_producto,
    });
    res.json(rows[0]);
  } catch (error) {
    // --- LOG DE ERROR DETALLADO ---
    console.error('[ERROR] Fallo al actualizar el producto:', error);
    next(error);
  }
});

// DELETE /api/productos/:id - Eliminar un producto
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const { userId, role } = req.user;
    const query = (role === 'administrador' || role === 'supervisor')
      ? 'DELETE FROM productos_bolsas WHERE id = $1 RETURNING id, nombre_producto'
      : 'DELETE FROM productos_bolsas WHERE id = $1 AND created_by_user_id = $2 RETURNING id, nombre_producto';
    const values = (role === 'administrador' || role === 'supervisor') ? [id] : [id, userId];
    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado o no tienes permiso para eliminarlo.' });
    }

    // --- LOG DE ELIMINACIÓN CON KAFKA ---
    await kafkaService.sendAuditLog('PRODUCT_DELETED', req.user, {
      productId: result.rows[0].id,
      productName: result.rows[0].nombre_producto,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;