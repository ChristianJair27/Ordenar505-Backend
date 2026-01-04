// controllers/reportController.js
const db = require('../config/database'); // ← ESTA ES LA LÍNEA CORRECTA

// Resumen general de ventas
const getSalesSummary = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: "Faltan parámetros de fecha: start y end" });
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        COUNT(*) AS totalOrders,
        COALESCE(SUM(amount), 0) AS totalSales,
        ROUND(COALESCE(AVG(amount), 0), 2) AS avgTicket
      FROM cash_register 
      WHERE type = 'venta' 
        AND DATE(date) BETWEEN ? AND ?
    `, [start, end]);

    const result = rows[0];
    res.json({
      totalSales: parseFloat(result.totalSales),
      totalOrders: parseInt(result.totalOrders),
      avgTicket: parseFloat(result.avgTicket),
      totalCustomers: parseInt(result.totalOrders)
    });
  } catch (error) {
    console.error("Error en sales-summary:", error);
    res.status(500).json({ message: "Error interno al generar resumen de ventas" });
  }
};

// Top 10 platillos más vendidos
const getTopDishes = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: "Faltan parámetros de fecha" });
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        oi.item_name AS name,
        SUM(oi.quantity) AS units_sold,
        ROUND(SUM(oi.quantity * oi.price), 2) AS total_sales
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN cash_register cr ON cr.order_id = o.id AND cr.type = 'venta'
      WHERE DATE(cr.date) BETWEEN ? AND ?
        AND oi.item_name IS NOT NULL
        AND oi.item_name != ''
      GROUP BY oi.item_name
      ORDER BY total_sales DESC
      LIMIT 10
    `, [start, end]);

    res.json({ top10: rows });
  } catch (error) {
    console.error("Error en top-dishes:", error);
    res.status(500).json({ 
      message: "Error al obtener platillos más vendidos",
      error: error.message 
    });
  }
};

// Ventas por método de pago
const getPaymentMethods = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: "Faltan parámetros de fecha" });
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        payment_method,
        COALESCE(SUM(amount), 0) AS total
      FROM cash_register
      WHERE type = 'venta'
        AND DATE(date) BETWEEN ? AND ?
        AND payment_method IS NOT NULL
      GROUP BY payment_method
    `, [start, end]);

    const result = { cash: 0, card: 0, other: 0 };

    rows.forEach(row => {
      const amount = parseFloat(row.total);
      if (row.payment_method === 'efectivo') result.cash = amount;
      else if (row.payment_method === 'tarjeta') result.card = amount;
      else result.other += amount;
    });

    res.json(result);
  } catch (error) {
    console.error("Error en payment-methods:", error);
    res.status(500).json({ message: "Error al obtener métodos de pago" });
  }
};




// Top 10 meseros más vendidos
const getTopWaiters = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: "Faltan parámetros de fecha" });
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        COALESCE(u.name, 'Sin mesero') AS name,
        COUNT(DISTINCT cr.order_id) AS orders_served,
        ROUND(SUM(cr.amount), 2) AS total_sales
      FROM cash_register cr
      LEFT JOIN users u ON cr.waiter_id = u.id
      WHERE cr.type = 'venta'
        AND DATE(cr.date) BETWEEN ? AND ?
      GROUP BY cr.waiter_id, u.name
      ORDER BY total_sales DESC
      LIMIT 10
    `, [start, end]);

    res.json({ top10: rows });
  } catch (error) {
    console.error("Error en top-waiters:", error);
    res.status(500).json({ message: "Error al obtener top meseros" });
  }
};





// Ventas por hora (0-23)
const getSalesByHour = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: "Faltan parámetros de fecha" });
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        HOUR(cr.date) AS hour,
        ROUND(SUM(cr.amount), 2) AS total_sales,
        COUNT(*) AS orders_count
      FROM cash_register cr
      WHERE cr.type = 'venta'
        AND DATE(cr.date) BETWEEN ? AND ?
      GROUP BY HOUR(cr.date)
      ORDER BY hour
    `, [start, end]);

    // Completar todas las horas (0-23) con 0 si no hay ventas
    const fullHours = Array.from({ length: 24 }, (_, i) => {
      const found = rows.find(r => parseInt(r.hour) === i);
      return {
        hour: i,
        total_sales: found ? parseFloat(found.total_sales) : 0,
        orders_count: found ? parseInt(found.orders_count) : 0
      };
    });

    res.json({ hours: fullHours });
  } catch (error) {
    console.error("Error en sales-by-hour:", error);
    res.status(500).json({ message: "Error al obtener ventas por hora" });
  }
};




// Comparativa: período actual vs anterior (mismo número de días atrás)
const getComparison = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: "Faltan parámetros de fecha" });
  }

  try {
    // Calcular días de diferencia
    const daysDiff = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - daysDiff);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - daysDiff);

    const formatDate = date => date.toISOString().split('T')[0];

    const [current] = await db.query(`
      SELECT ROUND(SUM(amount), 2) AS sales 
      FROM cash_register 
      WHERE type = 'venta' AND DATE(date) BETWEEN ? AND ?
    `, [start, end]);

    const [previous] = await db.query(`
      SELECT ROUND(SUM(amount), 2) AS sales 
      FROM cash_register 
      WHERE type = 'venta' AND DATE(date) BETWEEN ? AND ?
    `, [formatDate(prevStart), formatDate(prevEnd)]);

    const currentSales = parseFloat(current[0]?.sales || 0);
    const previousSales = parseFloat(previous[0]?.sales || 0);
    const difference = currentSales - previousSales;
    const percentage = previousSales === 0 ? 100 : ((difference / previousSales) * 100);

    res.json({
      current: { period: `${start} al ${end}`, sales: currentSales },
      previous: { period: `${formatDate(prevStart)} al ${formatDate(prevEnd)}`, sales: previousSales },
      difference,
      percentage: parseFloat(percentage.toFixed(2))
    });
  } catch (error) {
    console.error("Error en comparison:", error);
    res.status(500).json({ message: "Error en comparativa" });
  }
};

// Top 10 meseros por propinas a cocina (3%)
const getTopKitchenTips = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: "Faltan parámetros de fecha" });
  }

  const TIPS_PCT = 0.03;

  try {
    const [rows] = await db.query(`
      SELECT 
        COALESCE(u.name, 'Sin mesero') AS name,
        ROUND(SUM(cr.amount) * ${TIPS_PCT}, 2) AS kitchen_tips,
        ROUND(SUM(cr.amount), 2) AS total_sales
      FROM cash_register cr
      LEFT JOIN users u ON cr.waiter_id = u.id
      WHERE cr.type = 'venta'
        AND DATE(cr.date) BETWEEN ? AND ?
        AND cr.waiter_id IS NOT NULL
      GROUP BY cr.waiter_id, u.name
      ORDER BY kitchen_tips DESC
      LIMIT 10
    `, [start, end]);

    res.json({ top10: rows });
  } catch (error) {
    console.error("Error en top-kitchen-tips:", error);
    res.status(500).json({ message: "Error al obtener top propinas cocina" });
  }
};




module.exports = {
  getSalesSummary,
  getTopDishes,
  getPaymentMethods,
  getTopWaiters,      
  getSalesByHour,     
  getComparison,
  getTopKitchenTips       
};