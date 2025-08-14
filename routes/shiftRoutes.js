// routes/shift.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/verifyToken");

const {
  startShift,
  endShift,
  getCurrentShift,
  getAllShifts,
  getShiftSummary,
  getTurnoActual,
  getActiveShift,
  getActiveShiftByUser,
} = require("../controllers/shiftController");

// Abrir / Cerrar turno
router.post("/start", verifyToken, startShift);
router.post("/end", verifyToken, endShift);

// Info rápida del turno activo (sin totales)
router.get("/current", verifyToken, getCurrentShift);
router.get("/shifts/active", verifyToken, getActiveShift);
router.get("/shifts/active/:userId", verifyToken, getActiveShiftByUser);

// 👇 Endpoint que usa Home.jsx para mostrar "Ventas del Turno"
router.get("/turno-actual", verifyToken, getTurnoActual);

// Listado de turnos y corte
router.get("/shifts", verifyToken, getAllShifts);
router.get("/shifts/:id/corte", verifyToken, getShiftSummary);

// (Opcional) Alias legacy, pero mismo handler
// router.get("/turno-actual/venta-total", verifyToken, getTurnoActual);

module.exports = router;
