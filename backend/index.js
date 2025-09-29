// Carga las variables de entorno desde el archivo .env ANTES que cualquier otro código
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const errorHandler = require('./errorHandler'); // Importar el middleware de errores
const fs = require('fs');
const path = require('path');
const kafkaService = require('./kafkaService'); // Importar el servicio de Kafka

const app = express();
const port = process.env.PORT || 3000;

// Middleware para habilitar CORS
app.use(cors());

// Middleware para parsear JSON, necesario para las peticiones POST y PUT
app.use(express.json());

// --- Creación de directorios necesarios ---
// Nos aseguramos de que la carpeta para subir imágenes exista.
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'dibujos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware para servir archivos estáticos (imágenes, etc.)
// Cualquier archivo en la carpeta 'public' será accesible desde la raíz del servidor.
app.use(express.static(path.join(__dirname, 'public')));

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.send('¡El servidor de EuroPol está en marcha!');
});

// Importar y usar las rutas de la API
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const empresaRoutes = require('./routes/empresas');
const productRoutes = require('./routes/productos');
const dibujoRoutes = require('./routes/dibujos');
const materialRoutes = require('./routes/materiales'); // Nueva ruta
const uploadRoutes = require('./routes/uploads'); // Nueva ruta para subidas
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/dibujos', dibujoRoutes);
app.use('/api/materiales', materialRoutes); // Usar la nueva ruta
app.use('/api/uploads', uploadRoutes); // Usar la nueva ruta para subidas

/**
 * Middleware para manejar errores de forma centralizada (importado).
 */
app.use(errorHandler);

let server;

// Iniciar el productor de Kafka y luego el servidor Express
const startServer = async () => {
  await kafkaService.init();

  server = app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
};

// Función para un cierre elegante
const gracefulShutdown = async (signal) => {
  console.log(`\n[${signal}] Señal recibida. Cerrando la aplicación elegantemente...`);
  
  // 1. Detener el servidor HTTP
  server.close(async () => {
    console.log('Servidor HTTP cerrado.');
    // 2. Desconectar Kafka
    await kafkaService.shutdown();
    // 3. Salir del proceso
    process.exit(0);
  });
};

startServer();

// Manejar cierre elegante para desconectar Kafka
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
