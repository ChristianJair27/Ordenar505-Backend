 /*const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    name : {
        type: String,
        required: true,
    },

    email : {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /\S+@\S+\.\S+/.test(v);
            },
            message : "Email must be in valid format!"
        }
    },

    phone: {
        type : Number,
        required: true,
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v);
            },
            message : "Phone number must be a 10-digit number!"
        }
    },

    password: {
        type: String,
        required: true,
    },

    role: {
        type: String,
        required: true
    }
}, { timestamps : true })

userSchema.pre('save', async function (next) {
    if(!this.isModified('password')){
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
})

module.exports = mongoose.model("User", userSchema);*/










const bcrypt = require('bcrypt');
const pool = require('../config/database'); // Importa el pool directamente

// Crear nuevo usuario
async function createUser({ name, email, phone, password, role }) {
    // Validaciones básicas
    const emailRegex = /\S+@\S+\.\S+/;
    const phoneRegex = /^\d{10}$/;
    if (!emailRegex.test(email)) throw new Error('Invalid email');
    if (!phoneRegex.test(phone)) throw new Error('Invalid phone number');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const sql = `
        INSERT INTO users (name, email, phone, password, role)
        VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [name, email, phone, hashedPassword, role]);

    return result.insertId;
}

// Buscar usuario por email (para login, etc.)
async function getUserByEmail(email) {
    const sql = `SELECT * FROM users WHERE email = ?`;
    const [rows] = await pool.execute(sql, [email]);

    return rows[0]; // retorna el primer resultado o undefined
}

module.exports = {
    createUser,
    getUserByEmail
};