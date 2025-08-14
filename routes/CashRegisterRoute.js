const express = require("express");
const router = express.Router();
const { addCashMovement } = require("../controllers/cashRegisterController");
const { getCashMovements } = require('../controllers/cashRegisterController');

router.get('/cash-register', getCashMovements);
router.post("/", addCashMovement);

module.exports = router;