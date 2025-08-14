const db = require("../config/database");


// controllers/cashController.js
exports.getCashBalance = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT total FROM cash_balance LIMIT 1");
    res.status(200).json({ success: true, total: rows[0]?.total || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al obtener el balance de caja" });
  }
};

exports.adminCashMovement = async (req, res) => {
  const { type, amount, description } = req.body;
const user_id = req.user.id;
const moment = require("moment-timezone");
const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

 console.log("BODY:", req.body);
console.log("USUARIO DEL TOKEN:", req.user);

  if (!["retiro", "ingreso"].includes(type)) {
    return res.status(400).json({ success: false, message: "Tipo inválido" });
  }

  const adjustment = type === "ingreso" ? amount : -amount;

  try {
    await db.query(`
  INSERT INTO cash_register (type, amount, payment_method, order_id, description, user_id, date)
  VALUES (?, ?, ?, NULL, ?, ?, ?)
`, [type, amount, "caja", description, user_id, date]);

    await db.query("UPDATE cash_balance SET total = total + ?", [adjustment]);

    res.status(201).json({ success: true, message: "Movimiento registrado correctamente" });
  } catch (error) {
    console.error("Error en adminCashMovement:", error); // 👈 para debug
    res.status(500).json({ success: false, message: "Error al registrar el movimiento" });
  }
};






exports.registerCashMovementWithShift = async (req, res) => {
  const { type, amount, payment_method, order_id, description } = req.body;
  const userId = req.user.id; // Este es el ID del usuario con la sesión activa
  const moment = require("moment-timezone");
const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

  try {
    // Buscar turno activo (sin filtrar por usuario)
    const [shiftResult] = await db.query(
      "SELECT id, user_id FROM shifts WHERE status = 'activo' ORDER BY start_time DESC LIMIT 1"
    );

    if (shiftResult.length === 0) {
      return res.status(400).json({ success: false, message: "No hay un turno activo en el sistema" });
    }

    const shiftId = shiftResult[0].id;
    const shiftUserId = shiftResult[0].user_id; // Este es el ID del usuario asociado al turno

    // Insertar en cash_register con el user_id de la sesión (no el del turno)
    await db.query(`
      INSERT INTO cash_register (date, type, amount, payment_method, order_id, description, user_id, shift_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [date, type, amount, payment_method, order_id || null, description, userId, shiftId]);

    // Actualizar cash_balance si es ingreso/retiro
    if (type === "venta") {
      await db.query("UPDATE cash_balance SET total = total + ?", [amount]);
    }

    res.status(201).json({ 
      success: true, 
      message: "Movimiento registrado y asociado al turno", 
      shiftId,
      registeredBy: userId,
      shiftOwnedBy: shiftUserId
    });
  } catch (error) {
    console.error("❌ Error al registrar movimiento con turno:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

