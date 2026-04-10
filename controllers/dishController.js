const db = require("../config/database");
const upload = require('../middlewares/multerConfig');

// GET: todos los platillos con nombre de categoría
exports.getDishes = async (req, res) => {
  const [rows] = await db.query(
    "SELECT dishes.*, categories.name as category_name FROM dishes LEFT JOIN categories ON dishes.category_id = categories.id"
  );
  res.json({ data: rows });
};

// POST: crear nuevo platillo (multer guarda la imagen físicamente)
exports.addDish = async (req, res) => {
  const { name, price, category_id } = req.body;

  const imagePath = req.file ? `/uploads/dishes/${req.file.filename}` : null;

  try {
    await db.query(
      "INSERT INTO dishes (name, price, category_id, image_path) VALUES (?, ?, ?, ?)",
      [name, price, category_id, imagePath]
    );
    res.status(201).json({ message: "Platillo agregado" });
  } catch (err) {
    console.error("Error al agregar platillo:", err);
    res.status(500).json({ message: "Error al agregar platillo" });
  }
};

// PUT: actualizar platillo (imagen opcional)
exports.updateDish = async (req, res) => {
  const { id } = req.params;
  const { name, price, category_id } = req.body;

  try {
    let query = "UPDATE dishes SET name = ?, price = ?, category_id = ?";
    const params = [name, price, category_id];

    if (req.file) {
      query += ", image_path = ?";
      params.push(`/uploads/dishes/${req.file.filename}`);
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
