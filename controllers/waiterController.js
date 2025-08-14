// controllers/waiter.js
const db = require("../config/database");

// Cambia si tu columna de timestamp es otra (ej. created_at)
const COL_TS = "date";

// Qué tipos cuentan como venta: usa lo que tengas en DB
const SALES_TYPES = ["venta", "ingreso"]; // <-- si realmente usas 'venta', deja ["venta"]

async function getTodayStatsFromCash(req, res) {
  const waiterId = req.user?.id || req.query.waiter_id;
  if (!waiterId) {
    return res.status(400).json({ success: false, message: "waiter_id requerido" });
  }

  // offset horario, p.ej. "-06:00"; si no te late, fija "-06:00"
  const tz = req.query.tz || "-06:00";

  let conn;
  try {
    conn = await db.getConnection();

    // Armamos lista de tipos para IN (evita inyección)
    const typePlaceholders = SALES_TYPES.map(() => "?").join(",");

    const [rows] = await conn.execute(
      `
      SELECT 
        ? AS waiter_id,
        -- si order_id viene NULL, cuenta filas
        COUNT(DISTINCT COALESCE(order_id, CONCAT('row:', id))) AS orders_count,
        COALESCE(SUM(amount), 0) AS revenue
      FROM cash_register
      WHERE user_id = ?
        AND type IN (${typePlaceholders})
        -- Compara "hoy" en tu TZ: convierte la columna a tz local y compara la fecha con "ahora" en esa misma tz
        AND DATE(CONVERT_TZ(${COL_TS}, @@session.time_zone, ?)) = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', ?))
      `,
      [
        waiterId,               // SELECT ... AS waiter_id
        waiterId,               // WHERE user_id = ?
        ...SALES_TYPES,         // IN (...)
        tz, tz                  // dos veces para CONVERT_TZ
      ]
    );

    const data = rows?.[0] || { waiter_id: Number(waiterId), orders_count: 0, revenue: 0 };
    return res.json({ success: true, data });
  } catch (e) {
    console.error("getTodayStatsFromCash error:", e);
    return res.status(500).json({ success: false, message: "Error interno" });
  } finally {
    conn?.release?.();
  }
}

module.exports = { getTodayStatsFromCash };
