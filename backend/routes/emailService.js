const nodemailer = require('nodemailer');

// Verificación crucial: Asegurarse de que las credenciales de email están definidas.
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Error: Las variables de entorno EMAIL_USER o EMAIL_PASS no están definidas. El servicio de correo no funcionará.');
  // No detenemos la aplicación, pero el servicio no será funcional.
}

// Configuración del "transporter" de Nodemailer usando las variables de entorno.
// Usamos un bloque try/catch para manejar el caso en que las variables no estén definidas.
let transporter;
try {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // --- INICIO: Solución para error de certificado ---
    // Esto es necesario en algunos entornos de desarrollo o detrás de proxies.
    // No usar en producción.
    tls: {
      rejectUnauthorized: false
    }
    // --- FIN: Solución para error de certificado ---
  });
  console.log('Servicio de email configurado correctamente.');
} catch (error) {
  console.error('Fallo al configurar el servicio de email. Revisa tus variables de entorno.', error);
  // Dejamos el transporter como null o indefinido para que las funciones fallen con un error claro.
  transporter = null;
}

/**
 * Envía una alerta a los administradores sobre un nuevo registro de usuario.
 * @param {object} newUser - El objeto del usuario recién creado.
 * @param {string[]} adminEmails - Un array de los correos de los administradores.
 */
const sendNewUserAlert = async (newUser, adminEmails) => {
  if (!transporter) {
    throw new Error('El servicio de email no está configurado. No se puede enviar el correo.');
  }
  if (!adminEmails || adminEmails.length === 0) {
    console.warn('*********************************************************************');
    console.warn('ADVERTENCIA: No se envió la notificación de nuevo usuario porque no se encontraron administradores en la base de datos.');
    console.warn('*********************************************************************');
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: adminEmails.join(', '), // Envía a todos los admins
    subject: 'Nuevo Usuario Registrado Pendiente de Aprobación',
    html: `
      <h1>Nuevo Usuario Registrado</h1>
      <p>Un nuevo usuario se ha registrado y está pendiente de aprobación.</p>
      <ul>
        <li><strong>Nombre:</strong> ${newUser.nombre} ${newUser.apellido}</li>
        <li><strong>Email:</strong> ${newUser.email}</li>
        <li><strong>Empresa:</strong> ${newUser.empresa_nombre || 'No especificada'}</li>
      </ul>
      <p>Por favor, inicia sesión en el panel de administración para revisar y aprobar la cuenta.</p>
    `,
  };

  console.log(`Intentando enviar alerta de nuevo usuario a: ${adminEmails.join(', ')}`);
  await transporter.sendMail(mailOptions);
  console.log('Alerta de nuevo usuario enviada exitosamente.');
};

/**
 * Envía una notificación al usuario cuando su cuenta ha sido activada.
 * @param {object} user - El objeto del usuario cuya cuenta fue activada.
 */
const sendAccountActivationAlert = async (user) => {
  if (!transporter) {
    throw new Error('El servicio de email no está configurado. No se puede enviar el correo.');
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: '¡Tu cuenta en EuroPol ha sido activada!',
    html: `
      <h1>¡Bienvenido a EuroPol, ${user.nombre}!</h1>
      <p>Nos complace informarte que tu cuenta ha sido aprobada por un administrador.</p>
      <p>Ya puedes iniciar sesión con tu correo y contraseña.</p>
      <p>Gracias por unirte a nosotros.</p>
    `,
  };

  console.log(`Intentando enviar email de activación a: ${user.email}`);
  await transporter.sendMail(mailOptions);
  console.log('Email de activación de cuenta enviado exitosamente.');
};

/**
 * Envía un email al usuario informando que su cuenta está pendiente de aprobación.
 * @param {object} newUser - El objeto del usuario recién creado.
 */
const sendPendingActivationEmail = async (newUser) => {
  if (!transporter) {
    throw new Error('El servicio de email no está configurado. No se puede enviar el correo.');
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: newUser.email,
    subject: 'Tu registro en EuroPol está pendiente de aprobación',
    html: `
      <h1>¡Gracias por registrarte en EuroPol, ${newUser.nombre}!</h1>
      <p>Hemos recibido tu solicitud de registro.</p>
      <p>Tu cuenta está actualmente pendiente de aprobación por un administrador. Recibirás otro correo electrónico una vez que tu cuenta haya sido activada.</p>
      <p>Gracias por tu paciencia.</p>
    `,
  };

  console.log(`Intentando enviar email de cuenta pendiente a: ${newUser.email}`);
  await transporter.sendMail(mailOptions);
  console.log('Email de cuenta pendiente enviado exitosamente.');
};

// --- EXPORTACIÓN CORRECTA ---
// Esto es lo más importante: nos aseguramos de que las funciones estén disponibles para otros archivos.
module.exports = {
  sendNewUserAlert,
  sendAccountActivationAlert,
  sendPendingActivationEmail,
};
