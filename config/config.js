

require("dotenv").config();

const config = Object.freeze({
    // Server
    port: process.env.PORT || 8000,
    nodeEnv: process.env.NODE_ENV || "development",

    // MySQL
    dbHost: process.env.DB_HOST ,
    dbUser: process.env.DB_USER ,
    dbPass: process.env.DB_PASSWORD ,
    dbName: process.env.DB_NAME,

    // JWT
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
     // 👇 Alias para que las rutas que usan jwtSecret no fallen
  jwtSecret: process.env.ACCESS_TOKEN_SECRET,


});

module.exports = config;