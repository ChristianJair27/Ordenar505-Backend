const express = require("express");
const db = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();
const cashRegisterRoutes = require("./routes/CashRegisterRoute");
const cashRoutes = require('./routes/CashRoutes');
const categoryRoutes = require("./routes/categoryRoutes");
const dishRoutes = require("./routes/dishRoutes");
const verifyToken = require("./middlewares/verifyToken");
const shiftRoutes = require("./routes/shiftRoutes");

const PORT = process.env.PORT || 80;


const allowedOrigins = [
  "http://192.168.1.3:5173",
  "http://192.168.1.78:5173",
  "http://localhost:5173",
  "http://187.200.118.87:5173",
  "http://pos.xn--lapeadesantiago-1qb.com:5173",
  "https://xn--lapeadesantiago-1qb.com",
  "http://app.xn--lapeadesantiago-1qb.com:5173",
  "https://app.xn--lapeadesantiago-1qb.com:5173",
  "https://app.xn--lapeadesantiago-1qb.com",
  "https://app.xn--lapeadesantiago-1qb.com:80",
  "http://app.xn--lapeadesantiago-1qb.com"
];


app.use(cookieParser());

  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) ) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for this origin: " + origin));
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }));

app.use(express.json());


// Root Endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: "OK",
    message: "API POS Online",
    timestamp: new Date().toISOString()
  });
});



app.use("/api", shiftRoutes);



app.get("/users/me", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name, email, phone, role FROM users WHERE id = ?", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user data" });
  }
});

// Other Endpoints
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/orders", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));




app.use("/api/cash", cashRegisterRoutes);                // Para /cash/balance y /admin/cash-movement
app.use("/api", cashRoutes);             // Para /cash-register (GET y POST)
app.use('/api', cashRegisterRoutes); // maneja /api/cash-register
app.use("/api/cash-register", cashRegisterRoutes);



//menu

app.use("/api/categories", categoryRoutes);
app.use("/api/dishes", dishRoutes);



//rutas

app.use("/api/shifts", shiftRoutes);
app.use("/api/turno-actual", shiftRoutes);
app.use('/api', shiftRoutes);

app.use("/api", require("./routes/waiterRoute"));





// Global Error Handler
app.use(globalErrorHandler);


// Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

