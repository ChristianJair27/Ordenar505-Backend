
const createHttpError = require("http-errors");
const {
  createTable,
  getTableByNumber,
  updateTableStatusAndOrder
} = require("../models/tableModel");
const db = require("../config/database");

// Añadir nueva mesa
const addTable = async (req, res, next) => {
  try {
    const { table_no, seats } = req.body;

    if (!table_no || !seats) {
      return next(createHttpError(400, "Table number and seats are required"));
    }

    const existing = await getTableByNumber(table_no);
    if (existing) {
      return next(createHttpError(400, "Table already exists!"));
    }

    const tableId = await createTable({ table_no, seats });

    res.status(201).json({
      success: true,
      message: "Table added!",
      data: { id: tableId, table_no, seats }
    });

  } catch (error) {
    next(error);
  }
};

// Obtener todas las mesas con datos de la orden actual (si existe)

const getTables = async (req, res, next) => {
  let connection;
  try {
    connection = await db.getConnection();

    const [tables] = await connection.execute(`
      SELECT 
        t.id,
        t.table_no,
        t.seats,
        t.status,
        t.current_order_id,
        o.id AS order_id,
        o.total,
        o.total_with_tax,
        o.order_date,
        o.user_id AS waiter_id,
        u.name AS waiter_name,
        o.name AS customer_name,
        o.phone AS customer_phone,
        TIMESTAMPDIFF(MINUTE, o.order_date, NOW()) AS minutes_occupied
      FROM tables t
      LEFT JOIN orders o ON t.current_order_id = o.id
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY t.table_no ASC
    `);

    // Opcional: formatear un poco los datos antes de enviar
    const formattedTables = tables.map(table => ({
      ...table,
      total: Number(table.total || 0),
      total_with_tax: Number(table.total_with_tax || 0),
      minutes_occupied: table.minutes_occupied || 0,
      waiter_name: table.waiter_name || "Sin mesero",
    }));

    res.status(200).json({
      success: true,
      data: formattedTables,
    });

  } catch (error) {
    console.error("❌ Error en getTables:", error);
    next(createHttpError(500, "Error al obtener las mesas"));
  } finally {
    if (connection) connection.release();
  }
};

// Actualizar estado y orden actual de una mesa
const updateTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, order_id } = req.body;

    if (!id) {
      return next(createHttpError(400, "Missing table ID"));
    }

    await updateTableStatusAndOrder(id, status, order_id || null);

    res.status(200).json({
      success: true,
      message: "Table updated"
    });

  } catch (error) {
    next(error);
  }
};


// 🔥 Eliminar mesa
const deleteTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(createHttpError(400, "Missing table ID"));
    }

    const conn = await db.getConnection();

    // 1) Verifica existencia + estado actual
    const [rows] = await conn.execute(
      "SELECT id, status, current_order_id FROM tables WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      conn.release();
      return next(createHttpError(404, "Table not found"));
    }

    const table = rows[0];
    const status = String(table.status ?? "").trim().toLowerCase();

    // Conjunto de estados que consideramos "ocupado/en uso"
    const busySet = new Set(["ocupado", "ocupada", "occupied", "busy", "booked", "en uso", "en-uso"]);

    if (table.current_order_id || busySet.has(status)) {
      conn.release();
      return next(createHttpError(409, "Table is in use; cannot be deleted"));
    }

    // 2) Borra
    await conn.execute("DELETE FROM tables WHERE id = ?", [id]);
    conn.release();

    return res.status(200).json({
      success: true,
      message: "Table deleted"
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addTable,
  getTables,
  updateTable,
  deleteTable
};