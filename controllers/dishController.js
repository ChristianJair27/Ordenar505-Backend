const db = require("../config/database");

exports.getDishes = async (req, res) => {
  const [rows] = await db.query(
    "SELECT dishes.*, categories.name as category_name FROM dishes LEFT JOIN categories ON dishes.category_id = categories.id"
  );
  res.json({ data: rows });
};

exports.addDish = async (req, res) => {
  const { name, price, category_id, image_url } = req.body;
  await db.query("INSERT INTO dishes (name, price, category_id, image_url) VALUES (?, ?, ?, ?)", [
    name,
    price,
    category_id,
    image_url,
  ]);
  res.status(201).json({ message: "Platillo agregado" });
};



exports.updateDish = async (req, res) => {
  const { id } = req.params;
  const { name, price, image_url, category_id } = req.body;

  try {
    await db.query(
      "UPDATE dishes SET name = ?, price = ?, image_url = ?, category_id = ? WHERE id = ?",
      [name, price, image_url, category_id, id]
    );

    res.json({ message: "Platillo actualizado correctamente" });
  } catch (err) {
    console.error("Error al actualizar platillo:", err);
    res.status(500).json({ message: "Error al actualizar platillo" });
  }
};
