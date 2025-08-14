/*const mongoose = require("mongoose");
const config = require("./config");

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.databaseURI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.log(`❌ Database connection failed: ${error.message}`);
        process.exit();
    }
}

module.exports = connectDB;*/



/*
// config/db.js
const mysql = require('mysql2/promise');

const connectDB = async () => {
    try {
        const connection = await mysql.createConnection({
            host: 'srv1250.hstgr.io', // o el host de tu hosting
            user: 'u522428285_admin',
            password: 'Minecon$2710',
            database: 'u522428285_ordenar'
        });

        console.log('✅ MySQL Connected');
        return connection;
    } catch (err) {
        console.error('❌ MySQL connection failed:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;*/

const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.dbHost,
  user: config.dbUser,
  password: config.dbPass,
  database: config.dbName,
  
});



console.log("✅ MySQL pool created");

module.exports = pool;









