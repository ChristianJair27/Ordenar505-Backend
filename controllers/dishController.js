const db = require("../config/database");
const path = require('path');
const upload = require('../middlewares/multerConfig'); // ← importa multer

// GET sigue igual
exports.getDishes = async (req, res) => {
  const [rows] = await db.query(
    "SELECT dishes.*, categories.name as category_name FROM dishes LEFT JOIN categories ON dishes.category_id = categories.id"
  );
  res.json({ data: rows });
};

// ──────────────────────────────────────────────
//           IMPORTANTE: NUEVO ENFOQUE
// ──────────────────────────────────────────────

exports.addDish = async (req, res) => {
  console.log("→ POST /dishes llamado");
  console.log("req.body:", req.body);           // ← debe tener name, price, category_id
  console.log("req.file:", req.file);           // ← SI ESTO ES UNDEFINED → multer no funciona
  console.log("req.files:", req.files);         // ← por si acaso

  const { name, price, category_id } = req.body;

  let imagePath = null;

  if (req.file) {
    imagePath = `/uploads/dishes/${req.file.filename}`;
    console.log("Imagen recibida y guardada como:", imagePath);
  } else {
    console.log("¡NO se recibió archivo! req.file es undefined");
  }

  try {
    await db.query(
  "INSERT INTO dishes (name, price, category_id, image_path) VALUES (?, ?, ?, ?)",  // ← cambia a image_path
  [name, price, category_id, imagePath]
);

    res.status(201).json({ message: "Platillo agregado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al agregar platillo" });
  }
};

exports.updateDish = async (req, res) => {
  const { id } = req.params;
  const { name, price, category_id } = req.body;

  let imagePath = null;

  // Si se subió nueva imagen → actualizarla
  if (req.file) {
    imagePath = `/uploads/dishes/${req.file.filename}`;
  }
  // Si NO se subió → mantenemos la que ya tenía (no tocamos image_url)

  try {
    // Construimos la consulta dinámicamente según si hay nueva imagen o no
    let query = "UPDATE dishes SET name = ?, price = ?, category_id = ?";
    let params = [name, price, category_id];

    if (imagePath !== null) {
  query += ", image_path = ?";   // ← cambia aquí también
  params.push(imagePath);
}

    query += " WHERE id = ?";
    params.push(id);

    await db.query(query, params);

    res.json({ message: "Platillo actualizado correctamente" });
  } catch (err) {
    console.error("Error al actualizar platillo:", err);
    res.status(500).json({ message: "Error al actualizar platillo" });
  }
};