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


// ✅ Público para la pantalla de cocina (SIN auth)
// Devuelve solo info mínima del turno activo
router.get("/kitchen/turno-actual", async (req, res) => {
  try {
    const db = require("../config/database");

    const [[shift]] = await db.execute(`
      SELECT id, user_id, start_time, end_time, status
      FROM shifts
      WHERE status = 'activo' OR end_time IS NULL
      ORDER BY id DESC
      LIMIT 1
    `);

    if (!shift) {
      return res.json({
        success: true,
        data: { turno_abierto: false, hora_inicio: null, shift_id: null },
      });
    }

    return res.json({
      success: true,
      data: {
        turno_abierto: true,
        hora_inicio: shift.start_time,
        shift_id: shift.id,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});


module.exports = router;
