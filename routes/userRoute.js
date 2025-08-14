const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getUserData,
  logout,
  getAllUsers,
  updateUser,
  deleteUser

} = require("../controllers/userController");

const verifyToken = require("../middlewares/verifyToken");

// Rutas públicas
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// Rutas protegidas
router.get("/me", verifyToken, getUserData);      // GET /api/user/me
router.get("/", getAllUsers);                     // GET /api/user


// Editar usuario
router.put("/:id", verifyToken, updateUser);

// Eliminar usuario
router.delete("/:id", verifyToken, deleteUser);

module.exports = router;