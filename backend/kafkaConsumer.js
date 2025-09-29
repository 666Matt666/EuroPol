// Carga las variables de entorno desde el archivo .env
require('dotenv').config();

const { Kafka } = require('kafkajs');
const db = require('./db'); // Importar la conexión a la base de datos

// --- Configuración de Kafka ---
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'];
const KAFKA_CLIENT_ID = 'europol-consumer';
const KAFKA_GROUP_ID = 'audit-log-group'; // ID de grupo para el consumidor
const AUDIT_LOG_TOPIC = 'audit-logs';

const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

/**
 * Guarda un log de auditoría en la base de datos.
 * @param {object} logData - Los datos del log parseados desde Kafka.
 */
const saveLogToDatabase = async (logData) => {
  const { eventType, user, details, timestamp } = logData;
  const query = `
    INSERT INTO audit_logs (event_type, user_id, user_role, details, created_at)
    VALUES ($1, $2, $3, $4, $5)
  `;
  // Asegurarse de que user no sea null para evitar errores
  const userId = user ? user.userId : null;
  const userRole = user ? user.role : null;

  const values = [eventType, userId, userRole, details, timestamp];

  try {
    await db.query(query, values);
    console.log(`[Consumer] Log de auditoría guardado en BD: ${eventType} para usuario ${userId}`);
  } catch (error) {
    console.error('[Consumer] Error al guardar log en la base de datos:', error);
  }
};

/**
 * Inicia el consumidor de Kafka, se suscribe al topic y procesa los mensajes.
 */
const run = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: AUDIT_LOG_TOPIC, fromBeginning: true });
    console.log('[Consumer] Conectado y suscrito al topic:', AUDIT_LOG_TOPIC);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const logData = JSON.parse(message.value.toString());
        console.log(`[Consumer] Mensaje recibido:`, logData);
        await saveLogToDatabase(logData);
      },
    });
  } catch (error) {
    console.error('[Consumer] Error fatal:', error);
    process.exit(1);
  }
};

run();

// Manejar cierre elegante
process.on('SIGTERM', async () => {
  await consumer.disconnect();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await consumer.disconnect();
  process.exit(0);
});