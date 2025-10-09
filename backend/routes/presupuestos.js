const express = require('express');
const router = express.Router();
const db = require('../db');
const { getAdminAndSupervisorEmails, sendNewQuoteForReviewAlert, getUsersFromCompany, sendQuoteApprovedAlert, sendQuoteModifiedAlert } = require('./emailService');
const { authenticateToken, authorizeSupervisor } = require('./auth');

// POST /api/presupuestos - Crear un nuevo presupuesto con sus ítems
router.post('/', authenticateToken, async (req, res, next) => {
  let { cliente_empresa_id, fecha_vencimiento, notas, items } = req.body;
  const { userId: created_by_user_id, role, empresa_id: user_empresa_id } = req.user;

  // Validación básica
  if (!cliente_empresa_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o los ítems del presupuesto.' });
  }

  // Si el usuario es un 'usuario' (operador), nos aseguramos de que el presupuesto se asigne a su propia empresa.
  if (role === 'usuario' && !cliente_empresa_id) {
    console.log(`[DEBUG] Operador (ID: ${created_by_user_id}) creando presupuesto. Forzando cliente_empresa_id a ${user_empresa_id}.`);
    cliente_empresa_id = user_empresa_id;
  } else {
    console.log(`[DEBUG] Supervisor/Admin (ID: ${created_by_user_id}) creando presupuesto para cliente_empresa_id: ${cliente_empresa_id}.`);
  }

  const isSqlite = (process.env.DB_TYPE === 'h2' || process.env.DB_TYPE === 'sqlite');
  try {
    if (!isSqlite) await db.query('BEGIN');

    // 1. Generar el código de presupuesto (ej: PRE-2024-0001)
    const year = new Date().getFullYear();
    const prefix = `PRE-${year}-`;
    // Buscamos el último presupuesto de este año para obtener el correlativo
    const lastCodeQuery = `SELECT codigo_presupuesto FROM presupuestos WHERE codigo_presupuesto LIKE $1 ORDER BY id DESC LIMIT 1`;
    const lastCodeResult = await db.query(lastCodeQuery, [`${prefix}%`]);
    
    let nextNumber = 1;
    if (lastCodeResult.rows.length > 0) {
      const lastNumber = parseInt(lastCodeResult.rows[0].codigo_presupuesto.split('-')[2], 10);
      nextNumber = lastNumber + 1;
    }
    // Formateamos el número a 4 dígitos con ceros a la izquierda
    const codigo_presupuesto = `${prefix}${String(nextNumber).padStart(4, '0')}`;

    // 2. Insertar el encabezado del presupuesto
    const presupuestoQuery = `
      INSERT INTO presupuestos (codigo_presupuesto, cliente_empresa_id, created_by_user_id, fecha_vencimiento, notas)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `;
    const presupuestoValues = [codigo_presupuesto, cliente_empresa_id, created_by_user_id, fecha_vencimiento || null, notas || null];
    const presupuestoResult = await db.query(presupuestoQuery, presupuestoValues);
    console.log(`[DEBUG] Presupuesto creado con ID: ${presupuestoResult.rows[0].id} para la empresa cliente ID: ${cliente_empresa_id}`);
    const presupuestoId = presupuestoResult.rows[0].id;

    // 3. Insertar cada ítem del presupuesto
    const itemInsertPromises = items.map(item => {
      const itemQuery = `
        INSERT INTO presupuesto_items (presupuesto_id, producto_id, cantidad, precio_unitario, descripcion_item)
        VALUES ($1, $2, $3, $4, $5);
      `;
      const itemValues = [presupuestoId, item.producto_id, item.cantidad, item.precio_unitario, item.descripcion_item || null];
      return db.query(itemQuery, itemValues);
    });

    await Promise.all(itemInsertPromises);

    // 4. Confirmar la transacción
    if (!isSqlite) await db.query('COMMIT');

    res.status(201).json({ id: presupuestoId, message: 'Presupuesto creado exitosamente.' });

  } catch (error) {
    if (!isSqlite) await db.query('ROLLBACK');
    console.error('Error al crear el presupuesto:', error);
    next(error);
  }
});

