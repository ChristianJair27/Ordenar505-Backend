const express = require('express');
const router = express.Router();
const { getCashBalance, adminCashMovement, registerCashMovementWithShift } = require('../controllers/CashController');
const verifyToken = require("../middlewares/verifyToken");


router.get('/cash-balance', (req, res) => {
  console.log("✅ GET /cash-balance hit");
  getCashBalance(req, res);
});
router.post('/admin/cash-movement', verifyToken, adminCashMovement);

router.post("/cash-register", verifyToken, registerCashMovementWithShift);

module.exports = router;