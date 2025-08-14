  /*const express = require("express");
const { addOrder, getOrders, getOrderById, updateOrder } = require("../controllers/orderController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();


router.route("/").post(isVerifiedUser, addOrder);
router.route("/").get(isVerifiedUser, getOrders);
router.route("/:id").get(isVerifiedUser, getOrderById);
router.route("/:id").put(isVerifiedUser, updateOrder);

module.exports = router;*/






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








