const db = require("../config/database");
const createHttpError = require("http-errors");

const addCashMovement = async (req, res, next) => {
  try {
    const { type, amount, payment_method, order_id, description, user_id } = req.body;
const moment = require("moment-timezone");
const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");
    // Validaciones básicas
    if (!type || !amount) {
      throw createHttpError(400, "Tipo y monto son requeridos");
    }

    // Verificar turno activo para transacciones de venta
    if (type === 'venta') {
      // Buscar cualquier turno activo (sin importar el usuario)
    const [[activeShift]] = await db.execute(
      `SELECT id FROM shifts 
       WHERE status = 'activo'
       ORDER BY start_time DESC LIMIT 1`
    );

    if (!activeShift && type === 'venta') {
      throw createHttpError(400, "No hay un turno activo en el sistema");
    }

      // Registrar movimiento con turno
      await db.execute(
        `INSERT INTO cash_register (
          type, amount, payment_method, order_id, 
          description, user_id, shift_id, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          type, 
          amount, 
          payment_method || 'efectivo',
          order_id || null, 
          description || `Venta ${order_id ? 'orden #'+order_id : ''}`,
          user_id,
          activeShift.id,
          date
        ]
      );
    } else {
      // Para otros tipos de movimiento (entrada/salida)
      await db.execute(
        `INSERT INTO cash_register (
          type, amount, payment_method, description, 
          user_id, date
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          type,
          amount,
          payment_method || null,
          description || `${type === 'entrada' ? 'Ingreso' : 'Egreso'} de caja`,
          user_id || null,
          date
        ]
      );
    }

    // Actualizar balance de caja
    const adjustment = type === "venta" || type === "entrada" 
      ? +amount 
      : -amount;

    await db.query("UPDATE cash_balance SET total = total + ?", [adjustment]);

    res.status(201).json({ 
      success: true, 
      message: "Movimiento registrado correctamente"
    });
  } catch (err) {
    console.error("Error en cash_register:", err);
    next(err);
  }
};

const getCashMovements = async (req, res, next) => {
  try {
    const { shift_id } = req.query;
    
    let query = `
      SELECT cr.*, u.name as user_name, s.start_time as shift_start
      FROM cash_register cr
      LEFT JOIN users u ON cr.user_id = u.id
      LEFT JOIN shifts s ON cr.shift_id = s.id
    `;
    
    const params = [];
    
    if (shift_id) {
      query += " WHERE cr.shift_id = ?";
      params.push(shift_id);
    }
    
    query += " ORDER BY cr.date DESC";
    
    const [movements] = await db.execute(query, params);
    
    res.status(200).json({ 
      success: true, 
      data: movements 
    });
  } catch (err) {
    next(err);
  }
};


module.exports = { 
  addCashMovement, 
  getCashMovements 
};