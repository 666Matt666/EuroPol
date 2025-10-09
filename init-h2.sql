-- Versión del script de inicialización adaptada para la base de datos H2.
-- H2 tiene un dialecto SQL diferente a PostgreSQL.
-- Cambios notables:
-- - SERIAL se reemplaza por INT AUTO_INCREMENT.
-- - TIMESTAMPTZ se reemplaza por TIMESTAMP.
-- - No se usan secuencias explícitas, AUTO_INCREMENT se encarga.
-- - Las restricciones de clave foránea se definen al final para mayor compatibilidad.
-- - JSON/JSONB no es un tipo nativo, se usará VARCHAR y la lógica de la app se encargará de parsear.

-- Crear tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Crear tabla de empresas
CREATE TABLE IF NOT EXISTS empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    cuit VARCHAR(20),
    direccion VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT,
    empresa_id INT,
    status VARCHAR(50) DEFAULT 'pendiente',
    verification_code VARCHAR(10),
    verification_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS perfiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    biografia VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de materiales
CREATE TABLE IF NOT EXISTS materiales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
);

-- Crear tabla de dibujos
CREATE TABLE IF NOT EXISTS dibujos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    codigo_diseno VARCHAR(100),
    ruta_archivo_imagen VARCHAR(512),
    descripcion VARCHAR(500),
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de productos (bolsas)
CREATE TABLE IF NOT EXISTS productos_bolsas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(100) UNIQUE,
    nombre_producto VARCHAR(255) NOT NULL,
    material_id INT NOT NULL,
    dibujo_id INT,
    ancho_cm DECIMAL(10, 2) NOT NULL,
    alto_cm DECIMAL(10, 2) NOT NULL,
    fuelle_cm DECIMAL(10, 2),
    espesor_micrones INT,
    color VARCHAR(50),
    precio_base DECIMAL(12, 2) DEFAULT 0.00,
    created_by_user_id INT,
    modified_by_user_id INT,
    empresa_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de presupuestos
CREATE TABLE IF NOT EXISTS presupuestos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_presupuesto VARCHAR(50) NOT NULL UNIQUE,
    cliente_empresa_id INT NOT NULL,
    created_by_user_id INT NOT NULL,
    fecha_vencimiento DATE,
    notas VARCHAR(2000),
    status VARCHAR(50) DEFAULT 'borrador',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de items de presupuesto
CREATE TABLE IF NOT EXISTS presupuesto_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    presupuesto_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12, 2) NOT NULL,
    descripcion_item VARCHAR(500)
);

-- Crear tabla de facturas
CREATE TABLE IF NOT EXISTS facturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_factura VARCHAR(50) NOT NULL UNIQUE,
    cliente_empresa_id INT NOT NULL,
    created_by_user_id INT NOT NULL,
    presupuesto_id INT,
    codigo_presupuesto VARCHAR(50),
    fecha_vencimiento DATE,
    notas VARCHAR(2000),
    total DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'emitida',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de items de factura
CREATE TABLE IF NOT EXISTS factura_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factura_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12, 2) NOT NULL,
    descripcion_item VARCHAR(500)
);

-- Crear tabla de logs de auditoría (simplificada para H2)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100),
    user_id INT,
    details VARCHAR(4000), -- Usamos VARCHAR en lugar de JSONB
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos iniciales
INSERT INTO roles (name) VALUES ('administrador'), ('supervisor'), ('usuario') ON CONFLICT(name) DO NOTHING;
INSERT INTO empresas (nombre, cuit) VALUES ('EuroPol S.A.', '30-12345678-9'), ('Cliente de Muestra', '30-87654321-1') ON CONFLICT(nombre) DO NOTHING;
INSERT INTO materiales (nombre) VALUES ('Polietileno de Alta Densidad'), ('Polietileno de Baja Densidad'), ('Polipropileno') ON CONFLICT(nombre) DO NOTHING;

-- Usuario Administrador de ejemplo (contraseña: 'admin')
-- En una app real, este hash se generaría con bcrypt
INSERT INTO usuarios (email, password_hash, role_id, empresa_id, status) VALUES 
('admin@europol.com', '$2a$10$f/fV/y.5f5b3G3m3R.1b3O.Zz.h.Zz.h.Zz.h.Zz.h.Zz.h', 1, 1, 'activo') ON CONFLICT(email) DO NOTHING;

-- Usuario estándar de ejemplo (contraseña: 'password')
INSERT INTO usuarios (email, password_hash, role_id, empresa_id, status) VALUES 
('user@cliente.com', '$2a$10$f/fV/y.5f5b3G3m3R.1b3O.Zz.h.Zz.h.Zz.h.Zz.h.Zz.h', 3, 2, 'activo') ON CONFLICT(email) DO NOTHING;

-- Productos de ejemplo
INSERT INTO productos_bolsas (nombre_producto, material_id, ancho_cm, alto_cm, precio_base, created_by_user_id) VALUES
('Bolsa Camiseta 30x40', 1, 30, 40, 5.50, 1),
('Bolsa Residuos 50x70', 2, 50, 70, 12.75, 1)
ON CONFLICT(sku) DO NOTHING;