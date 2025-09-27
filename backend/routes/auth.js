const jwt = require('jsonwebtoken');

// Para mayor seguridad, esta clave secreta debería estar en un archivo .env
const JWT_SECRET = process.env.JWT_SECRET;

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

module.exports = {
  authenticateToken,
  authorizeAdmin,
};