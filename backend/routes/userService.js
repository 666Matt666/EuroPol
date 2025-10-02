const bcrypt = require('bcryptjs');
const db = require('../db'); // Esta ruta sigue siendo correcta desde services/
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendNewUserAlert, sendAccountActivationAlert, sendPendingActivationEmail, sendEmailVerification } = require('./emailService');

const saltRounds = 10;

const getUserById = async (id) => {
  const query = `
    SELECT u.id, u.email, COALESCE(NULLIF(TRIM(u.status), ''), 'pendiente') as status, r.name as role, e.id as empresa_id, e.nombre as empresa_nombre, u.created_at, p.nombre, p.apellido, p.biografia
    FROM usuarios u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN empresas e ON u.empresa_id = e.id
    LEFT JOIN perfiles p ON u.id = p.user_id
    WHERE u.id = $1;
  `;
  const { rows } = await db.query(query, [id]);
  return rows[0] || null;
};

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

const getAdminEmails = async () => {
  const adminQuery = `SELECT u.email FROM usuarios u JOIN roles r ON u.role_id = r.id WHERE r.name = 'administrador'`;
  const { rows: admins } = await db.query(adminQuery);
  return admins.map(a => a.email);
};

// La firma ahora omite 'status' para que no se use accidentalmente.
const createUser = async ({ email, password, nombre, apellido, biografia, empresa_id }) => {
  const plainPassword = password; // Guardamos la contraseña en texto plano
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Generar código de verificación de 6 dígitos
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de validez

    const userInsertQuery = `
      INSERT INTO usuarios(email, password_hash, empresa_id, status, verification_code, verification_expires) 
      VALUES($1, $2, $3, 'pendiente_verificacion', $4, $5) 
      RETURNING id
    `;
    const userResult = await client.query(userInsertQuery, [email, plainPassword, empresa_id, verificationCode, verificationExpires]);
    const userId = userResult.rows[0].id;

    const profileInsertQuery = 'INSERT INTO perfiles(user_id, nombre, apellido, biografia) VALUES($1, $2, $3, $4)';
    await client.query(profileInsertQuery, [userId, nombre, apellido, biografia || null]);
    await client.query('COMMIT');

    const newUser = await getUserById(userId);

    // Notificar por correo después de crear el usuario exitosamente
    (async () => {
      try {
        // Enviar email de verificación al usuario
        await sendEmailVerification(newUser, verificationCode);
      } catch (emailError) {
        // Log más detallado para identificar problemas de autenticación
        console.error('************************************************************');
        console.error('ATENCIÓN: El usuario fue creado, pero falló el envío de email.');
        console.error('Causa probable: Credenciales de email incorrectas en el archivo .env.');
        console.error('Error original:', emailError);
        console.error('************************************************************');
      }
    })();
    return newUser;
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

  const isMatch = (password === user.password_hash); // Comparación simple de texto

  if (!isMatch) {
    const error = new Error('La contraseña es incorrecta.');
    error.statusCode = 401;
    throw error;
  }
  const fullUser = await getUserById(user.id);
  const accessToken = jwt.sign({ userId: fullUser.id, role: fullUser.role, nombre: fullUser.nombre, empresaId: fullUser.empresa_id }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return { user: fullUser, token: accessToken };
};

const updateUserStatus = async (id, status) => {
  const query = 'UPDATE usuarios SET status = $1 WHERE id = $2 RETURNING id, email, status';
  const { rows } = await db.query(query, [status, id]);
  const updatedUser = rows[0] || null;

  // Si el usuario fue activado, le enviamos un correo de notificación.
  if (updatedUser && status === 'activo') {
    (async () => {
      try {
        const fullUser = await getUserById(id); // Necesitamos los datos completos para el email
        await sendAccountActivationAlert(fullUser);
      } catch (emailError) {
        console.error('Fallo en el proceso de envío de email post-aprobación:', emailError);
      }
    })();
  }
  return rows[0] || null;
};

const updateUserRole = async (id, roleId) => {
  const query = 'UPDATE usuarios SET role_id = $1 WHERE id = $2 RETURNING id, role_id';
  const { rows } = await db.query(query, [roleId, id]);
  return rows[0] || null;
};

const verifyUserEmail = async (email, code) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const findUserQuery = 'SELECT * FROM usuarios WHERE email = $1 AND verification_code = $2 AND verification_expires > NOW()';
    const userResult = await client.query(findUserQuery, [email, code]);

    if (userResult.rows.length === 0) {
      return null; // Token inválido o expirado
    }

    const user = userResult.rows[0];
    const updateUserQuery = `UPDATE usuarios SET status = 'pendiente', verification_code = NULL, verification_expires = NULL WHERE id = $1`;
    await client.query(updateUserQuery, [user.id]);

    await client.query('COMMIT');
    return getUserById(user.id); // Devolvemos el usuario completo y actualizado
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

module.exports = { getAllUsers, getUserById, getAdminEmails, createUser, updateUserProfile, deleteUser, loginUser, updateUserStatus, updateUserRole, verifyUserEmail };