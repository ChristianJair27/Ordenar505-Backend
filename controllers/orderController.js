const createHttpError = require("http-errors");
const db = require("../config/database");
const moment = require("moment-timezone");

/**
 * CREATE ORDER
 */
const addOrder = async (req, res, next) => {
  let conn;
  try {
    conn = await db.getConnection();

    const {
      customerDetails,
      orderStatus,
      bills,
      items,
      table,
      paymentMethod,
      paymentData, // reservado (solo una vez ✅)
    } = req.body;

    // Normaliza table_id
    const tableId =
      Number.isInteger(table)
        ? table
        : Number.isInteger(req.body.table_id)
          ? req.body.table_id
          : null;

    const paymentMethodSafe = paymentMethod ?? null;
    const date = moment().tz("America/Mexico_City").format("YYYY-MM-DD HH:mm:ss");

    await conn.beginTransaction();

    // 1) Crear la orden
    const [result] = await conn.execute(
      `INSERT INTO orders
        (name, phone, guests, order_status, order_date, total, tax, total_with_tax, table_id, payment_method, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerDetails?.name ?? null,
        customerDetails?.phone ?? null,
        customerDetails?.guests ?? 1,
        orderStatus ?? "pendiente",
        date,
        bills?.total ?? 0,
        bills?.tax ?? 0,
        bills?.totalWithTax ?? 0,
        tableId,
        paymentMethodSafe,
        req.body.user_id ?? null,
      ]
    );

    const orderId = result.insertId;

    // 2) Insertar items (incluye notes ✅)
    if (Array.isArray(items)) {
      for (const item of items) {
        const name = item?.name ?? item?.item_name ?? "Artículo";
        const qty = Number(item?.quantity ?? 1);
        const price = Number(item?.price ?? 0);
        const notes = (item?.notes ?? "").toString().trim() || null;

        await conn.execute(
          `INSERT INTO order_items (order_id, item_name, quantity, price, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId, name, qty, price, notes]
        );
      }
    }

    // 3) Marcar mesa ocupada
    if (tableId) {
      await conn.execute(
        `UPDATE \`tables\`
           SET current_order_id = ?, status = 'Ocupado'
         WHERE id = ?`,
        [orderId, tableId]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Order created!",
      data: { orderId },
    });
  } catch (error) {
    try { if (conn) await conn.rollback(); } catch (_) {}
    next(error);
  } finally {
    if (conn) conn.release();
  }
};

/**
 * GET ORDER BY ID (con items + notes ✅)
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[order]] = await db.execute(
      `SELECT o.*,
              t.table_no,
              u.id   AS waiter_id,
              u.name AS waiter_name
         FROM orders o
         LEFT JOIN tables t ON o.table_id = t.id
         LEFT JOIN users  u ON o.user_id  = u.id
        WHERE o.id = ?`,
      [id]
    );

    if (!order) return next(createHttpError(404, "Order not found!"));

    const [items] = await db.execute(
      `SELECT id, order_id, item_name, quantity, price, notes
         FROM order_items
        WHERE order_id = ?`,
      [id]
    );

    const fullOrder = { ...order, items, table: { table_no: order.table_no } };
    res.status(200).json({ success: true, data: fullOrder });
  } catch (error) {
    next(error);
  }
};

/**
 * GET ORDERS (con items + notes ✅)
 */
