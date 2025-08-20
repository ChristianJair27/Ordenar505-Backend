const createHttpError = require("http-errors");
const db = require("../config/database");
const moment = require("moment-timezone");

const addOrder = async (req, res, next) => {
  const conn = await db.getConnection(); // mysql2/promise pool
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
    
    const paymentMethodSafe = paymentMethod ?? null;
    const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

    await conn.beginTransaction();

    // 1) Crear la orden
    const [result] = await conn.execute(
      `INSERT INTO orders
        (name, phone, guests, order_status, order_date, total, tax, total_with_tax, table_id, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerDetails?.name ?? null,
        customerDetails?.phone ?? null,
        customerDetails?.guests ?? 1,
        orderStatus,            // ej. 'open' / 'pendiente'
        date,
        bills?.total ?? 0,
        bills?.tax ?? 0,
        bills?.totalWithTax ?? 0,
        tableId,
        paymentMethodSafe,
      
      ]
    );

    const orderId = result.insertId;

    // 2) Actualizar items
    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          `INSERT INTO order_items (order_id, item_name, quantity, price)
           VALUES (?, ?, ?, ?)`,
          [orderId, item.name, item.quantity, item.price]
        );
      }
    }

    // 3) Marcar mesa con la orden actual (solo si hay mesa)
    if (tableId) {
      await conn.execute(
  `UPDATE \`tables\`
      SET current_order_id = ?, status = 'Ocupado'
    WHERE id = (SELECT table_id FROM orders WHERE id = ?)`,
  [orderId, orderId]
);
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Order created!",
      data: { orderId },
    });
  } catch (error) {
    try { await conn.rollback(); } catch (_) {}
    next(error);
  } finally {
    conn.release();
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[order]] = await db.execute(
      `SELECT o.*, t.table_no
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.id = ?`,
      [id]
    );

    if (!order) return next(createHttpError(404, "Order not found!"));

    const [items] = await db.execute(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [id]
    );

    const fullOrder = { ...order, items, table: { table_no: order.table_no } };

    res.status(200).json({ success: true, data: fullOrder });
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
        return { ...order, items, table: { table_no: order.table_no } };
      })
    );

    res.status(200).json({ success: true, data: ordersWithItems });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    const { orderStatus = "pagado", paymentMethod } = req.body;

    await conn.beginTransaction();

    // 1) Actualiza estado de la orden
    const [result] = await conn.execute(
      `UPDATE orders
          SET order_status = ?, payment_method = ?
        WHERE id = ?`,
      [orderStatus, paymentMethod || null, id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return next(createHttpError(404, "Order not found!"));
    }

    // 2) Si está pagado, libera la mesa y limpia current_order_id
    if (orderStatus === "pagado") {
  await conn.execute(
    `UPDATE \`tables\`
        SET status = 'Disponible', current_order_id = NULL
      WHERE id = (SELECT table_id FROM orders WHERE id = ?)`,
    [id]
  );
}

    await conn.commit();

    res.status(200).json({ success: true, message: "Order updated" });
  } catch (error) {
    try { await conn.rollback(); } catch (_) {}
    next(error);
  } finally {
    conn.release();
  }
};

const getCashMovements = async (req, res, next) => {
  try {
    const [movements] = await db.execute(`
      SELECT 
        cr.id, cr.date, cr.type, cr.amount, cr.payment_method, cr.description,
        cr.order_id, cr.shift_id,
        u.name AS user_name, t.table_no
      FROM cash_register cr
      LEFT JOIN users u   ON cr.user_id = u.id
      LEFT JOIN orders o  ON cr.order_id = o.id
      LEFT JOIN tables t  ON o.table_id = t.id
      ORDER BY cr.date DESC
    `);

    res.status(200).json(movements);
  } catch (error) {
    next(error);
  }
};

module.exports = { addOrder, getOrderById, getOrders, updateOrder, getCashMovements };
