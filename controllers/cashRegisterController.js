// controllers/cashRegisterController.js
const db = require("../config/database");
const createHttpError = require("http-errors");
const moment = require("moment-timezone");

const addCashMovement = async (req, res, next) => {
  try {
    const { type, amount, payment_method, order_id, description, shift_id } = req.body;
    const cashierId = req.body.cashier_id ?? req.body.user_id ?? null; // QUIEN COBRA (cajero)
    const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

    if (!type || !amount) {
      throw createHttpError(400, "Tipo y monto son requeridos");
    }

    // ====== turno activo ======
    let activeShiftId = null;
    if (type === "venta") {
      if (shift_id) {
        activeShiftId = shift_id;
      } else {
        const [[activeShift]] = await db.execute(
          `SELECT id FROM shifts WHERE status = 'activo' ORDER BY start_time DESC LIMIT 1`
        );
        if (!activeShift) throw createHttpError(400, "No hay un turno activo en el sistema");
        activeShiftId = activeShift.id;
      }
    }

    // ====== dueño (mesero) desde orders.user_id ======
    let waiterId = null;
    if (type === "venta" && order_id != null) {
      const [[ord]] = await db.execute(
        `SELECT id, user_id FROM orders WHERE id = ? LIMIT 1`,
        [Number(order_id)]
      );
      if (!ord) throw createHttpError(404, "Orden no encontrada para registrar la venta");
      waiterId = ord.user_id ?? null;
      if (!waiterId) throw createHttpError(400, "La orden no tiene mesero (user_id) asignado");
    }

    if (type === "venta") {
      const desc =
        (description || `Venta${order_id ? ` (orden #${order_id})` : ""}`) +
        (cashierId ? ` | Confirmado por Cajero ID ${cashierId}` : "");

      console.log("[cash_register] venta -> order_id:", order_id,
                  " waiter_id:", waiterId, " cashier_id:", cashierId,
                  " shift_id:", activeShiftId);

      // INSERT explícito con waiter_id
      const [ins] = await db.execute(
        `INSERT INTO cash_register
           (type, amount, payment_method, order_id, description, user_id, waiter_id, shift_id, date)
         VALUES (?,    ?,      ?,              ?,        ?,           ?,        ?,        ?,      ?)`,
        [
          type,
          amount,
          payment_method || "efectivo",
          Number(order_id) || null,
          desc,
          cashierId,     // cajero
          waiterId,      // mesero
          activeShiftId,
          date
        ]
      );

      // ✅ Verificar lo insertado
      const [[row]] = await db.execute(
        `SELECT id, user_id AS cashier_id, waiter_id, order_id
           FROM cash_register WHERE id = ?`,
        [ins.insertId]
      );

      return res.status(201).json({
        success: true,
        message: "Movimiento registrado correctamente",
        data: row, // te devuelve waiter_id para que lo veas en el front/log
      });
    }

    // entradas/salidas
    await db.execute(
      `INSERT INTO cash_register
         (type, amount, payment_method, description, user_id, date)
       VALUES (?,    ?,      ?,              ?,          ?,       ?)`,
      [
        type,
        amount,
        payment_method || null,
        description || `${type === "entrada" ? "Ingreso" : "Egreso"} de caja`,
        cashierId || null,
        date
      ]
    );

    res.status(201).json({ success: true, message: "Movimiento registrado correctamente" });
  } catch (err) {
    console.error("Error en cash_register:", err);
    next(err);
  }
};

const getCashMovements = async (req, res, next) => {
  try {
    const { shift_id } = req.query;

    let query = `
      SELECT 
        cr.*,
        u_cash.name AS cashier_name,   -- cajero (cr.user_id)
        u_wait.name AS waiter_name,    -- mesero (cr.waiter_id)
        s.start_time AS shift_start
      FROM cash_register cr
      LEFT JOIN users  u_cash ON cr.user_id   = u_cash.id
      LEFT JOIN users  u_wait ON cr.waiter_id = u_wait.id
      LEFT JOIN shifts s      ON cr.shift_id  = s.id
    `;
    const params = [];
    if (shift_id) { query += " WHERE cr.shift_id = ?"; params.push(shift_id); }
    query += " ORDER BY cr.date DESC";

    const [rows] = await db.execute(query, params);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { addCashMovement, getCashMovements };
