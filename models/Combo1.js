const { Model, DataTypes } = require('sequelize');
const Database = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();

class Combo extends Model {}
Combo.init({
  id        : { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id   : { type: DataTypes.INTEGER, allowNull: false },
  email     : { type: DataTypes.STRING,  allowNull: false },
  password  : { type: DataTypes.STRING,  allowNull: false },
  status    : { type: DataTypes.ENUM('pending', 'success', 'failed', 'retry'), defaultValue: 'pending' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName : 'Combo',
  tableName : 'gm_combos',
  timestamps: false
});

module.exports = Combo;
