const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db'); // La conexión a la BD real (de prueba)
const productRoutes = require('./productos');

// Mock del middleware de autenticación para no depender del login real
// Hacemos el mock más flexible para poder cambiar el usuario en cada test
let mockAuthenticateToken = (req, res, next) => {
  req.user = { userId: 1, role: 'administrador' }; // Admin por defecto
  next();
};
jest.mock('./auth', () => ({
  authenticateToken: jest.fn((req, res, next) => mockAuthenticateToken(req, res, next)),
}));

// Mock de Kafka para no enviar mensajes durante las pruebas
jest.mock('../kafkaService', () => ({
  sendAuditLog: jest.fn().mockResolvedValue(),
}));

const app = express();
app.use(express.json());
app.use('/api/productos', productRoutes);

describe('Pruebas de Integración para Productos', () => {

  // Antes de que todas las pruebas comiencen, inicializamos la BD de prueba
  beforeAll(async () => {
    await db.init(); // Usamos la nueva función de inicialización del módulo db
  });

  // Después de que todas las pruebas terminen, cerramos la conexión a la BD
  afterAll(async () => {
    await db.pool.end();
  });

  // Antes de cada prueba, reseteamos el mock de autenticación al admin por defecto
  beforeEach(() => {
    mockAuthenticateToken = (req, res, next) => {
      req.user = { userId: 1, role: 'administrador' };
      next();
    };
  });

  it('debería crear un producto en la base de datos y luego poder obtenerlo', async () => {
    // --- FASE 1: CREAR el producto ---
    const nuevoProducto = {
      nombre_producto: 'Bolsa de Integración',
      sku: 'INT-TEST-001',
      material_id: 1, // Asume que el material con ID 1 existe por init.sql
      ancho_cm: 50,
      alto_cm: 70,
    };

    const createResponse = await request(app)
      .post('/api/productos')
      .send(nuevoProducto);

    // Verificamos que la creación fue exitosa
    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.id).toBeDefined();
    const nuevoId = createResponse.body.id;

    // --- FASE 2: OBTENER el producto que acabamos de crear ---
    const getResponse = await request(app).get('/api/productos');

    // Verificamos que la obtención fue exitosa
    expect(getResponse.statusCode).toBe(200);

    // Buscamos nuestro producto en la lista de todos los productos
    const productoEncontrado = getResponse.body.find(p => p.id === nuevoId);
    expect(productoEncontrado).toBeDefined();
    expect(productoEncontrado.nombre_producto).toBe('Bolsa de Integración');
  });

  it('debería eliminar un producto correctamente', async () => {
    // --- FASE 1: CREAR un producto para tener algo que eliminar ---
    const productoParaBorrar = {
      nombre_producto: 'Bolsa para Eliminar',
      sku: 'INT-TEST-DEL-001',
      material_id: 2,
      ancho_cm: 10,
      alto_cm: 10,
    };

    const createResponse = await request(app)
      .post('/api/productos')
      .send(productoParaBorrar);
    
    expect(createResponse.statusCode).toBe(201);
    const idParaBorrar = createResponse.body.id;

    // --- FASE 2: ELIMINAR el producto ---
    const deleteResponse = await request(app).delete(`/api/productos/${idParaBorrar}`);

    // Verificamos que la eliminación fue exitosa (204 No Content)
    expect(deleteResponse.statusCode).toBe(204);

    // --- FASE 3: VERIFICAR que el producto ya no existe ---
    const getResponse = await request(app).get('/api/productos');
    
    // Buscamos el producto eliminado en la lista y esperamos no encontrarlo
    const productoEliminado = getResponse.body.find(p => p.id === idParaBorrar);
    expect(productoEliminado).toBeUndefined();
  });

  it('debería actualizar un producto existente', async () => {
    // --- FASE 1: CREAR un producto para tener algo que actualizar ---
    const productoInicial = {
      nombre_producto: 'Bolsa para Actualizar',
      sku: 'INT-TEST-UPD-001',
      material_id: 1,
      ancho_cm: 20,
      alto_cm: 30,
      color: 'azul'
    };

    const createResponse = await request(app)
      .post('/api/productos')
      .send(productoInicial);
    
    expect(createResponse.statusCode).toBe(201);
    const idParaActualizar = createResponse.body.id;

    // --- FASE 2: ACTUALIZAR el producto ---
    const datosActualizados = {
      ...productoInicial, // Mantenemos los datos originales
      nombre_producto: 'Bolsa YA Actualizada', // Pero cambiamos el nombre
      color: 'rojo', // y el color
    };

    const updateResponse = await request(app)
      .put(`/api/productos/${idParaActualizar}`)
      .send(datosActualizados);

    // Verificamos que la actualización fue exitosa y los datos se cambiaron
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.body.nombre_producto).toBe('Bolsa YA Actualizada');
    expect(updateResponse.body.color).toBe('rojo');
  });

  it('NO debería permitir a un usuario eliminar un producto de otro usuario', async () => {
    // --- FASE 1: CREAR un producto como usuario 1 (admin) ---
    const productoDelAdmin = {
      nombre_producto: 'Producto Secreto del Admin',
      sku: 'INT-TEST-SECURE-001',
      material_id: 1,
      ancho_cm: 1,
      alto_cm: 1,
    };

    const createResponse = await request(app)
      .post('/api/productos')
      .send(productoDelAdmin);
    
    expect(createResponse.statusCode).toBe(201);
    const idProductoAdmin = createResponse.body.id;

    // --- FASE 2: CAMBIAR al usuario estándar (ID 2) e intentar eliminar ---
    mockAuthenticateToken = (req, res, next) => {
      req.user = { userId: 2, role: 'usuario' }; // Ahora somos el usuario estándar
      next();
    };

    const deleteResponse = await request(app).delete(`/api/productos/${idProductoAdmin}`);

    // Verificamos que la API devuelve un error 404 (porque no encuentra el producto para ESE usuario)
    expect(deleteResponse.statusCode).toBe(404);
  });
});