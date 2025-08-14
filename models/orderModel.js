    /*const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    customerDetails: {
        name: { type: String, required: true },
        phone: { type: String, requried: true},
        guests: { type: Number, required: true },
    },
    orderStatus: {
        type: String,
        required: true
    },
    orderDate: {
        type: Date,
        default : Date.now()
    },
    bills: {
        total: { type: Number, required: true },
        tax: { type: Number, required: true },
        totalWithTax: { type: Number, required: true }
    },
    items: [],
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    paymentMethod: String,
    paymentData: {
        razorpay_order_id: String,
        razorpay_payment_id: String
    }
}, { timestamps : true } );

module.exports = mongoose.model("Order", orderSchema);  */








const pool = require('../config/database');

// Crear una nueva orden con transacción
async function createOrder(orderData, items) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [orderResult] = await connection.execute(`
            INSERT INTO orders 
            (customer_name, customer_phone, guests, order_status, total, tax, total_with_tax, table_id, payment_method, razorpay_order_id, razorpay_payment_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            orderData.customer_name,
            orderData.customer_phone,
            orderData.guests,
            orderData.order_status,
            orderData.total,
            orderData.tax,
            orderData.total_with_tax,
            orderData.table_id,
            orderData.payment_method,
            orderData.razorpay_order_id,
            orderData.razorpay_payment_id
        ]);

        const orderId = orderResult.insertId;

        for (const item of items) {
            await connection.execute(`
                INSERT INTO order_items (order_id, item_name, quantity, price)
                VALUES (?, ?, ?, ?)
            `, [orderId, item.name, item.quantity, item.price]);
        }

        await connection.commit();
        return orderId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Obtener orden por ID con sus items
async function getOrderById(id) {
    const [orders] = await pool.execute(`SELECT * FROM orders WHERE id = ?`, [id]);
    const [items] = await pool.execute(`SELECT * FROM order_items WHERE order_id = ?`, [id]);

    return {
        ...orders[0],
        items
    };
}

module.exports = {
    createOrder,
    getOrderById
};