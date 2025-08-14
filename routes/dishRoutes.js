const express = require("express");
const router = express.Router();
const { getDishes, addDish, updateDish } = require("../controllers/dishController");


router.get("/", getDishes);
router.post("/", addDish);

router.put("/:id", updateDish);

module.exports = router;