const getOrders = async (req, res, next) => {
  try {
    const [orders] = await db.execute(`
      SELECT o.*,
             t.table_no,
             u.id   AS waiter_id,
             u.name AS waiter_name
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN users  u ON o.user_id  = u.id
       ORDER BY o.order_date DESC
    `);

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await db.execute(
          `SELECT id, order_id, item_name, quantity, price, notes
             FROM order_items
            WHERE order_id = ?`,
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

/**
 * UPDATE ORDER
 * - op: "appendItems" agrega items (incluye notes ✅) y suma totales
 * - también puede actualizar status / payment_method
 */
const updateOrder = async (req, res, next) => {
  let conn;
  try {
    conn = await db.getConnection();
    const { id } = req.params;
    const { op, items, orderStatus, paymentMethod } = req.body;

    await conn.beginTransaction();

    const [[order]] = await conn.execute(
      "SELECT id, total, tax, total_with_tax, table_id FROM orders WHERE id = ?",
      [id]
    );

    if (!order) {
      await conn.rollback();
      return next(createHttpError(404, "Order not found!"));
    }

    // A) appendItems
    if (op === "appendItems") {
      if (!Array.isArray(items) || items.length === 0) {
        await conn.rollback();
        return next(createHttpError(400, "Items array is required"));
      }

      let deltaTotal = 0;

      for (const it of items) {
        const name = it?.name ?? it?.item_name ?? "Artículo";
        const qty = Number(it?.quantity ?? 1);
        const price = Number(it?.price ?? 0);
        const notes = (it?.notes ?? "").toString().trim() || null;

        deltaTotal += price;

        await conn.execute(
          `INSERT INTO order_items (order_id, item_name, quantity, price, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [id, name, qty, price, notes]
        );
      }

      const newTotal = Number(order.total || 0) + deltaTotal;
      const newTotalWithTax = Number(order.total_with_tax || 0) + deltaTotal;

      await conn.execute(
        `UPDATE orders
            SET total = ?, total_with_tax = ?
          WHERE id = ?`,
        [newTotal, newTotalWithTax, id]
      );

      await conn.commit();
      return res.status(200).json({
        success: true,
        message: "Items appended",
        data: { orderId: Number(id), deltaTotal },
      });
    }

    // B) actualizar status / payment
    const sets = [];
    const vals = [];

    if (orderStatus != null) {
      sets.push("order_status = ?");
      vals.push(orderStatus);
    }
    if (paymentMethod != null) {
      sets.push("payment_method = ?");
      vals.push(paymentMethod);
    }

    if (sets.length > 0) {
      vals.push(id);
      await conn.execute(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, vals);

      // si pagado => liberar mesa
      if (String(orderStatus).toLowerCase() === "pagado") {
        await conn.execute(
          `UPDATE \`tables\`
              SET status = 'Disponible', current_order_id = NULL
            WHERE id = ?`,
          [order.table_id]
        );
      }
    }

    await conn.commit();
    return res.status(200).json({ success: true, message: "Order updated" });
  } catch (error) {
    try { if (conn) await conn.rollback(); } catch (_) {}
    next(error);
  } finally {
    if (conn) conn.release();
  }
};

/**
 * CASH MOVEMENTS
 */
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

/**
 * ASSIGN WAITER
 */
const assignWaiter = async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const waiterId = parseInt(req.body.waiter_id, 10);

  if (!Number.isInteger(orderId) || !Number.isInteger(waiterId)) {
    return res.status(400).json({ success: false, message: "IDs inválidos" });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [[ord]] = await conn.execute(
      "SELECT id, user_id, name FROM orders WHERE id = ?",
      [orderId]
    );
    if (!ord) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Orden no encontrada" });
    }

    const [[usr]] = await conn.execute(
      "SELECT id, name, role FROM users WHERE id = ?",
      [waiterId]
    );
    if (!usr) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Mesero no válido" });
    }
    if (!["mesero", "waiter", "cajero"].includes(String(usr.role || "").toLowerCase())) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "El usuario no es mesero" });
    }

    await conn.execute(
      "UPDATE orders SET user_id = ?, name = ? WHERE id = ?",
      [waiterId, usr.name, orderId]
    );

    await conn.commit();
    return res.json({
      success: true,
      message: "Mesero y nombre de la orden actualizados",
      data: { waiter_id: usr.id, waiter_name: usr.name, previous_order_name: ord.name },
    });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch (_) {}
    console.error("assignWaiter error:", e.code, e.sqlMessage || e.message, { orderId, waiterId });
    return res.status(500).json({ success: false, message: "Error al reasignar mesero" });
  } finally {
    if (conn) conn.release();
  }
};

/**
 * KITCHEN PUBLIC (solo turno activo, no pagadas, items con notes ✅)
 */
const getKitchenOrdersPublic = async (req, res, next) => {
  try {
    const [[shift]] = await db.execute(`
      SELECT start_time
      FROM shifts
      WHERE status = 'activo'
      ORDER BY start_time DESC
      LIMIT 1
    `);

    if (!shift?.start_time) {
      return res.json({ success: true, data: [] });
    }

    const [orders] = await db.execute(
      `
      SELECT o.*,
             t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.order_date >= ?
        AND LOWER(o.order_status) != 'pagado'
      ORDER BY o.order_date ASC
      `,
      [shift.start_time]
    );

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await db.execute(
          `SELECT item_name, quantity, notes
             FROM order_items
            WHERE order_id = ?`,
          [order.id]
        );
        return { ...order, items, table: { table_no: order.table_no } };
      })
    );

    res.json({ success: true, data: ordersWithItems });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  getCashMovements,
  assignWaiter,
  getKitchenOrdersPublic,
};