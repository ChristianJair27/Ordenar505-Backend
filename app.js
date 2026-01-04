const express = require("express");
const db = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();

const cashRegisterRoutes = require("./routes/CashRegisterRoute");
const cashRoutes = require("./routes/CashRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const dishRoutes = require("./routes/dishRoutes");
const verifyToken = require("./middlewares/verifyToken");
const shiftRoutes = require("./routes/shiftRoutes");



const orderRoute = require("./routes/orderRoute");

// 👇 Kiosk (meseros tipo Netflix)
const kioskAuthRoutes = require("./routes/kioskAuthRoutes");

const PORT = process.env.PORT || 80;

const allowedOrigins = [
  "http://192.168.1.11:5173",
  "http://192.168.1.14:5173",
  "http://192.168.1.85:5173",
  "http://192.168.1.78:5173",
  "http://localhost:5173",
  "http://187.200.118.87:5173",
  "http://pos.xn--lapeadesantiago-1qb.com:5173",
  "https://xn--lapeadesantiago-1qb.com",
  "http://app.xn--lapeadesantiago-1qb.com:5173", 
  "https://app.xn--lapeadesantiago-1qb.com:5173",
  "https://app.xn--lapeadesantiago-1qb.com",
  "https://app.xn--lapeadesantiago-1qb.com:80",
  "http://app.xn--lapeadesantiago-1qb.com",
  "https://madero.xn--lapeadesantiago-1qb.com",
  "http://app.xn--lapeadesantiago-1qb.com"
];

app.use(cookieParser());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed for this origin: " + origin));
    }
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.use(express.json());

// Root
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "API POS Online",
    timestamp: new Date().toISOString(),
  });
});

// ----------------------
//   RUTAS DE LA API
// ----------------------

// Shifts (una sola vez para evitar handlers dobles)
app.use("/api", shiftRoutes);

// Auth de kiosk (meseros tipo Netflix)
app.use("/api/auth", kioskAuthRoutes);

// User info (protegido)
app.get("/users/me", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, phone, role FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user data" });
  }
});

// Módulos
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/orders", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));

// Reports
app.use('/api/reports', require('./routes/reportRoutes'));

// Cash / cash-register (mantén solo estas dos)
app.use("/api/cash", cashRegisterRoutes); // p.ej. /api/cash/balance
app.use("/api",      cashRoutes);         // p.ej. /api/cash-register
app.use("/api/cash-register", cashRegisterRoutes);

// Menú
app.use("/api/categories", categoryRoutes);
app.use("/api/dishes",     dishRoutes);

// Waiters (ya lo tenías)
app.use("/api", require("./routes/waiterRoute"));

app.use("/api/order", orderRoute);







// Global error
app.use(globalErrorHandler);

// Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});


// Alias opcional para compatibilidad
app.get("/api/user/me", verifyToken, async (req, res) => {
  const [rows] = await db.query(
    "SELECT id, name, email, phone, role FROM users WHERE id = ?",
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: "User not found" });
  res.json(rows[0]);
});