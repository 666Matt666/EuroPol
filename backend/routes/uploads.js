const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('./auth');

// Configuración de Multer para guardar los archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Los archivos se guardarán en la carpeta 'public/uploads/dibujos'
    cb(null, 'public/uploads/dibujos');
  },
  filename: function (req, file, cb) {
    // Generamos un nombre de archivo único para evitar colisiones
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

/**
 * POST /api/uploads/dibujo
 * Endpoint para subir una imagen de un dibujo.
 * Se protege con autenticación para que solo usuarios logueados puedan subir archivos.
 * El middleware 'upload.single('dibujo')' procesa el archivo enviado en el campo 'dibujo'.
 */
router.post('/dibujo', authenticateToken, upload.single('dibujo'), (req, res) => {
  if (!req.file) { // req.file es donde multer deja el archivo procesado
    return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
  }

  // Devolvemos la ruta pública del archivo guardado
  const filePath = `/uploads/dibujos/${req.file.filename}`;
  res.status(201).json({ filePath });
});

module.exports = router;