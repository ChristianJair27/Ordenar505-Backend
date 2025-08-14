/*require("dotenv").config();

const config = Object.freeze({
    port: process.env.PORT || 3000,
    databaseURI: process.env.MONGODB_URI || "mongodb://localhost:27017/pos-db",
    nodeEnv : process.env.NODE_ENV || "development",
    accessTokenSecret: process.env.JWT_SECRET,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpaySecretKey: process.env.RAZORPAY_KEY_SECRET,
    razorpyWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
});

module.exports = config;*/




require("dotenv").config();

const config = Object.freeze({
    // Server
    port: process.env.PORT || 8000,
    nodeEnv: process.env.NODE_ENV || "development",

    // MySQL
    dbHost: process.env.DB_HOST || "srv1250.hstgr.io",
    dbUser: process.env.DB_USER || "u522428285_admin",
    dbPass: process.env.DB_PASSWORD || "Minecon$2710",
    dbName: process.env.DB_NAME || "u522428285_ordenar",

    // JWT
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,


});

module.exports = config;