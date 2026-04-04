// controllers/waiter.js
const db = require("../config/database");
const moment = require("moment-timezone");

// Ajusta si tu columna datetime tiene otro nombre
const COL_TS = "date";
// Sólo ventas cuentan para propina/ingreso del mesero
const SALES_TYPES = ["venta"];
const TIPS_PCT = 0.03;

async function getTodayStatsFromCash(req, res) {
  try {
    const waiterId = Number(req.user?.id ?? req.query.waiter_id);
    if (!waiterId) {
      return res.status(400).json({ success: false, message: "waiter_id requerido" });
    }

    // Ventana del día en CDMX [00:00, 23:59:59]
    const start = moment().tz("America/Mexico_City").startOf("day").format("YYYY-MM-DD HH:mm:ss");
    const end   = moment().tz("America/Mexico_City").endOf("day").format("YYYY-MM-DD HH:mm:ss");

    // Métodos de pago considerados tarjeta
    const CARD_METHODS = ['tarjeta', 'card', 'credito', 'debito', 'tc', 'td'];

    // Query: ventas del día para ese mesero con desglose efectivo/tarjeta
    const [rows] = await db.query(
      `
      SELECT
        COUNT(DISTINCT order_id)                                                   AS orders_count,
        COALESCE(SUM(amount), 0)                                                   AS revenue,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method,'')) IN (${CARD_METHODS.map(() => '?').join(',')}) THEN amount ELSE 0 END), 0) AS card_revenue,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method,'')) NOT IN (${CARD_METHODS.map(() => '?').join(',')}) THEN amount ELSE 0 END), 0) AS cash_revenue
      FROM cash_register
      WHERE waiter_id = ?
        AND type IN (?)
        AND ${COL_TS} BETWEEN ? AND ?
      `,
      [...CARD_METHODS, ...CARD_METHODS, waiterId, SALES_TYPES, start, end]
    );

    const orders_count  = Number(rows?.[0]?.orders_count  || 0);
    const revenue       = Number(rows?.[0]?.revenue       || 0);
    const card_revenue  = Number(rows?.[0]?.card_revenue  || 0);
    const cash_revenue  = Number(rows?.[0]?.cash_revenue  || 0);
    const kitchen_tips  = +(revenue * TIPS_PCT).toFixed(2);

    return res.status(200).json({
      success: true,
      data: { orders_count, revenue, card_revenue, cash_revenue, kitchen_tips }
    });
  } catch (e) {
    console.error("getTodayStatsFromCash error:", e);
    return res.status(500).json({ success: false, message: "Error interno" });
  }
}

async function getShiftStatsFromCash(req, res) {
  try {
    const waiterId = Number(req.user?.id ?? req.query.waiter_id);
    let shiftId = req.query.shift_id ? Number(req.query.shift_id) : null;

    if (!waiterId) {
      return res.status(400).json({ success: false, message: "waiter_id requerido" });
    }

    // Si no viene shift_id, buscamos el turno abierto más reciente
    if (!shiftId) {
      const [srows] = await db.query(
        `SELECT id FROM shifts WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1`
      );
      shiftId = srows?.[0]?.id ?? null;
      if (!shiftId) {
        return res.status(404).json({ success: false, message: "No hay turno activo" });
      }
    }

    // 🔴 OJO: IN (?) con mysql2 — el array se pasa en cada IN
    const [rows] = await db.query(
      `
      SELECT
        COUNT(DISTINCT order_id) AS orders_count,
        COALESCE(SUM(CASE WHEN type IN (?) THEN amount ELSE 0 END), 0) AS revenue
      FROM cash_register
      WHERE waiter_id = ?
        AND shift_id  = ?
        AND type IN (?)
      `,
      [SALES_TYPES, waiterId, shiftId, SALES_TYPES]
    );

    const orders_count = Number(rows?.[0]?.orders_count || 0);
    const revenue = Number(rows?.[0]?.revenue || 0);
    const kitchen_tips = +(revenue * TIPS_PCT).toFixed(2);

    return res.json({ success: true, data: { orders_count, revenue, kitchen_tips, shift_id: shiftId } });
  } catch (e) {
    console.error("getShiftStatsFromCash error:", e);
    return res.status(500).json({ success: false, message: "Error interno" });
  }
}

module.exports = { getTodayStatsFromCash, getShiftStatsFromCash };
