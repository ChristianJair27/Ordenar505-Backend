

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
     // 👇 Alias para que las rutas que usan jwtSecret no fallen
  jwtSecret: process.env.ACCESS_TOKEN_SECRET,


});

module.exports = config;