const { Model, DataTypes } = require('sequelize');
const Database = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();

class UserAccountHistory extends Model {}
UserAccountHistory.init({
  id        : { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id   : { type: DataTypes.INTEGER, allowNull: false },
  memo      : { type: DataTypes.STRING,  allowNull: false },
  amount    : { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  balance   : { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName : 'UserAccountHistory',
  tableName : 'gm_user_account_history',
  timestamps: false,
  indexes   : [{ name: 'idx_id', fields: ['id', 'user_id'] }]
});

module.exports = UserAccountHistory;
