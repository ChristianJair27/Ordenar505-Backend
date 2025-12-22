const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const CashRegister = sequelize.define("CashRegister", {
  type: DataTypes.STRING,
  amount: DataTypes.FLOAT,
  payment_method: DataTypes.STRING,
  order_id: DataTypes.INTEGER,
  description: DataTypes.STRING,
  user_id: DataTypes.INTEGER
}, {
  tableName: "cash_register",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false
});

module.exports = CashRegister;