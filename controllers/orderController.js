    /*const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");

const addOrder = async (req, res, next) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res
      .status(201)
      .json({ success: true, message: "Order created!", data: order });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    const order = await Order.findById(id);
    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().populate("table");
    res.status(200).json({ data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { orderStatus },
      { new: true }
    );

    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res
      .status(200)
      .json({ success: true, message: "Order updated", data: order });
  } catch (error) {
    next(error);
  }
};

module.exports = { addOrder, getOrderById, getOrders, updateOrder };*/









const createHttpError = require("http-errors");
const db = require("../config/database");

const addOrder = async (req, res, next) => {
  try {
    const {
      customerDetails,
      orderStatus,
      bills,
      items,
      table,
      paymentMethod,
      paymentData,
    } = req.body;

    const tableId = Number.isInteger(table) ? table : null;
    const razorpayOrderId = paymentData?.razorpay_order_id ?? null;
    const razorpayPaymentId = paymentData?.razorpay_payment_id ?? null;
    const paymentMethodSafe = paymentMethod ?? null;
    const moment = require("moment-timezone");
const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

    const [result] = await db.execute(
      `INSERT INTO orders (name, phone, guests, order_status, order_date, total, tax, total_with_tax, table_id, payment_method, razorpay_order_id, razorpay_payment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerDetails.name,
        customerDetails.phone,
        customerDetails.guests,
        
        orderStatus,
        date,
        bills.total,
        bills.tax,
        bills.totalWithTax,
        tableId,
        paymentMethodSafe,
        razorpayOrderId,
        razorpayPaymentId,
      ]
    );

    const orderId = result.insertId;

    // Insertar items
    for (const item of items) {
      await db.execute(
        `INSERT INTO order_items (order_id, item_name, quantity, price) VALUES (?, ?, ?, ?)`,
        [orderId, item.name, item.quantity, item.price]
      );
    }

    res.status(201).json({
      success: true,
      message: "Order created!",
      data: { orderId },
    });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Obtener orden con número de mesa
    const [[order]] = await db.execute(
      `SELECT o.*, t.table_no 
       FROM orders o 
       LEFT JOIN tables t ON o.table_id = t.id 
       WHERE o.id = ?`,
      [id]
    );

    if (!order) {
      return next(createHttpError(404, "Order not found!"));
    }

    // Obtener items de la orden
    const [items] = await db.execute(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [id]
    );

    // Construir respuesta
    const fullOrder = {
      ...order,
      items,
      table: { table_no: order.table_no },
    };

    res.status(200).json({
      success: true,
      data: fullOrder,
    });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const [orders] = await db.execute(`
      SELECT o.*, t.table_no 
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      ORDER BY o.order_date DESC
    `);

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await db.execute(
          `SELECT * FROM order_items WHERE order_id = ?`,
          [order.id]
        );
        return {
          ...order,
          items,
          table: { table_no: order.table_no },
        };
      })
    );

    res.status(200).json({ success: true, data: ordersWithItems });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orderStatus = "pagado", paymentMethod } = req.body;

    const [result] = await db.execute(
      `UPDATE orders SET order_status = ?, payment_method = ? WHERE id = ?`,
      [orderStatus, paymentMethod || null, id]
    );

    if (orderStatus === "pagado") {
  await db.execute(
    `UPDATE tables 
     SET status = 'Available' 
     WHERE id = (SELECT table_id FROM orders WHERE id = ?)`,
    [id]
  );
}

    if (result.affectedRows === 0) {
      return next(createHttpError(404, "Order not found!"));
    }

    res.status(200).json({
      success: true,
      message: "Order updated",
    });
  } catch (error) {
    next(error);
  }
};



const getCashMovements = async (req, res, next) => {
  try {
    const [movements] = await db.execute(`
      SELECT 
        cr.id,
        cr.date,
        cr.type,
        cr.amount,
        cr.payment_method,
        cr.description,
        cr.order_id,
        cr.shift_id,
        u.name AS user_name,
        t.table_no
      FROM cash_register cr
      LEFT JOIN users u ON cr.user_id = u.id
      LEFT JOIN orders o ON cr.order_id = o.id
      LEFT JOIN tables t ON o.table_id = t.id
      ORDER BY cr.date DESC
    `);

    res.status(200).json(movements);
  } catch (error) {
    next(error);
  }
};


module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  getCashMovements
};