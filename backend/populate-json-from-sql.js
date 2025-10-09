/**
 * Este script lee el archivo init.sql, crea una base de datos SQLite en memoria,
 * la puebla con los datos de ejemplo, y luego exporta cada tabla a un archivo JSON
 * en la carpeta db_persistence.
 *
 * Esto permite que la aplicación, al arrancar en modo 'h2' (SQLite), cargue
 * los mismos datos de prueba que se usarían en un entorno PostgreSQL.
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

const persistenceDir = path.join(__dirname, 'db_persistence');
const initSqlPath = path.join(__dirname, '..', 'init.sql');

// Lista de tablas a persistir, debe coincidir con la de db.js
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
  'audit_logs'
];

async function run() {
  console.log('Iniciando la generación de archivos JSON desde init.sql...');

  // 1. Crear una base de datos en memoria
  const db = new sqlite3.Database(':memory:');

  // Usamos db.serialize para asegurar que las operaciones se ejecuten en orden.
  db.serialize(async () => {
    try {
      // 2. Leer y adaptar el script SQL para SQLite
      const initSql = await fs.readFile(initSqlPath, 'utf8');
      const sqliteSql = initSql
        .replace(/IF NOT EXISTS/g, '')
        .replace(/TIMESTAMPTZ/g, 'DATETIME')
        .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/JSONB/g, 'TEXT')
        .replace(/DEFAULT NOW\(\)/g, 'DEFAULT CURRENT_TIMESTAMP')
        // Eliminar bloques de funciones y triggers de PostgreSQL que no son compatibles
        .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?END;\s*\$\$ language 'plpgsql';/g, '')
        .replace(/CREATE TRIGGER[\s\S]*?;/g, '')
        // Eliminar la restricción UNIQUE que no es totalmente compatible en este contexto
        .replace(/UNIQUE\(user_id, nombre\)/g, '');

      // 3. Ejecutar el SQL para crear y poblar las tablas en memoria
      await new Promise((resolve, reject) => {
        db.exec(sqliteSql, (err) => {
          if (err) return reject(err);
          console.log('Base de datos en memoria poblada con datos de init.sql.');
          resolve();
        });
      });

      // 4. Crear el directorio de persistencia si no existe
      await fs.mkdir(persistenceDir, { recursive: true });

      // 5. Exportar cada tabla a un archivo JSON
      for (const table of tablesToPersist) {
        const rows = await new Promise((resolve, reject) => {
          db.all(`SELECT * FROM ${table}`, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
          });
        });

        if (rows.length > 0) {
          await fs.writeFile(path.join(persistenceDir, `${table}.json`), JSON.stringify(rows, null, 2));
          console.log(`  - Se generó '${table}.json' con ${rows.length} registros.`);
        }
      }

      console.log('\n¡Proceso completado! Los archivos JSON han sido generados en "backend/db_persistence".');
    } catch (err) {
      console.error('\nError durante el proceso:', err);
    } finally {
      db.close();
    }
  });
}

run();