const express = require('express');
const router = express.Router();
const dishController = require('../controllers/dishController');
const upload = require('../middlewares/multerConfig');

// GET todos
router.get('/', dishController.getDishes);

// POST nuevo platillo (con subida de archivo)
router.post('/', upload.single('image'), dishController.addDish);

// PUT actualizar (también soporta nueva imagen)
router.put('/:id', upload.single('image'), dishController.updateDish);

module.exports = router;