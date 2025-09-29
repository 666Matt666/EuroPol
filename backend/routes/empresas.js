const express = require('express');
const db = require('../db');
const { authenticateToken, authorizeSupervisor } = require('./auth');
const router = express.Router();

// GET /api/empresas - Obtener todas las empresas (protegido para usuarios autenticados)
router.get('/', async (req, res, next) => {
  try {
    const query = 'SELECT * FROM empresas ORDER BY nombre';
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/empresas - Crear una nueva empresa (solo para administradores)
router.post('/', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { nombre, cuit, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' });
  }

  try {
    const query = `
      INSERT INTO empresas (nombre, cuit, direccion)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [nombre, cuit, direccion]);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/empresas/:id - Actualizar una empresa (solo para administradores)
router.put('/:id', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;
  const { nombre, cuit, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' });
  }

  try {
    const query = `
      UPDATE empresas SET nombre = $1, cuit = $2, direccion = $3
      WHERE id = $4 RETURNING *;
    `;
    const { rows } = await db.query(query, [nombre, cuit, direccion, id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada.' });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/empresas/:id - Eliminar una empresa (solo para administradores)
router.delete('/:id', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM empresas WHERE id = $1 RETURNING *;', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Empresa no encontrada.' });
    res.status(204).send();
  } catch (error) {
    // Si la empresa tiene usuarios, la base de datos arrojará un error de clave foránea
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar la empresa porque tiene usuarios asociados.' });
    }
    next(error);
  }
});

module.exports = router;