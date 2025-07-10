const { Model, DataTypes } = require('sequelize');
const Database = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();

class User extends Model {}
User.init({
  id         : { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  first_name : { type: DataTypes.STRING, allowNull: false },
  last_name  : { type: DataTypes.STRING, allowNull: false },
  username   : { type: DataTypes.STRING, allowNull: false },
  email      : { type: DataTypes.STRING, allowNull: false},
  password   : { type: DataTypes.STRING, allowNull: false },
  balance    : { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.0 },
  role       : { type: DataTypes.ENUM('ADMIN', 'USER'), defaultValue: 'USER' },
  created_at : { type: DataTypes.DATE,   defaultValue: DataTypes.NOW },
  updated_at : { type: DataTypes.DATE,   defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName : 'User',
  tableName : 'gm_users',
  timestamps: false,
  indexes   : [{ name: 'idx_email', fields: ['email'] }]
});

module.exports = User;
