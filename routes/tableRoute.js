

const express = require("express");
const router = express.Router();
const {
  addTable,
  getTables,
  updateTable,
  deleteTable
} = require("../controllers/tableController");

// Crear nueva mesa
router.post("/add", addTable);

// Obtener todas las mesas
router.get("/", getTables);

// Actualizar mesa
router.put("/:id", updateTable);

// Eliminar mesa

router.delete("/:id", deleteTable);

module.exports = router;