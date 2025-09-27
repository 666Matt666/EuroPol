-- Script de inicialización para la base de datos EuroPol

-- Borrar tablas existentes en el orden correcto para evitar errores de dependencia
DROP TABLE IF EXISTS productos_bolsas;
DROP TABLE IF EXISTS perfiles;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS empresas;
DROP TABLE IF EXISTS roles;

-- Tabla de roles para definir los permisos de los usuarios
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL -- ej: 'usuario', 'administrador'
);

-- Insertar roles por defecto. Es importante que 'usuario' tenga id=1.
INSERT INTO roles (name) VALUES ('usuario'), ('administrador');

-- Tabla de empresas
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL,
    cuit VARCHAR(20) UNIQUE,
    direccion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de usuarios para autenticación
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pendiente', -- Estados: pendiente, activo, inactivo
    role_id INTEGER NOT NULL DEFAULT 1, -- Por defecto, el rol es 'usuario'
    empresa_id INTEGER NOT NULL, -- Cada usuario debe pertenecer a una empresa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT
);

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

-- Tabla de dibujos o diseños
CREATE TABLE dibujos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) UNIQUE NOT NULL,
    codigo_diseno VARCHAR(50) UNIQUE,
    ruta_archivo_imagen VARCHAR(255)
);

-- Tabla principal de productos (bolsas)
CREATE TABLE productos_bolsas (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE, -- Stock Keeping Unit, código único de producto
    nombre_producto VARCHAR(255) NOT NULL,
    material_id INTEGER NOT NULL,
    dibujo_id INTEGER, -- Puede ser nulo si la bolsa es lisa
    ancho_cm NUMERIC(10, 2) NOT NULL,
    alto_cm NUMERIC(10, 2) NOT NULL,
    fuelle_cm NUMERIC(10, 2),
    espesor_micrones INTEGER,
    color VARCHAR(50),
    FOREIGN KEY (material_id) REFERENCES materiales(id),
    FOREIGN KEY (dibujo_id) REFERENCES dibujos(id)
);
