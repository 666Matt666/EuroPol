const express = require('express');
const cors = require('cors');
// Carga las variables de entorno desde el archivo .env
const errorHandler = require('./middleware/errorHandler'); // Importar el middleware de errores
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware para habilitar CORS
app.use(cors());

// Middleware para parsear JSON, necesario para las peticiones POST y PUT
app.use(express.json());

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.send('¡El servidor de EuroPol está en marcha!');
});

// Importar y usar las rutas de la API
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const empresaRoutes = require('./routes/empresas');
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/empresas', empresaRoutes);

/**
 * Middleware para manejar errores de forma centralizada (importado).
 */
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
