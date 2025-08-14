  /*const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
    tableNo: { type: Number, required: true, unique: true },
    status: {
        type: String,
        default: "Available"
    },
    seats: { 
        type: Number,
        required: true
    },
    currentOrder: {type: mongoose.Schema.Types.ObjectId, ref: "Order"}
});

module.exports = mongoose.model("Table", tableSchema); */








const pool = require('../config/database');

// Crear una nueva mesa
async function createTable({ table_no, status = 'Available', seats }) {
    const sql = `INSERT INTO tables (table_no, status, seats) VALUES (?, ?, ?)`;
    const [result] = await pool.execute(sql, [table_no, status, seats]);

    return result.insertId;
}

// Obtener mesa por número
async function getTableByNumber(tableNo) {
    const sql = `SELECT * FROM tables WHERE table_no = ?`;
    const [rows] = await pool.execute(sql, [tableNo]);

    return rows[0];
}

// Actualizar estado y orden actual
async function updateTableStatusAndOrder(tableId, status, orderId) {
    const sql = `UPDATE tables SET status = ?, current_order_id = ? WHERE id = ?`;
    await pool.execute(sql, [status, orderId, tableId]);
}

module.exports = {
    createTable,
    getTableByNumber,
    updateTableStatusAndOrder
};