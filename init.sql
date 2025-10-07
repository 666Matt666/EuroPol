-- Script de inicialización para la base de datos EuroPol
-- Versión robustecida con orden de borrado y datos de prueba.

-- Borrar tablas existentes en el orden correcto para evitar errores de dependencia
DROP TABLE IF EXISTS factura_items;
DROP TABLE IF EXISTS facturas;
DROP TABLE IF EXISTS presupuesto_items;
DROP TABLE IF EXISTS presupuestos;
-- Primero las que dependen de otras, y al final las tablas maestras.
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS productos_bolsas;
DROP TABLE IF EXISTS dibujos;
DROP TABLE IF EXISTS perfiles;
DROP TABLE IF EXISTS usuarios;
-- Las tablas maestras se borran al final
DROP TABLE IF EXISTS materiales;
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
    status VARCHAR(50) NOT NULL DEFAULT 'pendiente_verificacion', -- Estados: pendiente_verificacion, pendiente, activo, inactivo.
    role_id INTEGER NOT NULL DEFAULT 1, -- Por defecto, el rol es 'operador'
    empresa_id INTEGER NOT NULL, -- Cada usuario debe pertenecer a una empresa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verification_code TEXT,
    verification_expires TIMESTAMPTZ,
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
    descripcion TEXT,
    origen VARCHAR(50), -- 'Virgen', 'Reciclado Post-Industrial', etc.
    es_imprimible BOOLEAN NOT NULL DEFAULT false -- Indica si el material está tratado para impresión.
);

-- Insertar materiales de ejemplo
INSERT INTO materiales (nombre, descripcion, origen, es_imprimible) VALUES
('Prueba - Polietileno de Alta Densidad (PEAD)', 'Material resistente y ligero, comúnmente usado para bolsas de supermercado.', 'Virgen', true),
('Prueba - Polietileno de Baja Densidad (PEBD)', 'Material flexible y transparente, ideal para bolsas de boutique.', 'Virgen', true),
('Prueba - Polipropileno (PP)', 'Material brillante y claro, resistente a la grasa.', 'Virgen', false),
('Prueba - Material Compostable (PLA)', 'Alternativa ecológica derivada de recursos renovables como el almidón de maíz.', 'Renovable', true);

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
    precio_base NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Precio base del producto
    peso_unitario_gr NUMERIC(10, 2), -- Peso de una sola bolsa, para cálculos de costo y logística.
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
INSERT INTO productos_bolsas (nombre_producto, sku, created_by_user_id, material_id, ancho_cm, alto_cm, color, precio_base, empresa_id) VALUES
('Prueba - Bolsa Camiseta Mercado (General)', 'SKU-001', 1, 1, 40, 50, 'Blanco', 0.15, NULL), -- Producto general creado por admin
('Prueba - Bolsa Boutique Regalo (Cliente 2)', 'SKU-002', 3, 2, 30, 40, 'Negro', 0.25, 2), -- Producto para la empresa del usuario 'ope'
('Prueba - Saco Transparente Alimento (Cliente 2)', 'SKU-003', 3, 3, 25, 35, 'Transparente', 0.10, 2), -- Producto para la empresa del usuario 'ope'
('Prueba - Bolsa Ecológica Compostable (General)', 'SKU-004', 2, 4, 35, 45, 'Verde', 0.30, NULL), -- Producto general creado por supervisor
('Prueba - Bolsa Residuos Consorcio (Cliente 1)', 'SKU-005', 1, 1, 80, 110, 'Negro', 0.50, 1); -- Producto para la empresa principal

-- Trigger para actualizar automáticamente el campo updated_at en cada modificación

-- Tablas para la Gestión de Presupuestos

-- Tabla de encabezados de presupuestos
CREATE TABLE presupuestos (
    id SERIAL PRIMARY KEY,
    codigo_presupuesto VARCHAR(50) UNIQUE, -- Ej: PRE-2024-0001
    cliente_empresa_id INTEGER NOT NULL, -- La empresa a la que se le hace el presupuesto
    created_by_user_id INTEGER NOT NULL, -- El usuario que creó el presupuesto
    status VARCHAR(50) NOT NULL DEFAULT 'borrador', -- borrador, enviado, aprobado, rechazado
    fecha_vencimiento DATE, -- Fecha de validez de la oferta
    notas TEXT, -- Notas generales del presupuesto
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (cliente_empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabla de ítems de cada presupuesto
CREATE TABLE presupuesto_items (
    id SERIAL PRIMARY KEY,
    presupuesto_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(12, 2) NOT NULL, -- Precio del producto en el momento de presupuestar
    descripcion_item TEXT, -- Para notas específicas del ítem
    FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos_bolsas(id) ON DELETE RESTRICT -- No se puede borrar un producto si está en un presupuesto
);

-- Tabla para registrar eventos de auditoría
-- Tablas para la Gestión de Facturas

-- Tabla de encabezados de facturas
CREATE TABLE facturas (
    id SERIAL PRIMARY KEY,
    codigo_factura VARCHAR(50) UNIQUE, -- Ej: FAC-2024-0001
    cliente_empresa_id INTEGER NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    presupuesto_ids TEXT, -- Almacena un array de IDs de presupuestos (como JSON string)
    codigos_presupuestos TEXT, -- Almacena un array de códigos de presupuestos (como JSON string)
    status VARCHAR(50) NOT NULL DEFAULT 'borrador', -- borrador, emitida, pagada, anulada
    fecha_emision TIMESTAMPTZ DEFAULT NOW(),
    fecha_vencimiento DATE,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (cliente_empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabla de ítems de cada factura
CREATE TABLE factura_items (
    id SERIAL PRIMARY KEY,
    factura_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(12, 2) NOT NULL,
    descripcion_item TEXT,
    origen_presupuesto_codigo VARCHAR(50), -- Para trazabilidad por ítem
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos_bolsas(id) ON DELETE RESTRICT
);

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER,
    user_role VARCHAR(50),
    details JSONB, -- Usamos JSONB para almacenar detalles flexibles
    created_at TIMESTAMPTZ DEFAULT NOW()
);
