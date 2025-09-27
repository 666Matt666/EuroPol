const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/roles - Obtener todos los roles disponibles
router.get('/', async (req, res, next) => {
  try {
    const query = 'SELECT * FROM roles ORDER BY id';
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;