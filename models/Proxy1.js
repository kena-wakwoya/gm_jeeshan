const { Model, DataTypes } = require('sequelize');
const Database = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();

class Proxy extends Model {}
Proxy.init({
  id           : { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id      : { type: DataTypes.INTEGER, allowNull: false },
  job_id       : { type: DataTypes.INTEGER, allowNull: false },
  proxy        : { type: DataTypes.STRING(128), allowNull: false },
  status       : { type: DataTypes.ENUM('active', 'dead', 'retry'), defaultValue: 'active' },
  already_used : { type: DataTypes.BOOLEAN, defaultValue: false },
  job_proc_id  : { type: DataTypes.INTEGER, allowNull: true },
  created_at   : { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at   : { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName : 'Proxy',
  tableName : 'gm_proxies',
  timestamps: false,
  indexes   : [{ name: 'idx_job_id', fields: ['job_id'] }]
});

module.exports = Proxy;
