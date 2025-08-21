

const createHttpError = require("http-errors");
const db = require("../config/database");
const { createUser, getUserByEmail } = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

// REGISTRO
const register = async (req, res, next) => {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !email || !password || !role) {
      return next(createHttpError(400, "All fields are required!"));
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return next(createHttpError(400, "User already exists!"));
    }

    const userId = await createUser({ name, phone, email, password, role });

    res.status(201).json({
      success: true,
      message: "New user created!",
      data: { id: userId, name, email, role },
    });

  } catch (error) {
    console.error("❌ Error al registrar usuario:", error);
    return next(createHttpError(400, error.message)); // <-- este cambio
  }
};

// LOGIN
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(createHttpError(400, "All fields are required!"));
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return next(createHttpError(401, "Invalid credentials"));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(createHttpError(401, "Invalid credentials"));
    }

    const accessToken = jwt.sign({ id: user.id }, config.accessTokenSecret, {
      expiresIn: '1d'
    });

    res.cookie('accessToken', accessToken, {
  maxAge: 1000 * 60 * 60 * 24 * 30,
  httpOnly: true,
  sameSite: 'none',    
  secure: true
});

    res.status(200).json({
  success: true,
  message: "User login successfully!",
  token: accessToken, // ✅ agrega esto
  data: {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role
  }
});

  } catch (error) {
    next(error);
  }
};

// OBTENER DATOS DEL USUARIO LOGUEADO
const getUserData = async (req, res, next) => {
  try {
    const pool = require('../config/database');
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone, role FROM users WHERE id = ?",
      [req.user.id]
    );

    const user = rows[0];
    if (!user) {
      return next(createHttpError(404, "User not found"));
    }
console.log("Sending user:", user);
    return res.status(200).json({
      success: true,
      message: "User route OK",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// LOGOUT
const logout = async (req, res, next) => {
  try {
    res.clearCookie('accessToken');
    res.status(200).json({
      success: true,
      message: "User logout successfully!"
    });
  } catch (error) {
    next(error);
  }
};






// GET ALL USERS
const getAllUsers = async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT id, name, email, phone, role FROM users");
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};




// EDITAR USUARIO
const updateUser = async (req, res, next) => {
  try {
    const { name, email, phone, role } = req.body;
    const { id } = req.params;

    const [result] = await db.query(
      "UPDATE users SET name = ?, email = ?, phone = ?, role = ? WHERE id = ?",
      [name, email, phone, role, id]
    );

    if (result.affectedRows === 0) {
      return next(createHttpError(404, "User not found"));
    }

    res.status(200).json({ success: true, message: "User updated!" });
  } catch (error) {
    next(error);
  }
};

// ELIMINAR USUARIO
const deleteUser = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [r] = await db.query("DELETE FROM users WHERE id=?", [id]);
    if (r.affectedRows === 0) return next(createHttpError(404, "User not found"));
    res.json({ success: true, message: "User deleted!" });
  } catch (e) {
    if (e.code === "ER_ROW_IS_REFERENCED_2" || e.errno === 1451) {
      return next(createHttpError(409, "No se puede borrar: el usuario tiene movimientos/turnos relacionados. Usa desactivación o ajusta FKs (SET NULL/CASCADE)."));
    }
    next(e);
  }
};


module.exports = { register, login, getUserData, logout, getAllUsers, updateUser, deleteUser, };