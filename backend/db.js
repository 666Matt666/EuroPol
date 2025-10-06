const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

const dbType = process.env.DB_TYPE || 'postgres';
const persistenceDir = path.join(__dirname, 'db_persistence');

let db;

const init = () => new Promise((resolve, reject) => {
  if (dbType === 'h2' || dbType === 'sqlite') {
    // Usamos SQLite en modo memoria para simular H2, con mejor integración en Node.js
    db = new sqlite3.Database(':memory:', async (err) => {
      if (err) {
        console.error('Error al abrir la base de datos SQLite en memoria:', err.message);
        return reject(err);
      }
      console.log('Conectado a la base de datos SQLite en memoria.');
      try {
        const initSql = await fs.readFile(path.join(__dirname, '..', 'init.sql'), 'utf8');
        // SQLite no soporta 'IF NOT EXISTS' en todas las sentencias, lo removemos para evitar errores.
        // También ajustamos tipos de datos para compatibilidad.
        const sqliteSql = initSql
          .replace(/IF NOT EXISTS/g, '')
          .replace(/TIMESTAMPTZ/g, 'DATETIME')
          .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
          .replace(/JSONB/g, 'TEXT')
          .replace(/DEFAULT NOW\(\)/g, 'DEFAULT CURRENT_TIMESTAMP')
          // Eliminar bloques de funciones y triggers de PostgreSQL que no son compatibles
          .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?END;\s*\$\$ language 'plpgsql';/g, '')
          .replace(/CREATE TRIGGER[\s\S]*?;/g, '')
          // Eliminar los INSERTs para que solo se carguen desde los JSON
          .replace(/INSERT INTO[\s\S]*?;/g, '');

        db.exec(sqliteSql, async (execErr) => {
          if (execErr) {
            console.error('Error al ejecutar init.sql en SQLite:', execErr.message);
            return reject(execErr);
          }
          console.log('Esquema de base de datos inicializado en memoria.');
          await loadDataFromFiles(); // Cargar datos después de crear tablas
          resolve(); // La inicialización de SQLite está completa
        });
      } catch (readErr) {
        console.error('Error al leer el archivo init.sql:', readErr);
        reject(readErr);
      }
    });
  } else {
    // Configuración para PostgreSQL
    db = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'europol',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });
    // Para PostgreSQL, la conexión es "lazy", podemos resolver de inmediato.
    // Opcionalmente, se podría hacer un `db.query('SELECT 1')` para verificar la conexión.
    console.log('Configurada la conexión a PostgreSQL.');
    resolve();
  }
});

const tablesToPersist = [
  'roles',
  'empresas',
  'usuarios',
  'perfiles',
  'materiales',
  'dibujos',
  'productos_bolsas',
  'presupuestos',
  'presupuesto_items',
  'facturas',
  'factura_items',
  'audit_logs',
];

async function saveDataToFiles() {
  if (dbType !== 'h2' && dbType !== 'sqlite') return;
  console.log('Guardando datos de la base de datos en memoria...');
  try {
    await fs.mkdir(persistenceDir, { recursive: true });
    for (const table of tablesToPersist) {
      const { rows } = await query(`SELECT * FROM ${table}`);
      if (rows.length > 0) {
        await fs.writeFile(path.join(persistenceDir, `${table}.json`), JSON.stringify(rows, null, 2));
        console.log(`  - Datos de la tabla '${table}' guardados.`);
      }
    }
  } catch (err) {
    console.error('Error al guardar los datos en archivos JSON:', err);
  }
}

async function loadDataFromFiles() {
  if (dbType !== 'h2' && dbType !== 'sqlite') return;
  console.log('Cargando datos desde archivos JSON a la base de datos en memoria...');
  try {
    for (const table of tablesToPersist) {
      const filePath = path.join(persistenceDir, `${table}.json`);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        const rows = JSON.parse(data);
        if (rows.length > 0) {
          for (const row of rows) {
            const columns = Object.keys(row).join(', ');
            const placeholders = Object.keys(row).map(() => '?').join(', ');
            const values = Object.values(row);
            await query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values);
          }
          console.log(`  - Datos de la tabla '${table}' cargados.`);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') { // ENOENT = file not found, lo cual es normal la primera vez
          console.error(`Error al cargar datos para la tabla ${table}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error general al cargar datos desde archivos JSON:', err);
  }
}

const query = (text, params) => {
  if (dbType === 'h2' || dbType === 'sqlite') {
    // Adaptador para que sqlite3 se comporte como node-postgres (pg)
    return new Promise((resolve, reject) => {
      db.all(text.replace(/\$\d+/g, '?'), params, (err, rows) => {
        if (err) return reject(err);
        resolve({ rows });
      });
    });
  }
  return db.query(text, params);
};

module.exports = {
  query,
  init, // Exportamos la nueva función de inicialización
  pool: db, // Para mantener compatibilidad con el código que usa pool.connect()
  saveData: saveDataToFiles,
};
