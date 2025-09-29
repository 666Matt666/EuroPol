const express = require('express');
const router = express.Router();
const db = require('../db');
const userService = require('./userService');
const { authenticateToken, authorizeAdmin, authorizeSupervisor } = require('./auth');

// POST /api/users/login - Autenticar un usuario
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'El email y la contraseña son obligatorios.' });
  }

  try {
    const { user, token } = await userService.loginUser(req.body);
    res.json({ message: 'Login exitoso', user, token });
  } catch (error) {
    next(error); // El errorHandler se encargará de enviar la respuesta correcta (404, 401, etc.)
  }
});

// POST /api/users - Crear un nuevo usuario y su perfil
router.post('/', async (req, res, next) => {
  const { email, password, empresa_id } = req.body;
  if (!email || !password || !empresa_id) {
    return res.status(400).json({ error: 'Email, contraseña y empresa son obligatorios.' });
  }

  try {
    const newUser = await userService.createUser(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

// GET /api/users - Obtener todos los usuarios con sus perfiles
router.get('/', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me - Obtener el perfil del usuario autenticado por su token
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/pending-count - Obtener el número de usuarios pendientes (solo para admins/supervisores)
router.get('/pending-count', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  try {
    const result = await db.query("SELECT COUNT(*) FROM usuarios WHERE status = 'pendiente'");
    const count = parseInt(result.rows[0].count, 10);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});


// GET /api/users/:id - Obtener un usuario específico
router.get('/:id', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await userService.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id - Actualizar el perfil de un usuario
router.put('/:id', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;
  try {
    const updatedProfile = await userService.updateUserProfile(id, req.body);
    if (!updatedProfile) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(updatedProfile);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/status - Actualizar el estado de un usuario (ej: para aprobación)
router.patch('/:id/status', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'El nuevo estado es obligatorio.' });
  }

  try {
    const updatedUser = await userService.updateUserStatus(id, status);
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/role - Actualizar el rol de un usuario
router.patch('/:id/role', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;
  const { roleId } = req.body;

  if (!roleId) {
    return res.status(400).json({ error: 'El ID del rol es obligatorio.' });
  }

  try {
    const updatedUser = await userService.updateUserRole(id, roleId);
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id - Eliminar un usuario
router.delete('/:id', authenticateToken, authorizeSupervisor, async (req, res, next) => {
  const { id } = req.params;
  try {
    const deletedUser = await userService.deleteUser(id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


module.exports = router;
