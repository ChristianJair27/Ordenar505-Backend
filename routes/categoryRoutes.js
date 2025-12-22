const express = require("express");
const router = express.Router();
const { getCategories, addCategory, updateCategory } = require("../controllers/categoryController");

router.get("/", getCategories);
router.post("/", addCategory);
router.put("/:id", updateCategory);

module.exports = router;