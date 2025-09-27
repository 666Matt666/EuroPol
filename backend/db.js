const { Pool } = require('pg');

// Usar variables de entorno para la configuración de la base de datos
// es una buena práctica para la seguridad y flexibilidad.
// Asegúrate de crear un archivo .env con estos valores o definirlos en tu entorno.
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'europol',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});


module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
