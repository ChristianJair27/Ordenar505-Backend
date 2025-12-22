const db = require("../config/database");

// GET /api/cash/balance
exports.getCashBalance = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT total FROM cash_balance LIMIT 1");
    res.status(200).json({ success: true, total: rows[0]?.total || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al obtener el balance de caja" });
  }
};

// POST /api/cash/admin-movement  (ingreso/retiro manual)
exports.adminCashMovement = async (req, res) => {
  const { type, amount, description } = req.body;
  const user_id = req.user.id; // cajero/administrador autenticado
  const moment = require("moment-timezone");
  const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

  console.log("BODY(admin):", req.body);
  console.log("USUARIO DEL TOKEN(admin):", req.user);

  if (!["retiro", "ingreso"].includes(type)) {
    return res.status(400).json({ success: false, message: "Tipo inválido" });
  }
  if (typeof amount !== "number" || isNaN(amount)) {
    return res.status(400).json({ success: false, message: "Monto inválido" });
  }

  // ingresos/retiros manuales NO tienen mesero
  const waiter_id = null;

  try {
    await db.query(
      `
      INSERT INTO cash_register (date, type, amount, payment_method, order_id, description, user_id, waiter_id)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
    `,
      [date, type, amount, "caja", description || type.toUpperCase(), user_id, waiter_id]
    );

    // actualizar balance
    const adjustment = type === "ingreso" ? amount : -amount;
    await db.query("UPDATE cash_balance SET total = total + ?", [adjustment]);

    res.status(201).json({ success: true, message: "Movimiento registrado correctamente" });
  } catch (error) {
    console.error("Error en adminCashMovement:", error);
    res.status(500).json({ success: false, message: "Error al registrar el movimiento" });
  }
};

// POST /api/cash/register-with-shift  (venta asociada a orden y turno)
exports.registerCashMovementWithShift = async (req, res) => {
  const { type, amount, payment_method, order_id, description } = req.body;
  const cashierId = req.user.id; // cajero que confirma
  const moment = require("moment-timezone");
  const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

  try {
    console.log("BODY(register-with-shift):", req.body);
    console.log("USUARIO DEL TOKEN(register-with-shift):", req.user);

    if (!type || typeof amount !== "number") {
      return res.status(400).json({ success: false, message: "Tipo y monto son requeridos" });
    }

    // 1) turno activo (último activo del sistema)
    const [shiftResult] = await db.query(
      "SELECT id FROM shifts WHERE status = 'activo' ORDER BY start_time DESC LIMIT 1"
    );
    if (shiftResult.length === 0) {
      return res.status(400).json({ success: false, message: "No hay un turno activo en el sistema" });
    }
    const shiftId = shiftResult[0].id;

    // 2) resolver MESERO (dueño) desde orders.user_id si hay order_id
    let waiterId = null;
    if (order_id) {
      const [[ord]] = await db.query("SELECT user_id FROM orders WHERE id = ? LIMIT 1", [order_id]);
      waiterId = ord?.user_id ?? null;
      if (type === "venta" && !waiterId) {
        return res.status(400).json({ success: false, message: "La orden no tiene mesero (user_id) asignado" });
      }
    }

    // 3) insertar movimiento con ambos IDs
    const [ins] = await db.query(
      `
      INSERT INTO cash_register (date, type, amount, payment_method, order_id, description, user_id, waiter_id, shift_id)
      VALUES (?,    ?,    ?,      ?,              ?,        ?,           ?,        ?,         ?)
    `,
      [
        date,
        type,
        amount,
        payment_method || (type === "venta" ? "efectivo" : "caja"),
        order_id || null,
        description || (type === "venta" ? `Venta (orden #${order_id})` : type.toUpperCase()),
        cashierId,  // cajero (quien cobra)
        waiterId,   // mesero (dueño de la orden)
        shiftId,
      ]
    );

    // 4) balance
    if (type === "venta" || type === "ingreso") {
      await db.query("UPDATE cash_balance SET total = total + ?", [amount]);
    } else if (type === "retiro") {
      await db.query("UPDATE cash_balance SET total = total - ?", [amount]);
    }

    // 5) devolver lo insertado para verificación rápida
    const [[row]] = await db.query(
      "SELECT id, type, order_id, user_id AS cashier_id, waiter_id, shift_id, amount FROM cash_register WHERE id = ?",
      [ins.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Movimiento registrado y asociado al turno",
      data: row,
    });
  } catch (error) {
    console.error("❌ Error al registrar movimiento con turno:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};
