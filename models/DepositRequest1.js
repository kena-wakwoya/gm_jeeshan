const { Model, DataTypes } = require('sequelize');
const Database = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();

class DepositRequest extends Model {}
DepositRequest.init({
  id         : { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id    : { type: DataTypes.INTEGER, allowNull: false },
  order_id   : { type: DataTypes.STRING },
  invoice_id : { type: DataTypes.STRING },
  amount     : { type: DataTypes.DECIMAL(10, 2) },
  btc_amount : { type: DataTypes.DECIMAL(10, 2) },
  currency   : { type: DataTypes.STRING(10) },
  status     : { type: DataTypes.ENUM('pending', 'settled', 'expired', 'failed'), defaultValue: 'pending' },
  created_at : { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at : { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName : 'DepositRequest',
  tableName : 'gm_deposits_request',
  timestamps: false
});

module.exports = DepositRequest;
