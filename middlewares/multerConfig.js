const multer = require('multer');
const path = require('path');

// Dónde guardar y cómo nombrar los archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/dishes/');   // ¡asegúrate que esta carpeta exista!
  },
  filename: function (req, file, cb) {
    // Ejemplo: timestamp + nombre original → evita sobreescrituras
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Filtro: solo imágenes
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo (ajusta si quieres)
  fileFilter: fileFilter
});

module.exports = upload;