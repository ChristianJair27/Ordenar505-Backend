// routes/orderRoute.js
const express = require("express");
const router = express.Router();

const {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  assignWaiter,
  getKitchenOrdersPublic,
} = require("../controllers/orderController");

// Si tu middleware exporta con module.exports = fn
const verifyToken = require("../middlewares/verifyToken");

// Debug opcional si aún falla
// console.log("typeof verifyToken:", typeof verifyToken);     // "function"
// console.log("typeof assignWaiter:", typeof assignWaiter);   // "function"

// CRUD básico
// Montado como app.use("/api/order", orderRoute);
router.get("/kitchen-public", getKitchenOrdersPublic);
router.post("/", addOrder);           // POST   /api/order
router.get("/", getOrders);           // GET    /api/order
router.get("/:id", getOrderById);     // GET    /api/order/:id
router.put("/:id", updateOrder);      // PUT    /api/order/:id

// Reasignar mesero (nota la ruta SIN "orders")
router.put("/:id/assign-waiter", verifyToken, assignWaiter); // PUT /api/order/:id/assign-waiter

module.exports = router;
