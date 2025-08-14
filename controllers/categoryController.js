const db = require("../config/database");

exports.getCategories = async (req, res) => {
  const [rows] = await db.query("SELECT * FROM categories");
  res.json({ data: rows });
};

exports.addCategory = async (req, res) => {
  const { name, bg_color, icon } = req.body;
  await db.query("INSERT INTO categories (name, bg_color, icon) VALUES (?, ?, ?)", [name, bg_color, icon]);
  res.status(201).json({ message: "Categoría agregada" });
};


exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, bg_color, icon } = req.body;

  try {
    await db.query(
      "UPDATE categories SET name = ?, bg_color = ?, icon = ? WHERE id = ?",
      [name, bg_color, icon, id]
    );
    res.json({ message: "Categoría actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ message: "Error al actualizar categoría" });
  }
};