const request = require('supertest');
const express = require('express');
const presupuestosRouter = require('./presupuestos'); // Importamos el router
const { authenticateToken } = require('./auth'); // Importamos el middleware

// Mock del middleware de autenticación para no depender de un token real
jest.mock('./auth', () => ({
  ...jest.requireActual('./auth'), // Importamos el resto de las funciones reales
  authenticateToken: jest.fn((req, res, next) => {
    // Simulamos un usuario operador para las pruebas
    req.user = { userId: 3, role: 'usuario', empresaId: 2 };
    next();
  }),
}));

// Mock del módulo de la base de datos
const db = require('../db');
jest.mock('../db');

// Creamos una app de Express solo para las pruebas
const app = express();
app.use(express.json());
app.use('/api/presupuestos', presupuestosRouter);

describe('Pruebas de Integración para Rutas de Presupuestos', () => {

  // Limpiamos los mocks después de cada prueba
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/presupuestos', () => {
    it('debería devolver los presupuestos para un usuario operador', async () => {
      // 1. Preparamos los datos que simulará devolver la base de datos
      const mockPresupuestos = [
        { id: 1, codigo_presupuesto: 'PRE-2024-0001', cliente_empresa_id: 2 },
        { id: 2, codigo_presupuesto: 'PRE-2024-0002', cliente_empresa_id: 2 },
      ];
      const mockItems = [{ id: 1, producto_id: 1, cantidad: 10 }];

      // Configuramos el mock de db.query para que devuelva nuestros datos
      db.query.mockResolvedValueOnce({ rows: mockPresupuestos }); // Para la consulta de presupuestos
      db.query.mockResolvedValue({ rows: mockItems }); // Para las consultas de ítems

      // 2. Ejecutamos la petición a la API
      const response = await request(app).get('/api/presupuestos');

      // 3. Verificamos los resultados (Aserciones)
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].codigo_presupuesto).toBe('PRE-2024-0001');
      
      // Verificamos que la consulta SQL se haya filtrado por el empresaId del usuario mock
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.cliente_empresa_id = $1'), [2]);
    });
  });
});