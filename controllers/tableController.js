/*const Table = require("../models/tableModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose")

const addTable = async (req, res, next) => {
  try {
    const { tableNo, seats } = req.body;
    if (!tableNo) {
      const error = createHttpError(400, "Please provide table No!");
      return next(error);
    }
    const isTablePresent = await Table.findOne({ tableNo });

    if (isTablePresent) {
      const error = createHttpError(400, "Table already exist!");
      return next(error);
    }

    const newTable = new Table({ tableNo, seats });
    await newTable.save();
    res
      .status(201)
      .json({ success: true, message: "Table added!", data: newTable });
  } catch (error) {
    next(error);
  }
};

const getTables = async (req, res, next) => {
  try {
    const tables = await Table.find().populate({
      path: "currentOrder",
      select: "customerDetails"
    });
    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
};

const updateTable = async (req, res, next) => {
  try {
    const { status, orderId } = req.body;

    const { id } = req.params;

    if(!mongoose.Types.ObjectId.isValid(id)){
        const error = createHttpError(404, "Invalid id!");
        return next(error);
    }

    const table = await Table.findByIdAndUpdate(
        id,
      { status, currentOrder: orderId },
      { new: true }
    );

    if (!table) {
      const error = createHttpError(404, "Table not found!");
      return error;
    }

    res.status(200).json({success: true, message: "Table updated!", data: table});

  } catch (error) {
    next(error);
  }
};

module.exports = { addTable, getTables, updateTable }; */









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
  try {
    const connection = await db.getConnection();

    const [tables] = await connection.execute(`
      SELECT t.*, o.name AS customer_name, o.phone AS customer_phone
      FROM tables t
      LEFT JOIN orders o ON t.current_order_id = o.id
    `);

    res.status(200).json({
      success: true,
      data: tables
    });

    connection.release();

  } catch (error) {
    console.error("❌ Error en getTables:", error);
    res.status(500).json({
      success: false,
      message: "Error interno al obtener las mesas",
      error: error.message
    });
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

module.exports = {
  addTable,
  getTables,
  updateTable
};