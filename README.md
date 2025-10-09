# Proyecto EuroPol

Este proyecto es una aplicación web completa (Full-Stack) diseñada para la gestión de usuarios y empresas, con un enfoque en la administración de productos (bolsas de distintos materiales, medidas y diseños). Incluye un sistema de autenticación basado en JWT, gestión de roles (administrador/usuario), un flujo de aprobación de usuarios con notificaciones por correo electrónico y una interfaz de usuario moderna y responsiva construida con Vue.js y Bootstrap.

## Características Principales

*   **Gestión de Usuarios:**
    *   Registro de nuevos usuarios con estado `pendiente`.
    *   Login de usuarios con autenticación JWT.
    *   Listado de usuarios con detalles (nombre, email, estado, rol, empresa).
    *   Funcionalidades de administrador: Aprobar/Desactivar usuarios, cambiar roles, editar perfiles y eliminar usuarios.
    *   Notificaciones por email a administradores y al usuario tras el registro.
    *   Notificaciones por email al usuario cuando su cuenta es activada.
*   **Gestión de Empresas:**
    *   ABM (Alta, Baja, Modificación) de empresas.
    *   Listado de empresas.
*   **Roles y Permisos:**
    *   Roles definidos (`usuario`, `administrador`).
    *   Acceso restringido a funcionalidades de administración solo para usuarios con rol `administrador`.
*   **Interfaz de Usuario (Frontend):**
    *   Diseño responsivo y moderno con Bootstrap.
    *   Navegación persistente (Navbar) con enlaces condicionales según el rol del usuario.
    *   Dashboard principal para administradores.
    *   Formularios estilizados y consistentes.
*   **Backend Robusto:**
    *   API RESTful construida con Node.js y Express.js.
    *   Base de datos PostgreSQL.
    *   Manejo seguro de contraseñas (bcrypt).
    *   Variables de entorno para credenciales sensibles (`.env`).
*   **Gestión de Productos (Bolsas):**
    *   Estructura de base de datos para `materiales`, `dibujos` y `productos_bolsas` (material, medidas, diseño, color, etc.).

## Tecnologías Utilizadas

### Backend
*   **Node.js:** Entorno de ejecución JavaScript.
*   **Express.js:** Framework web para Node.js.
*   **PostgreSQL:** Sistema de gestión de bases de datos relacionales.
*   **`pg`:** Cliente de PostgreSQL para Node.js.
*   **`bcryptjs`:** Librería para el hashing de contraseñas.
*   **`jsonwebtoken` (JWT):** Para la autenticación basada en tokens.
*   **`nodemailer`:** Para el envío de correos electrónicos.
*   **`dotenv`:** Para la gestión de variables de entorno.
*   **`cors`:** Middleware para habilitar Cross-Origin Resource Sharing.

### Frontend
*   **Vue.js (Vue 3):** Framework progresivo para construir interfaces de usuario.
*   **Vue Router:** Para la gestión de rutas en la aplicación de una sola página (SPA).
*   **Axios:** Cliente HTTP para realizar peticiones a la API del backend.
*   **Bootstrap 5:** Framework CSS para diseño responsivo y componentes de UI.
*   **ESLint:** Herramienta de linting para mantener la calidad del código JavaScript/Vue.

### Herramientas y Otros
*   **Git:** Sistema de control de versiones.
*   **GitHub:** Plataforma para alojar repositorios de código.

## Estructura del Proyecto

