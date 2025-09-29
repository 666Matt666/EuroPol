const request = require('supertest');
const express = require('express');
const productRoutes = require('./productos');
const { authenticateToken } = require('./auth');

// --- Mocks (Simulaciones) ---
// Mock del middleware de autenticación para no depender del login real
jest.mock('./auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    // Por defecto, simulamos un usuario estándar.
    // En cada test, podemos sobreescribir req.user si necesitamos otro rol.
    req.user = { userId: 1, role: 'usuario' };
    next();
  }),
}));

// Mock del servicio de base de datos para no tocar la BD real en los tests
jest.mock('../db', () => ({
  query: jest.fn(),
}));

// Mock del servicio de Kafka
jest.mock('../kafkaService', () => ({
  sendAuditLog: jest.fn(),
}));

// --- Configuración de la App de Express para Pruebas ---
const app = express();
app.use(express.json());
app.use('/api/productos', productRoutes);

// --- Inicio de las Pruebas ---
describe('Rutas de Productos - /api/productos', () => {
  // Importamos los mocks para poder limpiarlos y configurarlos
  const db = require('../db');
  const kafka = require('../kafkaService');

  // Limpiamos los mocks después de cada prueba para evitar interferencias
  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Pruebas para GET /api/productos ---
  describe('GET /', () => {
    it('debería devolver solo los productos del usuario si el rol es "usuario"', async () => {
      const mockProductosUsuario = [{ id: 1, nombre_producto: 'Producto del Usuario 1', created_by_user_id: 1 }];
      // Simulamos que la BD devuelve estos productos
      db.query.mockResolvedValue({ rows: mockProductosUsuario });

      const response = await request(app).get('/api/productos');

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockProductosUsuario);
      // Verificamos que la consulta a la BD se hizo con el filtro de usuario
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.created_by_user_id = $1'), [1]);
    });

    it('debería devolver todos los productos si el rol es "administrador"', async () => {
      // Sobreescribimos el mock de autenticación para este test específico
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { userId: 99, role: 'administrador' };
        next();
      });

      const mockTodosLosProductos = [
        { id: 1, nombre_producto: 'Producto 1', created_by_user_id: 1 },
        { id: 2, nombre_producto: 'Producto 2', created_by_user_id: 2 },
      ];
      db.query.mockResolvedValue({ rows: mockTodosLosProductos });

      const response = await request(app).get('/api/productos');

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockTodosLosProductos);
      // Verificamos que la consulta a la BD se hizo SIN el filtro de usuario
      expect(db.query).toHaveBeenCalledWith(expect.not.stringContaining('WHERE'), []);
    });
  });

  // --- Pruebas para POST /api/productos ---
  describe('POST /', () => {
    it('debería crear un nuevo producto y devolverlo', async () => {
      const nuevoProducto = { nombre_producto: 'Bolsa Nueva', material_id: 1, ancho_cm: 10, alto_cm: 20 };
      const productoCreado = { ...nuevoProducto, id: 10, created_by_user_id: 1 };

      // Simulamos la respuesta de la BD y de Kafka
      db.query.mockResolvedValue({ rows: [productoCreado] });
      kafka.sendAuditLog.mockResolvedValue();

      const response = await request(app)
        .post('/api/productos')
        .send(nuevoProducto);

      expect(response.statusCode).toBe(201);
      expect(response.body).toEqual(productoCreado);
      // Verificamos que se llamó al log de Kafka
      expect(kafka.sendAuditLog).toHaveBeenCalledWith('PRODUCT_CREATED', expect.any(Object), expect.any(Object));
    });

    it('debería devolver 400 si faltan campos obligatorios', async () => {
      const productoIncompleto = { nombre_producto: 'Incompleto' }; // Faltan material, ancho, alto
      const response = await request(app).post('/api/productos').send(productoIncompleto);
      expect(response.statusCode).toBe(400);
    });
  });

  // Aquí podrías añadir más pruebas para PUT y DELETE...
});