const { Model, DataTypes } = require('sequelize');
const Database = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();

class JobProcessing extends Model {}
JobProcessing.init({
  id           : { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  job_id       : { type: DataTypes.INTEGER, allowNull: false },
  email        : { type: DataTypes.STRING,  allowNull: false },
  password     : { type: DataTypes.STRING,  allowNull: false },
  last_proxy   : { type: DataTypes.STRING },
  status       : { type: DataTypes.ENUM('pending','processing', 'success', 'fail',  'skipped'), defaultValue: 'pending' },
  retry_count  : { type: DataTypes.INTEGER, defaultValue: 0 },
  created_at   : { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at   : { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  sequelize,
  modelName : 'JobProcessing',
  tableName : 'gm_job_processing',
  timestamps: false,
  indexes   : [
    { name: 'idx_job_id',  fields: ['job_id'] },
    { name: 'idx_status', fields: ['status'] },
    { name: 'idx_email',  fields: ['email']  }
  ]
});

module.exports = JobProcessing;
