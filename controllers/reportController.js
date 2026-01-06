// controllers/reportController.js
const db = require('../config/database'); // ← ESTA ES LA LÍNEA CORRECTA
const axios = require('axios');

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



// Análisis inteligente con IA local (Ollama)
const getAIAnalysis = async (req, res) => {
  const { 
    salesSummary, 
    topDishes = [], 
    topWaiters = [], 
    topKitchenTips = [], 
    totalKitchenTips = 0,
    paymentMethods = { cash: 0, card: 0, other: 0 }, 
    salesByHour = [], 
    comparison,
    start,
    end 
  } = req.body;

  if (!salesSummary || !start || !end) {
    return res.status(400).json({ message: "Faltan datos necesarios para el análisis IA" });
  }

 try {
    console.log("=== INICIANDO ANÁLISIS IA ===");
    console.log("Conectando a: http://lpsantiago.ddns.net:11434");
    console.log("Modelo: dolphin-llama3:8b");
    console.log("Fechas:", start, "al", end);
    console.log("Ventas totales:", salesSummary?.totalSales);

    // Hora pico
    const peakHourObj = salesByHour.reduce((max, h) => 
      h.total_sales > max.total_sales ? h : max, 
      salesByHour[0] || { hour: '?', total_sales: 0 }
    );
    const peakHour = peakHourObj.hour !== undefined ? `${peakHourObj.hour}:00 hs` : 'N/A';

    // Top 3
    const top3Dishes = topDishes.slice(0, 3).map((d, i) => 
      `${i+1}. ${d.name} - $${parseFloat(d.total_sales || 0).toFixed(2)}`
    ).join('\n') || 'No hay datos';

    const top3Waiters = topWaiters.slice(0, 3).map((w, i) => 
      `${i+1}. ${w.name} - $${parseFloat(w.total_sales || 0).toFixed(2)}`
    ).join('\n') || 'No hay datos';

    const top3KitchenTips = topKitchenTips.slice(0, 3).map((w, i) => 
      `${i+1}. ${w.name} - $${parseFloat(w.kitchen_tips || 0).toFixed(2)}`
    ).join('\n') || 'No hay datos';

    const prompt = `Eres un asesor de restaurantes amigable y motivador, como un amigo experto que ayuda a crecer el negocio. Analiza estos datos del ${start} al ${end} y genera un reporte intuitivo, fácil de leer, con emojis para destacar puntos clave.

Datos clave:
- 📈 Ventas totales: $${parseFloat(salesSummary.totalSales).toFixed(2)}
- 📋 Órdenes: ${salesSummary.totalOrders}
- 💰 Ticket promedio: $${parseFloat(salesSummary.avgTicket).toFixed(2)}
- 👩‍🍳 Propinas cocina (3%): $${parseFloat(totalKitchenTips).toFixed(2)}

Top 3 platillos:
${top3Dishes}

Top 3 meseros por ventas:
${top3Waiters}

Top 3 meseros por propinas cocina:
${top3KitchenTips}

Métodos de pago:
- 💵 Efectivo: $${parseFloat(paymentMethods.cash).toFixed(2)}
- 💳 Tarjeta: $${parseFloat(paymentMethods.card).toFixed(2)}

🕒 Hora pico: ${peakHour}

📊 Comparación anterior: ${comparison?.percentage >= 0 ? 'Crecimiento' : 'Caída'} del ${Math.abs(comparison?.percentage || 0)}%

Entrega en español, con emojis y lenguaje simple:
1. Resumen ejecutivo (3-4 líneas, motivador: empieza con "¡Bien hecho!" o "Oportunidad de oro")
2. Fortalezas destacadas (viñetas con emojis)
3. Alertas o mejoras (viñetas con ⚠️ o 📉)
4. 3 recomendaciones accionables (viñetas con ✅, incluye pasos simples y estimación de impacto, ej. "podría aumentar ventas en 10-20%")
5. Comentario sobre el equipo (motivador, con 🌟 para destacar nombres)

Sé directo, positivo y útil. Usa viñetas para fácil lectura.`;

    console.log("Prompt generado (longitud:", prompt.length, "caracteres)");

    // Instancia limpia de axios
    const ollamaAxios = axios.create({
      baseURL: 'http://lpsantiago.ddns.net:11434',
      timeout: 600000, // 3 minutos por si el modelo tarda
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("Enviando petición a Ollama...");

    const response = await ollamaAxios.post('/api/chat', {
      model: 'phi3:medium',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 1200
      }
    });

    console.log("¡Respuesta recibida de Ollama exitosamente!");

    const analysis = response.data.message?.content?.trim() || "No se recibió contenido válido del modelo.";

    console.log("Análisis generado con éxito");

    res.json({ analysis });

  } catch (error) {
    console.error("=== ERROR DETALLADO CON OLLAMA ===");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Errno:", error.errno);
    console.error("Syscall:", error.syscall);
    console.error("Address:", error.address);
    console.error("Port:", error.port);

    if (error.response) {
      console.error("Status Ollama:", error.response.status);
      console.error("Data Ollama:", error.response.data);
    }

    // Mensajes más claros según el tipo de error
    if (error.code === 'ECONNREFUSED') {
      return res.status(502).json({ 
        message: "El servidor Ollama rechazó la conexión. Verifica que el puerto 11434 esté abierto desde fuera." 
      });
    }

    if (error.code === 'ENOTFOUND') {
      return res.status(502).json({ 
        message: "No se encontró lpsantiago.ddns.net. Verifica tu DDNS o conexión a internet." 
      });
    }

    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({ 
        message: "Timeout: Ollama tardó demasiado en responder. Puede estar sobrecargado o inaccesible." 
      });
    }

    res.status(500).json({ 
      message: "Error crítico al conectar con Ollama remoto",
      details: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
};



module.exports = {
  getSalesSummary,
  getTopDishes,
  getPaymentMethods,
  getTopWaiters,
  getSalesByHour,
  getComparison,
  getTopKitchenTips,
  getAIAnalysis
};