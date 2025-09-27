const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { sendNewUserAlert, sendAccountActivationAlert } = require('./emailService.js');

const saltRounds = 10;
// --- Service logic is now here ---

const getAllUsers = async () => {
  const query = `
    SELECT u.id, u.email, COALESCE(NULLIF(TRIM(u.status), ''), 'pendiente') as status, r.name as role, e.nombre as empresa_nombre, u.created_at, p.nombre, p.apellido, p.biografia
    FROM usuarios u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN empresas e ON u.empresa_id = e.id
    LEFT JOIN perfiles p ON u.id = p.user_id
    ORDER BY u.id;
  `;
  const { rows } = await db.query(query);
  return rows;
};

const getUserById = async (id) => {
  const query = `
    SELECT u.id, u.email, COALESCE(NULLIF(TRIM(u.status), ''), 'pendiente') as status, r.name as role, e.nombre as empresa_nombre, u.created_at, p.nombre, p.apellido, p.biografia
    FROM usuarios u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN empresas e ON u.empresa_id = e.id
    LEFT JOIN perfiles p ON u.id = p.user_id
    WHERE u.id = $1;
  `;
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

const createUser = async ({ email, password, nombre, apellido, biografia, empresa_id }) => {
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const userInsertQuery = 'INSERT INTO usuarios(email, password_hash, empresa_id) VALUES($1, $2, $3) RETURNING id';
    const userResult = await client.query(userInsertQuery, [email, hashedPassword, empresa_id]);
    const userId = userResult.rows[0].id;
    const profileInsertQuery = 'INSERT INTO perfiles(user_id, nombre, apellido, biografia) VALUES($1, $2, $3, $4)';
    await client.query(profileInsertQuery, [userId, nombre, apellido, biografia || null]);
    await client.query('COMMIT');
    return getUserById(userId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const updateUserProfile = async (id, { nombre, apellido, biografia }) => {
  const query = `
    UPDATE perfiles
    SET nombre = $1, apellido = $2, biografia = $3
    WHERE user_id = $4
    RETURNING *;
  `;
  const { rows } = await db.query(query, [nombre, apellido, biografia, id]);
  return rows[0] || null;
};

const deleteUser = async (id) => {
  const query = 'DELETE FROM usuarios WHERE id = $1 RETURNING id';
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

const loginUser = async ({ email, password }) => {
  const userQuery = 'SELECT * FROM usuarios WHERE email = $1';
  const { rows } = await db.query(userQuery, [email]);
  const user = rows[0];
  if (!user) {
    const error = new Error('El usuario no existe.');
    error.statusCode = 404;
    throw error;
  }
  if (user.status !== 'activo') {
    const error = new Error(`El usuario está en estado '${user.status}'. Debe ser 'activo' para iniciar sesión.`);
    error.statusCode = 401;
    throw error;
  }
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const error = new Error('La contraseña es incorrecta.');
    error.statusCode = 401;
    throw error;
  }
  const fullUser = await getUserById(user.id);
  // Generar el token JWT
  const accessToken = jwt.sign(
    { userId: fullUser.id, role: fullUser.role, nombre: fullUser.nombre },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // El token expira en 1 hora
  );

  return { user: fullUser, token: accessToken };
};

const updateUserStatus = async (id, status) => {
  const query = 'UPDATE usuarios SET status = $1 WHERE id = $2 RETURNING id, email, status';
  const { rows } = await db.query(query, [status, id]);
  return rows[0] || null;
};

const updateUserRole = async (id, roleId) => {
  const query = 'UPDATE usuarios SET role_id = $1 WHERE id = $2 RETURNING id, role_id';
  const { rows } = await db.query(query, [roleId, id]);
  return rows[0] || null;
};

// --- End of service logic ---

// POST /api/users/login - Autenticar un usuario
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'El email y la contraseña son obligatorios.' });
  }

  try {
    const { user, token } = await loginUser(req.body);
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
    const newUser = await createUser(req.body);

    // Después de crear el usuario, enviamos las notificaciones por correo.
    // Hacemos esto de forma asíncrona para no bloquear la respuesta al cliente.
    (async () => {
      try {
        const adminQuery = `SELECT u.email FROM usuarios u JOIN roles r ON u.role_id = r.id WHERE r.name = 'administrador'`;
        const { rows: admins } = await db.query(adminQuery);
        const adminEmails = admins.map(a => a.email);

        // Obtenemos el nombre de la empresa para el correo
        const empresaQuery = 'SELECT nombre FROM empresas WHERE id = $1';
        const { rows: [empresa] } = await db.query(empresaQuery, [req.body.empresa_id]);
        await sendNewUserAlert({ ...newUser, empresa_nombre: empresa.nombre }, adminEmails);
      } catch (emailError) {
        console.error('Fallo en el proceso de envío de email post-registro:', emailError);
      }
    })();

    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

const { authenticateToken, authorizeAdmin } = require('../middleware/auth.js');

// GET /api/users - Obtener todos los usuarios con sus perfiles
router.get('/', authenticateToken, authorizeAdmin, async (req, res, next) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - Obtener un usuario específico
router.get('/:id', authenticateToken, authorizeAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id - Actualizar el perfil de un usuario
router.put('/:id', authenticateToken, authorizeAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    const updatedProfile = await updateUserProfile(id, req.body);
    if (!updatedProfile) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(updatedProfile);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/status - Actualizar el estado de un usuario (ej: para aprobación)
router.patch('/:id/status', authenticateToken, authorizeAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'El nuevo estado es obligatorio.' });
  }

  try {
    const updatedUser = await updateUserStatus(id, status);

    // Si el usuario fue activado, le enviamos un correo de notificación.
    if (status === 'activo') {
      (async () => {
        try {
          const fullUser = await getUserById(id); // Necesitamos los datos completos para el email
          await sendAccountActivationAlert(fullUser);
        } catch (emailError) {
          console.error('Fallo en el proceso de envío de email post-aprobación:', emailError);
        }
      })();
    }
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/role - Actualizar el rol de un usuario
router.patch('/:id/role', authenticateToken, authorizeAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { roleId } = req.body;

  if (!roleId) {
    return res.status(400).json({ error: 'El ID del rol es obligatorio.' });
  }

  try {
    const updatedUser = await updateUserRole(id, roleId);
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id - Eliminar un usuario
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    const deletedUser = await deleteUser(id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


module.exports = router;
