/*const express = require("express");
const { addTable, getTables, updateTable } = require("../controllers/tableController");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification")
 
router.route("/").post(isVerifiedUser , addTable);
router.route("/").get(isVerifiedUser , getTables);
router.route("/:id").put(isVerifiedUser , updateTable);

module.exports = router;*/






const express = require("express");
const router = express.Router();
const {
  addTable,
  getTables,
  updateTable
} = require("../controllers/tableController");

// Crear nueva mesa
router.post("/add", addTable);

// Obtener todas las mesas
router.get("/", getTables);

// Actualizar mesa
router.put("/:id", updateTable);

module.exports = router;