const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Verificación crucial: Asegurarse de que la clave secreta JWT esté definida.
if (!JWT_SECRET) {
  console.error('Error: La variable de entorno JWT_SECRET no está definida. Asegúrate de que tu archivo .env esté configurado correctamente.');
  process.exit(1); // Detiene la aplicación con un código de error.
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.sendStatus(401); // Unauthorized
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Forbidden (token no válido)
    }
    req.user = user;
    next();
  });
};

const authorizeAdmin = (req, res, next) => {
  // Este middleware debe ejecutarse DESPUÉS de authenticateToken
  if (req.user.role !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
};

const authorizeSupervisor = (req, res, next) => {
  // Este middleware debe ejecutarse DESPUÉS de authenticateToken
  if (req.user.role !== 'administrador' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Supervisor o Administrador.' });
  }
  next();
};

module.exports = {
  authenticateToken,
  authorizeAdmin,
  authorizeSupervisor,
};