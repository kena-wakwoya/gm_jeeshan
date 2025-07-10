const { Model, DataTypes } = require('sequelize');
const Database = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();

class Job extends Model {}
Job.init({
  id         : { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id    : { type: DataTypes.INTEGER, allowNull: false },
  module_id  : { type: DataTypes.INTEGER, allowNull: false },
  status     : { type: DataTypes.ENUM('waiting', 'processing', 'completed', 'failed'), defaultValue: 'waiting' },
  created_at : { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at : { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName : 'Job',
  tableName : 'gm_jobs',
  timestamps: false,
  indexes   : [
    { name: 'idx_user_id',    fields: ['user_id'] },
    { name: 'idx_module_id',  fields: ['module_id'] },
    { name: 'idx_status',     fields: ['status']  }
  ]
});

module.exports = Job;
