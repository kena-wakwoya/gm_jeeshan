const { Model, DataTypes } = require('sequelize');
const Database = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();

class Module extends Model {}
Module.init({
  id               : { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  module_name      : { type: DataTypes.STRING(255), allowNull: false },
  login_url        : { type: DataTypes.TEXT },
  method           : { type: DataTypes.STRING(10) },
  price            : { type: DataTypes.DECIMAL(10, 2) },
  requires_captcha : { type: DataTypes.BOOLEAN, defaultValue: false },
  multiform : { type: DataTypes.BOOLEAN, defaultValue: false },
  created_by       : { type: DataTypes.INTEGER },
  headers          : { type: DataTypes.JSON },
  post_data        : { type: DataTypes.JSON },
  captcha_keys     : { type: DataTypes.JSON },
  extra_data       : { type: DataTypes.JSON },
  extra_attributes : { type: DataTypes.JSON },
  created_at       : { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName : 'Module',
  tableName : 'gm_modules',
  timestamps: false,
  indexes   : [{ name: 'idx_module_name', fields: ['id'] }]
});

module.exports = Module;