// GET /api/presupuestos - Obtener todos los presupuestos
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { role, empresaId } = req.user; // Corregido de empresa_id a empresaId
    let queryParams = [];
    // Consulta que une presupuestos con el nombre de la empresa cliente y el email del creador
    const query = `
      SELECT 
        p.id,
        p.codigo_presupuesto,
        p.status,
        p.notas,
        p.fecha_vencimiento,
        p.created_at,
        p.cliente_empresa_id,
        e.nombre AS cliente_nombre,
        u.email AS creador_email
      FROM presupuestos p
      LEFT JOIN empresas e ON p.cliente_empresa_id = e.id
      LEFT JOIN usuarios u ON p.created_by_user_id = u.id
      ${role === 'usuario' ? 'WHERE p.cliente_empresa_id = $1' : ''}
      ORDER BY p.created_at DESC
    `;

    console.log(`[DEBUG] Obteniendo presupuestos para rol: '${role}' con empresa ID: '${empresaId}'`);
    if (role === 'usuario') {
      queryParams.push(empresaId);
    }

    const { rows: presupuestos } = await db.query(query, queryParams);

    // Para cada presupuesto, obtenemos sus ítems por separado para máxima compatibilidad
    for (const presupuesto of presupuestos) {
      const itemsQuery = `SELECT * FROM presupuesto_items WHERE presupuesto_id = $1`;
      const { rows: items } = await db.query(itemsQuery, [presupuesto.id]);
      presupuesto.items = items;
    }

    console.log(`[DEBUG] Se encontraron ${presupuestos.length} presupuestos para el usuario.`);
    res.json(presupuestos);
  } catch (error) {
    console.error('[ERROR] Falló la obtención de presupuestos:', error);
    next(error);
  }
});

// GET /api/presupuestos/:id - Obtener un presupuesto específico con sus ítems
router.get('/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;

  try {
    // 1. Obtener el encabezado del presupuesto
    const presupuestoQuery = `
      SELECT 
        p.*
      FROM presupuestos p
      WHERE p.id = $1;
    `;
    const presupuestoResult = await db.query(presupuestoQuery, [id]);

    if (presupuestoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }

    const presupuesto = presupuestoResult.rows[0];

    // 2. Obtener los ítems del presupuesto
    const itemsQuery = `SELECT * FROM presupuesto_items WHERE presupuesto_id = $1 ORDER BY id;`;
    const itemsResult = await db.query(itemsQuery, [id]);

    // 3. Combinar el encabezado con sus ítems
    presupuesto.items = itemsResult.rows;

    res.json(presupuesto);
  } catch (error) {
    next(error);
  }
});

// PUT /api/presupuestos/:id - Actualizar un presupuesto existente
router.put('/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const { cliente_empresa_id, fecha_vencimiento, notas, items } = req.body;
  const { role } = req.user;

  // Validación básica
  if (!cliente_empresa_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos del cliente o los ítems del presupuesto.' });
  }

  const isSqlite = (process.env.DB_TYPE === 'h2' || process.env.DB_TYPE === 'sqlite');
  try {
    if (!isSqlite) await db.query('BEGIN');

    // 1. Obtener el estado actual del presupuesto para validaciones
    const currentPresupuestoResult = await db.query('SELECT status, codigo_presupuesto, cliente_empresa_id FROM presupuestos WHERE id = $1', [id]);
    if (currentPresupuestoResult.rows.length === 0) {
      throw new Error('Presupuesto no encontrado.');
    }
    const currentPresupuesto = currentPresupuestoResult.rows[0];
    const currentStatus = currentPresupuesto.status;

    let newStatus = currentStatus;
    let wasModifiedBySupervisor = false;

    // 2. Validar permisos de edición y determinar el nuevo estado
    if (role === 'administrador' || role === 'supervisor') {
      if (currentStatus === 'enviado') {
        newStatus = 'borrador'; // El presupuesto vuelve a borrador para que el operador lo confirme de nuevo.
        wasModifiedBySupervisor = true;
      }
    } else { // Usuario estándar
      if (currentStatus !== 'borrador') {
        return res.status(403).json({ error: "Solo puedes editar presupuestos en estado 'borrador'." });
      }
    }

    // 3. Actualizar el encabezado del presupuesto
    const presupuestoQuery = `
      UPDATE presupuestos
      SET
        cliente_empresa_id = $1, 
        fecha_vencimiento = $2, 
        notas = $3, -- Siempre actualizamos con las notas que vienen del frontend
        status = $4,
        updated_at = NOW()
      WHERE id = $5;
    `;
    await db.query(presupuestoQuery, [cliente_empresa_id, fecha_vencimiento || null, notas || '', newStatus, id]);

    // 4. Borrar los ítems antiguos
    await db.query('DELETE FROM presupuesto_items WHERE presupuesto_id = $1', [id]);

    // 5. Insertar los nuevos ítems
    const itemInsertPromises = items.map(item => {
      const itemQuery = `INSERT INTO presupuesto_items (presupuesto_id, producto_id, cantidad, precio_unitario, descripcion_item) VALUES ($1, $2, $3, $4, $5);`;
      const itemValues = [id, item.producto_id, item.cantidad, item.precio_unitario, item.descripcion_item || null];
      return db.query(itemQuery, itemValues);
    });
    await Promise.all(itemInsertPromises);

    if (!isSqlite) await db.query('COMMIT');

    // 6. Enviar notificación si fue modificado por un supervisor
    if (wasModifiedBySupervisor) {
      (async () => {
        try {
          const clientUsers = await getUsersFromCompany(currentPresupuesto.cliente_empresa_id);
          const clientEmails = clientUsers.map(u => u.email);
          await sendQuoteModifiedAlert(currentPresupuesto, clientEmails);
        } catch (emailError) {
          console.error('El presupuesto fue modificado, pero falló el envío de email al cliente.', emailError);
        }
      })();
    }

    res.json({ id: parseInt(id, 10), message: 'Presupuesto actualizado exitosamente.' });
  } catch (error) {
    if (!isSqlite) await db.query('ROLLBACK');
    next(error);
  }
});

