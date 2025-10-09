const { Kafka } = require('kafkajs');

// --- Configuración de Kafka ---
// Idealmente, la URL de los brokers debería venir de tu archivo .env
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'];
const KAFKA_CLIENT_ID = 'europol-app';
const AUDIT_LOG_TOPIC = 'audit-logs';

const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: KAFKA_BROKERS,
});

const producer = kafka.producer();
let isConnected = false;

/**
 * Conecta el productor de Kafka. Debe ser llamado al iniciar la aplicación.
 */
const init = async () => {
  try {
    await producer.connect();
    isConnected = true;
    console.log('Productor de Kafka conectado exitosamente.');
  } catch (error) {
    console.error('Error al conectar el productor de Kafka:', error);
  }
};

/**
 * Desconecta el productor de Kafka. Debe ser llamado al cerrar la aplicación.
 */
const shutdown = async () => {
  if (isConnected) {
    await producer.disconnect();
    isConnected = false;
    console.log('Productor de Kafka desconectado.');
  }
};

/**
 * Envía un evento de auditoría al topic de Kafka.
 * @param {string} eventType - Ej: 'PRODUCT_CREATED', 'USER_DELETED'
 * @param {object} user - El usuario que realiza la acción { userId, role }
 * @param {object} details - Detalles adicionales sobre el evento.
 */
const sendAuditLog = async (eventType, user, details) => {
  if (!isConnected) {
    console.error('Intento de enviar log sin conexión a Kafka. Evento:', eventType);
    return;
  }

  const logPayload = { eventType, timestamp: new Date().toISOString(), user, details };

  await producer.send({
    topic: AUDIT_LOG_TOPIC,
    messages: [{ value: JSON.stringify(logPayload) }],
  });
};

module.exports = { init, shutdown, sendAuditLog };