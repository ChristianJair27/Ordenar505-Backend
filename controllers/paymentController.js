

const Razorpay = require("razorpay");
const config = require("../config/config");
const crypto = require("crypto");
const createHttpError = require("http-errors");
const { createPayment } = require("../models/paymentModel");
const moment = require("moment-timezone");
// Crear orden de pago en Razorpay
const createOrder = async (req, res, next) => {
  const razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpaySecretKey,
  });

  try {
    const { amount } = req.body;

    const receiptTime = moment().tz("America/Mexico_City");

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${receiptTime}`
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ success: true, order });

  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Verificar firma de pago
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", config.razorpaySecretKey)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

const moment = require("moment-timezone");
const receiptTime = moment().tz("America/Mexico_City").format("YYYYMMDDHHmmss");

receipt: `receipt_${receiptTime}`



    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, message: "Payment verified successfully!" });
    } else {
      return next(createHttpError(400, "Payment verification failed!"));
    }

  } catch (error) {
    next(error);
  }
};

// Webhook de Razorpay
const webHookVerification = async (req, res, next) => {
  try {
    const secret = config.razorpyWebhookSecret;
    const signature = req.headers["x-razorpay-signature"];
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature === signature) {
      console.log("✅ Webhook verified:", req.body);

      if (req.body.event === "payment.captured") {
        const payment = req.body.payload.payment.entity;

        const paymentData = {
          payment_id: payment.id,
          order_id: payment.order_id, // debe coincidir con ID en tabla `orders`
          amount: payment.amount / 100,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          email: payment.email,
          contact: payment.contact
        };

        await createPayment(paymentData);
        console.log(`💰 Payment saved: ${paymentData.amount} INR`);
      }

      res.json({ success: true });

    } else {
      return next(createHttpError(400, "❌ Invalid Signature!"));
    }

  } catch (error) {
    next(error);
  }
};

module.exports = { createOrder, verifyPayment, webHookVerification };
