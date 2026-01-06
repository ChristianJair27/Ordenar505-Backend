const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Middleware de autenticación si lo usas en otras rutas (ej: kioskAuth)
//const { protect } = require('../Middlewares/kioskAuth'); // ajusta si tienes otro nombre

// Puedes proteger estas rutas o no, según quieras que solo admins las vean
router.get('/sales-summary', reportController.getSalesSummary);
router.get('/top-dishes', reportController.getTopDishes);
router.get('/payment-methods', reportController.getPaymentMethods);

router.get('/top-waiters', reportController.getTopWaiters);
router.get('/sales-by-hour', reportController.getSalesByHour);
router.get('/comparison', reportController.getComparison);
router.get('/top-kitchen-tips', reportController.getTopKitchenTips);
router.post('/ai-analysis', reportController.getAIAnalysis);

module.exports = router;