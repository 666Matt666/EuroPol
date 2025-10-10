const { Pool } = require('pg');

const dbType = process.env.DB_TYPE || 'postgres';

let db;

const init = () => new Promise((resolve, reject) => {
  if (dbType === 'postgres') {
    // Configuración para PostgreSQL
    db = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'europol',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });

    // Verificamos la conexión antes de continuar
    db.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('Error al conectar con PostgreSQL:', err);
        return reject(err);
      }
      console.log('Conectado exitosamente a PostgreSQL.');
      resolve();
    });
  } else {
    reject(new Error(`Tipo de base de datos no soportado: ${dbType}. Usar 'postgres' para Render.`));
  }
});

const query = (text, params) => {
  return db.query(text, params);
};

module.exports = {
  query,
  init, // Exportamos la nueva función de inicialización
  pool: db, // Para mantener compatibilidad con el código que usa pool.connect()
  // La función saveData ya no es necesaria con una base de datos persistente.
};
