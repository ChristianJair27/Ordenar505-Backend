// routes/waiter.js
const router = require("express").Router();
const { getTodayStatsFromCash } = require("../controllers/waiterController");


console.log("getTodayStatsFromCash typeof:", typeof getTodayStatsFromCash);

// Si usas auth, puedes ignorar el query y leer req.user.id en el controller
router.get("/waiter/today-stats", getTodayStatsFromCash);

module.exports = router;
