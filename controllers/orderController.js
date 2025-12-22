const createHttpError = require("http-errors");
const db = require("../config/database");
const moment = require("moment-timezone");

const addOrder = async (req, res, next) => {
  let conn;
  try {
    conn = await db.getConnection(); // mysql2/promise pool

    const {
      customerDetails,
      orderStatus,
      bills,
      items,
      table,
      paymentMethod,
      paymentData, // (reservado, por si lo usas luego)
    } = req.body;

    // Normaliza table_id (acepta id directo o null)
    const tableId =
      Number.isInteger(table) ? table :
      Number.isInteger(req.body.table_id) ? req.body.table_id :
      null;

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
        orderStatus,
        date,
        bills?.total ?? 0,
        bills?.tax ?? 0,
        bills?.totalWithTax ?? 0,
        tableId,
        paymentMethodSafe,
        req.body.user_id ?? null, // mesero/creador
      ]
    );

    const orderId = result.insertId;

    // 2) Insertar items
    if (Array.isArray(items)) {
      for (const item of items) {
        await conn.execute(
          `INSERT INTO order_items (order_id, item_name, quantity, price)
           VALUES (?, ?, ?, ?)`,
          [orderId, item.name ?? "Artículo", Number(item.quantity ?? 1), Number(item.price ?? 0)]
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
    try { if (conn) await conn.rollback(); } catch (_) {}
    next(error);
  } finally {
    if (conn) conn.release();
  }
};

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
  let conn;
  try {
    conn = await db.getConnection();
    const { id } = req.params;
    const { op, items, orderStatus, paymentMethod } = req.body;

    await conn.beginTransaction();

    // 0) Asegúrate de que la orden exista
    const [[order]] = await conn.execute(
      "SELECT id, total, tax, total_with_tax FROM orders WHERE id = ?",
      [id]
    );
    if (!order) {
      await conn.rollback();
      return next(createHttpError(404, "Order not found!"));
    }

    // A) APENDIZAR ITEMS
    if (op === "appendItems") {
      if (!Array.isArray(items) || items.length === 0) {
        await conn.rollback();
        return next(createHttpError(400, "Items array is required"));
      }

      let deltaTotal = 0;
      for (const it of items) {
        const name = it.name ?? "Artículo";
        const qty = Number(it.quantity ?? 1);
        const price = Number(it.price ?? 0); // total del renglón
        deltaTotal += price;

        await conn.execute(
          `INSERT INTO order_items (order_id, item_name, quantity, price)
           VALUES (?, ?, ?, ?)`,
          [id, name, qty, price]
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

    // B) ACTUALIZAR ESTADO/PAGO
    const newStatus = orderStatus ?? null;
    const newPayment = paymentMethod ?? null;

    if (newStatus !== null || newPayment !== null) {
      const sets = [];
      const vals = [];
      if (newStatus !== null) { sets.push("order_status = ?"); vals.push(newStatus); }
      if (newPayment !== null) { sets.push("payment_method = ?"); vals.push(newPayment); }
      vals.push(id);

      await conn.execute(
        `UPDATE orders SET ${sets.join(", ")} WHERE id = ?`,
        vals
      );

      // Si marcaste pagado, libera mesa
      if (newStatus === "pagado") {
        await conn.execute(
          `UPDATE \`tables\`
              SET status = 'Disponible', current_order_id = NULL
            WHERE id = (SELECT table_id FROM orders WHERE id = ?)`,
          [id]
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


const assignWaiter = async (req, res, next) => {
  const orderId  = parseInt(req.params.id, 10);
  const waiterId = parseInt(req.body.waiter_id, 10);

  if (!Number.isInteger(orderId) || !Number.isInteger(waiterId)) {
    return res.status(400).json({ success: false, message: "IDs inválidos" });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1) Orden existe
    const [[ord]] = await conn.execute(
      "SELECT id, user_id, name FROM orders WHERE id = ?",
      [orderId]
    );
    if (!ord) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Orden no encontrada" });
    }

    // 2) Mesero válido
    const [[usr]] = await conn.execute(
      "SELECT id, name, role FROM users WHERE id = ?",
      [waiterId]
    );
    if (!usr) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Mesero no válido" });
    }
    if (!["mesero", "waiter", "cajero"].includes(usr.role)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "El usuario no es mesero" });
    }

    // 3) Actualiza: user_id y name (nombre de la orden = nombre del mesero)
    await conn.execute(
      "UPDATE orders SET user_id = ?, name = ? WHERE id = ?",
      [waiterId, usr.name, orderId]
    );

    await conn.commit();
    return res.json({
      success: true,
      message: "Mesero y nombre de la orden actualizados",
      data: { waiter_id: usr.id, waiter_name: usr.name, previous_order_name: ord.name }
    });
  } catch (e) {
    try { if (conn) await conn.rollback(); } catch (_) {}
    console.error("assignWaiter SQL:", e.code, e.sqlMessage || e.message, { orderId, waiterId });
    console.log("assign waiter error:", err?.response?.data); // 👈
    return res.status(500).json({ success: false, message: "Error al reasignar mesero" });
  } finally {
    if (conn) conn.release();
  }
};



const getKitchenOrdersPublic = async (req, res, next) => {
  try {
    // 1. Turno activo
    const [[shift]] = await db.execute(`
      SELECT start_time
      FROM shifts
      WHERE status = 'activo'
      ORDER BY start_time DESC
      LIMIT 1
    `);

    // Si no hay turno activo, cocina no muestra nada
    if (!shift?.start_time) {
      return res.json({ success: true, data: [] });
    }

    // 2. Órdenes del turno actual y NO pagadas
    const [orders] = await db.execute(`
      SELECT o.*,
             t.table_no
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.order_date >= ?
        AND LOWER(o.order_status) != 'pagado'
      ORDER BY o.order_date ASC
    `, [shift.start_time]);

    // 3. Items por orden
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await db.execute(
          `SELECT item_name, quantity FROM order_items WHERE order_id = ?`,
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






// 👇 Exporta TODO en un solo objeto (clave del fix)
module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  getCashMovements,
  assignWaiter,
   getKitchenOrdersPublic,
};
