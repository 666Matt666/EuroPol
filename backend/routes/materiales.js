const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');

// GET /api/materiales - Obtener todos los materiales
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM materiales ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;