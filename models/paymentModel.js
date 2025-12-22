/*const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    paymentId: String,
    orderId: String,
    amount: Number,
    currency: String,
    status: String,
    method: String,
    email: String,
    contact: String,
    createdAt: Date
})

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;*/



const connectDB = require('../config/database');

// Crear un nuevo registro de pago
async function createPayment(paymentData) {
    const connection = await connectDB();

    const sql = `
        INSERT INTO payments (
            payment_id, order_id, amount, currency,
            status, method, email, contact
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(sql, [
        paymentData.payment_id,
        paymentData.order_id,
        paymentData.amount,
        paymentData.currency,
        paymentData.status,
        paymentData.method,
        paymentData.email,
        paymentData.contact
    ]);

    return result.insertId;
}

// Obtener pagos por order_id
async function getPaymentsByOrder(orderId) {
    const connection = await connectDB();

    const [rows] = await connection.execute(
        `SELECT * FROM payments WHERE order_id = ?`,
        [orderId]
    );

    return rows;
}

module.exports = {
    createPayment,
    getPaymentsByOrder
};
