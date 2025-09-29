const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');

// GET /api/dibujos - Obtener solo los dibujos del usuario autenticado
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    // req.user.userId viene del token JWT
    const userId = req.user.userId;
    const query = 'SELECT * FROM dibujos WHERE user_id = $1 ORDER BY created_at DESC';
    const { rows } = await db.query(query, [userId]);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/dibujos - Crear un nuevo dibujo asociado al usuario autenticado
router.post('/', authenticateToken, async (req, res, next) => {
  const { nombre, codigo_diseno, ruta_archivo_imagen, descripcion } = req.body;
  const userId = req.user.userId; // El dueño del dibujo es el usuario logueado

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del dibujo es obligatorio.' });
  }

  try {
    const query = `
      INSERT INTO dibujos (nombre, codigo_diseno, ruta_archivo_imagen, descripcion, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [nombre, codigo_diseno, ruta_archivo_imagen, descripcion, userId];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/dibujos/:id - Actualizar un dibujo (verificando propiedad)
router.put('/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const { nombre, codigo_diseno, ruta_archivo_imagen, descripcion } = req.body;

  try {
    // --- Lógica de actualización dinámica ---
    // 1. Obtener el dibujo actual para no perder datos
    const currentDibujoResult = await db.query('SELECT * FROM dibujos WHERE id = $1 AND user_id = $2', [id, userId]);
    if (currentDibujoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dibujo no encontrado o no tienes permiso para editarlo.' });
    }
    const currentDibujo = currentDibujoResult.rows[0];

    // 2. Construir la consulta dinámicamente
    const fieldsToUpdate = {
      nombre: nombre !== undefined ? nombre : currentDibujo.nombre,
      codigo_diseno: codigo_diseno !== undefined ? codigo_diseno : currentDibujo.codigo_diseno,
      ruta_archivo_imagen: ruta_archivo_imagen !== undefined ? ruta_archivo_imagen : currentDibujo.ruta_archivo_imagen,
      descripcion: descripcion !== undefined ? descripcion : currentDibujo.descripcion,
    };

    const query = `UPDATE dibujos SET 
      nombre = $1, codigo_diseno = $2, ruta_archivo_imagen = $3, descripcion = $4 
      WHERE id = $5 AND user_id = $6 RETURNING *;`;
    
    const values = [fieldsToUpdate.nombre, fieldsToUpdate.codigo_diseno, fieldsToUpdate.ruta_archivo_imagen, fieldsToUpdate.descripcion, id, userId];
    // --- Fin de la lógica dinámica ---

    const { rows } = await db.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Dibujo no encontrado o no tienes permiso para editarlo.' });
    }
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/dibujos/:id - Eliminar un dibujo (verificando propiedad)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    // Se elimina solo si el user_id coincide
    const result = await db.query('DELETE FROM dibujos WHERE id = $1 AND user_id = $2', [id, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dibujo no encontrado o no tienes permiso para eliminarlo.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;