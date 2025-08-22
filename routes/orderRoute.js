

const express = require("express");
const router = express.Router();
const {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder
} = require("../controllers/orderController");

// Middleware para verificar token si es necesario
const verifyToken = require("../middlewares/verifyToken");

// Rutas protegidas (descomenta verifyToken si ya tienes autenticación funcionando)
router.post("/", addOrder);           // POST /api/order
router.get("/", getOrders);           // GET /api/order
router.get("/:id", getOrderById);     // GET /api/order/:id
router.put("/:id", updateOrder);      // PUT /api/order/:id

module.exports = router;








