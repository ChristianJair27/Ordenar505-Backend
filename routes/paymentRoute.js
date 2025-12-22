/*const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { createOrder, verifyPayment, webHookVerification } = require("../controllers/paymentController");
 
router.route("/create-order").post(isVerifiedUser , createOrder);
router.route("/verify-payment").post(isVerifiedUser , verifyPayment);
router.route("/webhook-verification").post(webHookVerification);


module.exports = router;*/




const express = require("express");
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  webHookVerification
} = require("../controllers/paymentController");

router.post("/create-order", createOrder);
router.post("/verify", verifyPayment);
router.post("/webhook", webHookVerification);

module.exports = router;