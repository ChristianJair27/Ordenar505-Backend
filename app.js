const express = require("express");
const http = require("http");               // ← agregado
const { Server } = require("socket.io");    // ← agregado

const db = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();

// Rutas (sin cambios)
const cashRegisterRoutes = require("./routes/CashRegisterRoute");
const cashRoutes = require("./routes/CashRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const dishRoutes = require("./routes/dishRoutes");
const verifyToken = require("./middlewares/verifyToken");
const shiftRoutes = require("./routes/shiftRoutes");
const orderRoute = require("./routes/orderRoute");
const kioskAuthRoutes = require("./routes/kioskAuthRoutes");

// Crear servidor HTTP explícito para soportar Socket.IO
const server = http.createServer(app);

// Inicializar Socket.IO
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
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
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for this origin: " + origin));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Guardar io en app para acceder desde los controladores
app.set("io", io);

// Eventos de Socket.IO
io.on("connection", (socket) => {
  console.log("Nuevo cliente conectado → Socket ID:", socket.id);

  // La pantalla de cocina se une al room "kitchen"
  socket.on("joinKitchen", () => {
    socket.join("kitchen");
    console.log("Pantalla de cocina se unió al room 'kitchen'");
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado → Socket ID:", socket.id);
  });
});

// Middlewares
app.use(cookieParser());
app.use(cors({
  origin: function (origin, callback) {
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

// Rutas de la API
app.use("/api", shiftRoutes);
app.use("/api/auth", kioskAuthRoutes);

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

app.use("/api/user", require("./routes/userRoute"));
app.use("/api/orders", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use("/api/cash", cashRegisterRoutes);
app.use("/api", cashRoutes);
app.use("/api/cash-register", cashRegisterRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dishes", dishRoutes);
app.use("/api", require("./routes/waiterRoute"));
app.use("/api/order", orderRoute);


app.use('/uploads', express.static('public/uploads'));



// Global error handler
app.use(globalErrorHandler);

// Alias opcional
app.get("/api/user/me", verifyToken, async (req, res) => {
  const [rows] = await db.query(
    "SELECT id, name, email, phone, role FROM users WHERE id = ?",
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: "User not found" });
  res.json(rows[0]);
});

// Iniciar el servidor (usamos server.listen en lugar de app.listen)
const PORT = process.env.PORT || 80;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
}); 