```
EuroPol/
├── backend/
│   ├── db.js                   # Configuración de la conexión a la base de datos
│   ├── index.js                # Punto de entrada del servidor Express
│   ├── .env.example            # Ejemplo de archivo de variables de entorno (NO SUBIR .env)
│   ├── middleware/
│   │   ├── auth.js             # Middleware de autenticación JWT y autorización por rol
│   │   └── errorHandler.js     # Middleware centralizado para manejo de errores
│   ├── routes/
│   │   ├── empresas.js         # Rutas para la gestión de empresas (CRUD)
│   │   ├── roles.js            # Rutas para obtener roles
│   │   └── users.js            # Rutas para la gestión de usuarios (CRUD, login, registro)
│   ├── services/
│   │   └── emailService.js     # Servicio para el envío de correos electrónicos
│   ├── package.json            # Dependencias y scripts del backend
│   └── package-lock.json
├── frontend/
│   ├── public/                 # Archivos estáticos (index.html)
│   ├── src/
│   │   ├── assets/
│   │   │   └── global.css      # Estilos CSS globales personalizados
│   │   ├── components/
│   │   │   ├── apiService.js   # Cliente Axios para interactuar con el backend
│   │   │   ├── NavBar.vue      # Componente de barra de navegación principal
│   │   │   ├── UserForm.vue    # Formulario reutilizable para usuarios
│   │   │   └── UserList.vue    # Componente para mostrar la lista de usuarios
│   │   ├── authStore.js        # Almacén de estado para la autenticación (Vue 3 Composition API)
│   │   ├── App.vue             # Componente raíz de la aplicación Vue
│   │   ├── EmpresaManagementView.vue # Vista para la gestión de empresas
│   │   ├── HomeView.vue        # Dashboard principal post-login
│   │   ├── index.js            # Configuración del Vue Router
│   │   ├── LoginView.vue       # Vista para el inicio de sesión
│   │   ├── main.js             # Punto de entrada de la aplicación Vue
│   │   ├── UserCreateView.vue  # Vista para el registro de nuevos usuarios
│   │   └── UserManagementView.vue # Vista para la gestión de usuarios
│   ├── package.json            # Dependencias y scripts del frontend
│   └── package-lock.json
├── init.sql                    # Script SQL para inicializar la base de datos (tablas, roles, etc.)
└── .gitignore                  # Archivos y carpetas ignorados por Git
```

## Configuración y Ejecución

### 1. Base de Datos (PostgreSQL)

1.  Asegúrate de tener PostgreSQL instalado y funcionando.
2.  Crea una base de datos llamada `europol`.
3.  Ejecuta el script `init.sql` en tu base de datos `europol` para crear las tablas y datos iniciales.

    ```bash
    psql -U postgres -d europol -f init.sql
    ```
    (Reemplaza `postgres` con tu usuario de PostgreSQL si es diferente).

### 2. Backend

1.  Navega a la carpeta `backend`:
    ```bash
    cd backend
    ```
2.  Instala las dependencias:
    ```bash
    npm install
    ```
3.  Crea un archivo `.env` en la raíz de la carpeta `backend` (al mismo nivel que `package.json`) y configura tus variables de entorno. Puedes usar `.env.example` como plantilla.

    ```properties
    # .env
    PORT=3000

    # Configuración de la Base de Datos PostgreSQL
    DB_USER=postgres
    DB_HOST=localhost
    DB_NAME=europol
    DB_PASSWORD=password
    DB_PORT=5432

    # Credenciales para el envío de correos con Gmail (requiere Contraseña de Aplicación)
    EMAIL_USER="tu-email-real@gmail.com"
    EMAIL_PASS="tu-contraseña-de-aplicacion-de-16-letras"

    # Clave secreta para firmar los tokens JWT (debe ser larga y compleja)
    JWT_SECRET="una_clave_secreta_muy_larga_y_segura_para_produccion_12345!"
    ```
    **¡IMPORTANTE!** Para `EMAIL_USER` y `EMAIL_PASS`, asegúrate de usar tu email de Gmail y una **Contraseña de Aplicación** generada por Google (no tu contraseña normal).

4.  Inicia el servidor:
    ```bash
    node index.js
    ```
    El servidor debería estar escuchando en `http://localhost:3000`.

### 3. Frontend

1.  Navega a la carpeta `frontend`:
    ```bash
    cd frontend
    ```
2.  Instala las dependencias:
    ```bash
    npm install
    ```
3.  Inicia la aplicación Vue:
    ```bash
    npm run serve
    ```
    La aplicación debería abrirse en tu navegador, probablemente en `http://localhost:8080`.

## Uso de la Aplicación

1.  **Registro:** Puedes registrar nuevos usuarios desde la página de login.
2.  **Login:** Inicia sesión con un usuario existente.
3.  **Dashboard:** Los usuarios administradores serán redirigidos a un dashboard con enlaces a "Gestionar Usuarios" y "Gestionar Empresas". Los usuarios normales verán un panel básico.
4.  **Gestión:** Explora las funcionalidades de ABM para usuarios y empresas.

---