// PATCH /api/presupuestos/:id/confirmar - Cambia el estado a 'enviado' y notifica
router.patch('/:id/confirmar', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const { userId } = req.user;

  try {
    // 1. Actualizar el estado del presupuesto
    const updateQuery = `
      UPDATE presupuestos 
      SET status = 'enviado' 
      WHERE id = $1 AND status = 'borrador'
      RETURNING *, (SELECT nombre FROM empresas WHERE id = cliente_empresa_id) as cliente_nombre;
    `;
    const { rows } = await db.query(updateQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Presupuesto no encontrado o ya no está en estado 'borrador'." });
    }

    const presupuestoConfirmado = rows[0];

    // 2. Enviar notificación por email a Admins y Supervisores
    (async () => {
      try {
        const userQueConfirma = await db.query('SELECT email FROM usuarios WHERE id = $1', [userId]);
        const adminEmails = await getAdminAndSupervisorEmails();
        await sendNewQuoteForReviewAlert(presupuestoConfirmado, userQueConfirma.rows[0].email, adminEmails);
      } catch (emailError) {
        console.error('El presupuesto fue confirmado, pero falló el envío de email de notificación.', emailError);
      }
    })();

    res.json({ message: 'Presupuesto confirmado y enviado para revisión.', presupuesto: presupuestoConfirmado });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/presupuestos/:id/aprobar - Aprueba un presupuesto y notifica al cliente (solo supervisores)
router.patch('/:id/aprobar', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;

  try {
    // 1. Actualizar el estado a 'aprobado'
    const updateQuery = `
      UPDATE presupuestos
      SET status = 'aprobado'
      WHERE id = $1 AND status = 'enviado' -- Aseguramos que el cliente_empresa_id esté en el resultado
      RETURNING *, (SELECT nombre FROM empresas WHERE id = cliente_empresa_id) as cliente_nombre;
    `;
    const { rows } = await db.query(updateQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Presupuesto no encontrado o no está en estado 'enviado'." });
    }

    const presupuestoAprobado = rows[0];

    // 2. Enviar notificación a todos los usuarios de la empresa cliente
    (async () => {
      try {
        const clientUsers = await getUsersFromCompany(presupuestoAprobado.cliente_empresa_id);
        const clientEmails = clientUsers.map(u => u.email);
        await sendQuoteApprovedAlert(presupuestoAprobado, clientEmails);
      } catch (emailError) {
        console.error('El presupuesto fue aprobado, pero falló el envío de email al cliente.', emailError);
      }
    })();

    res.json({ message: 'Presupuesto aprobado exitosamente.', presupuesto: presupuestoAprobado });

  } catch (error) {
    next(error);
  }
});

// PATCH /api/presupuestos/:id/rechazar - Rechaza un presupuesto (solo supervisores)
router.patch('/:id/rechazar', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;
  const { motivo } = req.body; // Se espera un motivo para el rechazo

  if (!motivo) {
    return res.status(400).json({ error: 'Se requiere un motivo para rechazar el presupuesto.' });
  }

  try {
    // 1. Actualizar el estado a 'rechazado' y añadir el motivo a las notas
    const updateQuery = `
      UPDATE presupuestos
      SET 
        status = 'rechazado',
        notas = '--- MOTIVO DEL RECHAZO ---\n' || $1 || '\n\n' || COALESCE(notas, '')
      WHERE id = $2 AND status = 'enviado'
      RETURNING *;
    `;
    const { rows } = await db.query(updateQuery, [motivo, id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Presupuesto no encontrado o no está en estado 'enviado'." });
    }

    const presupuestoRechazado = rows[0];

    // 2. Enviar notificación al creador del presupuesto
    (async () => {
      try {
        const creadorResult = await db.query('SELECT email FROM usuarios WHERE id = $1', [presupuestoRechazado.created_by_user_id]);
        if (creadorResult.rows.length > 0) {
          const creadorEmail = creadorResult.rows[0].email;
          // Asumimos que existe una función sendQuoteRejectedAlert en emailService
          await require('./emailService').sendQuoteRejectedAlert(presupuestoRechazado, motivo, creadorEmail);
        }
      } catch (emailError) {
        console.error('El presupuesto fue rechazado, pero falló el envío de email de notificación al creador.', emailError);
      }
    })();

    res.json({ message: 'Presupuesto rechazado exitosamente.', presupuesto: presupuestoRechazado });
  } catch (error) {
    next(error);
  }
});

module.exports = router;