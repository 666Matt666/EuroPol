const nodemailer = require('nodemailer');

let transporter;

async function getTransporter() {
  if (transporter) {
    return transporter;
  }

  // Para producción, usarías credenciales SMTP reales (ej. de SendGrid, Gmail)
  // guardadas de forma segura en variables de entorno.
  if (process.env.NODE_ENV === 'production') {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Para desarrollo, usamos una cuenta de Gmail con una contraseña de aplicación.
    // ¡¡¡IMPORTANTE!!! Reemplaza estos valores con tus credenciales.
    // NO subas estas credenciales a un repositorio público.
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true para 465, false para otros puertos
      auth: {
        // Tu dirección de correo de Gmail
        user: process.env.EMAIL_USER || 'mdibella@gmail.com',
        // La contraseña de aplicación de 16 letras que generaste
        pass: process.env.EMAIL_PASS || '66Matt66',
      },
      tls: {
        // No hacer esto en producción, solo para desarrollo con Gmail
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
}

/**
 * Envía correos de notificación sobre un nuevo registro de usuario.
 * @param {object} newUser - El objeto del usuario recién creado.
 * @param {string[]} adminEmails - Un array con los correos de los administradores.
 */
async function sendNewUserAlert(newUser, adminEmails) {
  try {
    const mailer = await getTransporter();

    // Correo para los administradores
    if (adminEmails && adminEmails.length > 0) {
      const infoAdmins = await mailer.sendMail({
        from: '"Sistema EuroPol" <no-reply@europol.com>',
        to: adminEmails.join(', '),
        subject: 'Nuevo Usuario Registrado Pendiente de Aprobación',
        html: `
          <p>Un nuevo usuario se ha registrado en el sistema y está pendiente de aprobación:</p>
          <ul>
            <li><b>Nombre:</b> ${newUser.nombre} ${newUser.apellido}</li>
            <li><b>Email:</b> ${newUser.email}</li>
            <li><b>Empresa:</b> ${newUser.empresa_nombre}</li>
          </ul>
          <p>Por favor, ingrese al panel de administración para revisar y aprobar la solicitud.</p>
        `,
      });
      console.log('Correo de notificación a administradores enviado.');
    }

    // Correo para el nuevo usuario
    const infoUser = await mailer.sendMail({
      from: '"Sistema EuroPol" <no-reply@europol.com>',
      to: newUser.email,
      subject: '¡Bienvenido a EuroPol! Tu registro está siendo revisado',
      html: `
        <p>Hola ${newUser.nombre},</p>
        <p>Gracias por registrarte en EuroPol. Tu solicitud ha sido recibida y está pendiente de aprobación por un administrador.</p>
        <p>Recibirás una notificación tan pronto como tu cuenta sea activada.</p>
      `,
    });
    console.log('Correo de bienvenida al usuario enviado.');
  } catch (error) {
    console.error('Error al enviar los correos de notificación:', error);
  }
}

/**
 * Envía un correo de notificación cuando una cuenta es activada.
 * @param {object} activatedUser - El objeto del usuario activado (debe tener email y nombre).
 */
async function sendAccountActivationAlert(activatedUser) {
  try {
    const mailer = await getTransporter();

    await mailer.sendMail({
      from: '"Sistema EuroPol" <no-reply@europol.com>',
      to: activatedUser.email,
      subject: '¡Tu cuenta en EuroPol ha sido activada!',
      html: `
        <p>Hola ${activatedUser.nombre},</p>
        <p>¡Buenas noticias! Tu cuenta en EuroPol ha sido aprobada por un administrador y ya está activa.</p>
        <p>Ya puedes iniciar sesión con tu email y contraseña.</p>
        <p>¡Bienvenido!</p>
      `,
    });
    console.log(`Correo de activación enviado a ${activatedUser.email}.`);
  } catch (error) {
    console.error('Error al enviar el correo de activación:', error);
  }
}

module.exports = { sendNewUserAlert, sendAccountActivationAlert };