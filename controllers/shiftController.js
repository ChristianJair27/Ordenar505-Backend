const db = require("../config/database");

exports.startShift = async (req, res) => {
  const userId = req.user.id;
  const moment = require("moment-timezone");
  const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

  try {
    const [existing] = await db.query(
      "SELECT * FROM shifts WHERE user_id = ? AND status = 'activo'",
      [userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Ya tienes un turno activo" });
    }

    const [result] = await db.query(
      "INSERT INTO shifts (user_id, start_time) VALUES (?, ?)",
      [userId, date]
    );

    res.json({ message: "Turno iniciado", shiftId: result.insertId });
  } catch (err) {
    console.error("Error al iniciar turno:", err);
    res.status(500).json({ message: "Error al iniciar turno" });
  }
};

exports.endShift = async (req, res) => {
  const userId = req.user.id;
  const moment = require("moment-timezone");
  const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

  try {
    const [result] = await db.query(
      "UPDATE shifts SET end_time = ?, status = 'cerrado' WHERE user_id = ? AND status = 'activo'",
      [date, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "No hay turno activo" });
    }

    res.json({ message: "Turno cerrado" });
  } catch (err) {
    console.error("Error al cerrar turno:", err);
    res.status(500).json({ message: "Error al cerrar turno" });
  }
};

// En tu controlador (shiftController.js)
exports.getCurrentShift = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM shifts 
      WHERE user_id = ? AND status = 'activo' 
      ORDER BY start_time DESC 
      LIMIT 1
    `, [req.user.id]);

    if (rows.length === 0) {
      // Devuelve 200 con mensaje en lugar de 404
      return res.status(200).json({ 
        success: true, 
        turno_abierto: false,
        message: 'No hay turno activo' 
      });
    }

    res.json({ 
      success: true,
      turno_abierto: true,
      data: rows[0] 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};


exports.getActiveShift = async (req, res) => {
  try {
    const [shift] = await db.execute(
      `SELECT * FROM shifts WHERE status = 'activo' 
       ORDER BY start_time DESC LIMIT 1`
    );
    res.json({ success: true, data: shift[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActiveShiftByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const [shift] = await db.execute(
      `SELECT * FROM shifts 
       WHERE status = 'activo' AND user_id = ?
       ORDER BY start_time DESC LIMIT 1`,
      [userId]
    );
    res.json({ success: true, data: shift[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllShifts = async (req, res) => {
  try {
    const [shifts] = await db.query(
      "SELECT * FROM shifts ORDER BY start_time DESC"
    );
    res.json(shifts);
  } catch (err) {
    console.error("Error al obtener turnos:", err);
    res.status(500).json({ message: "Error al obtener turnos" });
  }
};


exports.getShiftSummary = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Datos básicos del turno
    const [[shift]] = await db.execute(
      `SELECT s.id, s.start_time as inicio, s.end_time as cierre, u.name as cajero
       FROM shifts s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (!shift) return res.status(404).json({ message: "Turno no encontrado" });

    // 2. Cálculo de totales
    const [[totals]] = await db.execute(
      `SELECT 
         SUM(CASE WHEN type = 'venta' AND payment_method = 'efectivo' THEN amount ELSE 0 END) as totalEfectivo,
         SUM(CASE WHEN type = 'venta' AND payment_method = 'tarjeta' THEN amount ELSE 0 END) as totalTarjeta,
         COUNT(CASE WHEN type = 'venta' AND payment_method = 'efectivo' THEN 1 END) as countEfectivo,
         COUNT(CASE WHEN type = 'venta' AND payment_method = 'tarjeta' THEN 1 END) as countTarjeta,
         SUM(CASE WHEN type = 'venta' THEN amount ELSE 0 END) as totalVentas,
         SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END) as ingresos,
         SUM(CASE WHEN type = 'salida' THEN amount ELSE 0 END) as egresos,
         COUNT(*) as movimientos
       FROM cash_register
       WHERE shift_id = ?`,
      [id]
    );

    res.status(200).json({
      ...shift,
      totalOrdenes: totals.totalVentas || 0,
      totalEfectivo: totals.totalEfectivo || 0,
      totalTarjeta: totals.totalTarjeta || 0,
      countEfectivo: totals.countEfectivo || 0,
      countTarjeta: totals.countTarjeta || 0,
      ingresos: totals.ingresos || 0,
      egresos: totals.egresos || 0,
      total: (totals.ingresos || 0) - (totals.egresos || 0),
      movimientos: totals.movimientos || 0,
      ordenes: totals.countEfectivo + totals.countTarjeta || 0
    });
  } catch (error) {
    next(error);
  }
};


// Ajusta si también cuentas otros tipos (ej. 'entrada')
const SALES_TYPES = ["venta"]; // ["venta","entrada"] si aplica


exports.getTurnoActual = async (req, res, next) => {
  try {
    const [[shift]] = await db.execute(`
      SELECT id, user_id, start_time, end_time, status
      FROM shifts
      WHERE status = 'activo' OR end_time IS NULL
      ORDER BY id DESC
      LIMIT 1
    `);

    if (!shift) {
      return res.json({
        data: {
          turno_abierto: false,
          total_ventas: 0,
          total_ordenes: 0,
          hora_inicio: null,
          shift_id: null,           // 👈 NUEVO
        },
      });
    }

    const [rows] = await db.execute(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS total_ventas,
        COUNT(DISTINCT COALESCE(order_id, CONCAT('row:', id))) AS total_ordenes
      FROM cash_register
      WHERE type IN ('venta') AND shift_id = ?
      `,
      [shift.id]
    );

    const agg = rows?.[0] || { total_ventas: 0, total_ordenes: 0 };

    return res.json({
      data: {
        turno_abierto: true,
        total_ventas: Number(agg.total_ventas) || 0,
        total_ordenes: Number(agg.total_ordenes) || 0,
        hora_inicio: shift.start_time,
        shift_id: shift.id,        // 👈 NUEVO
      },
    });
  } catch (err) {
    next(err);
  }
};



