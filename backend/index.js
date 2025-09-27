const express = require('express');
const cors = require('cors');
// Carga las variables de entorno desde el archivo .env
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
 * Middleware para manejar errores de forma centralizada.
 */
const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Error de violación de unicidad (ej: email duplicado)
  if (err.code === '23505') {
    return res.status(409).json({ error: 'El recurso ya existe.', details: err.detail });
  }

  // Otros errores personalizados que podríamos definir
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Error genérico del servidor.
  const isDevelopment = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: isDevelopment ? err.message : 'Error interno del servidor.',
    details: isDevelopment ? err.stack : undefined,
  });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
