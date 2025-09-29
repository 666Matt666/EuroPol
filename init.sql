-- Script de inicialización para la base de datos EuroPol
-- Versión robustecida con orden de borrado y datos de prueba.

-- Borrar tablas existentes en el orden correcto para evitar errores de dependencia
-- Primero las que dependen de otras, y al final las tablas maestras.
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS productos_bolsas;
DROP TABLE IF EXISTS dibujos;
DROP TABLE IF EXISTS materiales;
DROP TABLE IF EXISTS perfiles;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS empresas;
DROP TABLE IF EXISTS roles;

-- Tabla de roles para definir los permisos de los usuarios
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL -- ej: 'usuario', 'administrador'
);

-- Insertar roles por defecto en el orden correcto.
INSERT INTO roles (name) VALUES ('usuario'), ('supervisor'), ('administrador');

-- Tabla de empresas
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL,
    cuit VARCHAR(20) UNIQUE,
    direccion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar empresas de ejemplo
INSERT INTO empresas (nombre, cuit, direccion) VALUES
('Prueba - Empresa Principal', '30-11111111-1', 'Calle Falsa 123'),
('Prueba - Cliente Secundario SA', '30-22222222-2', 'Avenida Siempreviva 742'),
('Prueba - Taller Tercero', '30-33333333-3', 'Bulevar de los Sueños Rotos 456');

-- Tabla de usuarios para autenticación
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'activo', -- Estados: pendiente, activo, inactivo. Activo por defecto para pruebas.
    role_id INTEGER NOT NULL DEFAULT 1, -- Por defecto, el rol es 'usuario'
    empresa_id INTEGER NOT NULL, -- Cada usuario debe pertenecer a una empresa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT
);

-- Insertar usuarios de desarrollo con contraseñas específicas
-- admin@europol.com (pass: adm), supervisor@europol.com (pass: sup), usuario@europol.com (pass: ope)
INSERT INTO usuarios (email, password_hash, status, role_id, empresa_id) VALUES
('adm@europol.com', 'adm', 'activo', 3, 1), -- pass: adm
('sup@europol.com', 'sup', 'activo', 2, 1), -- pass: sup
('ope@europol.com', 'ope', 'activo', 1, 2); -- pass: ope

-- Tabla de perfiles para información adicional del usuario
CREATE TABLE perfiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    biografia TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Insertar perfiles para los usuarios de desarrollo
INSERT INTO perfiles (user_id, nombre, apellido, biografia) VALUES
(1, 'Admin', 'Principal', 'Administrador del sistema.'),
(2, 'Super', 'Visor', 'Supervisor de la plataforma.'),
(3, 'Opera', 'Dor', 'Usuario de operaciones estándar.');

-- Índices para mejorar el rendimiento de las búsquedas
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_perfiles_user_id ON perfiles(user_id);
CREATE INDEX idx_usuarios_role_id ON usuarios(role_id);
CREATE INDEX idx_usuarios_empresa_id ON usuarios(empresa_id);

-- Tablas para el dominio del negocio: Fabricación de Bolsas

-- Tabla de materiales
CREATE TABLE materiales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT
);

-- Insertar materiales de ejemplo
INSERT INTO materiales (nombre, descripcion) VALUES
('Prueba - Polietileno de Alta Densidad (PEAD)', 'Material resistente y ligero, comúnmente usado para bolsas de supermercado.'),
('Prueba - Polietileno de Baja Densidad (PEBD)', 'Material flexible y transparente, ideal para bolsas de boutique.'),
('Prueba - Polipropileno (PP)', 'Material brillante y claro, resistente a la grasa.'),
('Prueba - Material Compostable (PLA)', 'Alternativa ecológica derivada de recursos renovables como el almidón de maíz.');

-- Tabla de dibujos o diseños
CREATE TABLE dibujos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    codigo_diseno VARCHAR(50) UNIQUE,
    user_id INTEGER NOT NULL, -- Columna para el dueño del dibujo
    ruta_archivo_imagen VARCHAR(255),
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE(user_id, nombre) -- Un usuario no puede tener dos dibujos con el mismo nombre
);

-- Tabla principal de productos (bolsas)
CREATE TABLE productos_bolsas (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE, -- Se permite que sea NULL si no se especifica
    nombre_producto VARCHAR(255) NOT NULL,
    empresa_id INTEGER, -- Si es NULL, es un producto general. Si tiene un ID, es para una empresa específica.
    created_by_user_id INTEGER NOT NULL,
    modified_by_user_id INTEGER,
    material_id INTEGER NOT NULL,
    dibujo_id INTEGER, -- Puede ser nulo si la bolsa es lisa
    ancho_cm NUMERIC(10, 2) NOT NULL,
    alto_cm NUMERIC(10, 2) NOT NULL,
    fuelle_cm NUMERIC(10, 2),
    espesor_micrones INTEGER,
    color VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (created_by_user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (modified_by_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL, -- Si se borra la empresa, el producto se vuelve general
    FOREIGN KEY (material_id) REFERENCES materiales(id),
    FOREIGN KEY (dibujo_id) REFERENCES dibujos(id) ON DELETE SET NULL
);

-- Insertar productos de ejemplo (asociados al usuario con ID 3)
INSERT INTO productos_bolsas (nombre_producto, sku, created_by_user_id, material_id, ancho_cm, alto_cm, color) VALUES
('Prueba - Bolsa Camiseta Mercado', 'SKU-001', 3, 1, 40, 50, 'Blanco'),
('Prueba - Bolsa Boutique Regalo', 'SKU-002', 3, 2, 30, 40, 'Negro'),
('Prueba - Saco Transparente Alimento', 'SKU-003', 3, 3, 25, 35, 'Transparente'),
('Prueba - Bolsa Ecológica Compostable', 'SKU-004', 3, 4, 35, 45, 'Verde'),
('Prueba - Bolsa Residuos Consorcio', 'SKU-005', 3, 1, 80, 110, 'Negro');

-- Trigger para actualizar automáticamente el campo updated_at en cada modificación
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_productos_bolsas_updated_at
BEFORE UPDATE ON productos_bolsas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Tabla para registrar eventos de auditoría
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER,
    user_role VARCHAR(50),
    details JSONB, -- Usamos JSONB para almacenar detalles flexibles
    created_at TIMESTAMPTZ DEFAULT NOW()
);
