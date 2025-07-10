const fs        = require('fs');
const path      = require('path');
const Database  = require('../config/Database');

const sequelize = Database.getInstance().getSequelize();
const db = {};

// Dynamically import every model file in this folder
fs.readdirSync(__dirname)
  .filter(file => file !== 'index.js' && file.endsWith('1.js') )
  .forEach(file => {
    const model = require(path.join(__dirname, file));
    db[model.name] = model;
  });

// Define associations
const {
  User,
  UserAccountHistory,
  Combo,
  Proxy,
  Module,
  DepositRequest,
  Job,
  JobProcessing
} = db;

// User ↔ other tables
User.hasMany(UserAccountHistory, { foreignKey: 'user_id', as: 'accountHistory' });
UserAccountHistory.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Combo, { foreignKey: 'user_id', as: 'combos' });
Combo.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Proxy, { foreignKey: 'user_id', as: 'proxies' });
Proxy.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Module, { foreignKey: 'created_by', as: 'modules' });
Module.belongsTo(User, { foreignKey: 'created_by' });

User.hasMany(DepositRequest, { foreignKey: 'user_id', as: 'depositRequests' });
DepositRequest.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Job, { foreignKey: 'user_id', as: 'jobs' });
Job.belongsTo(User, { foreignKey: 'user_id' });

// Module ↔ Job
Module.hasMany(Job, { foreignKey: 'module_id', as: 'jobs' });
Job.belongsTo(Module, { foreignKey: 'module_id' });

// Job ↔ JobProcessing
Job.hasMany(JobProcessing, { foreignKey: 'job_id', as: 'processItems' });
JobProcessing.belongsTo(Job, { foreignKey: 'job_id' });

// Job ↔ Proxy
Job.hasMany(Proxy, { foreignKey: 'job_id', as: 'proxies' });
Proxy.belongsTo(Job, { foreignKey: 'job_id' });

// Proxy ↔ JobProcessing (soft link: job_proc_id may be NULL)
JobProcessing.hasMany(Proxy, { foreignKey: 'job_proc_id', as: 'proxies' });
Proxy.belongsTo(JobProcessing, { foreignKey: 'job_proc_id' });


db.sequelize = sequelize;
db.Sequelize = sequelize.constructor;

module.exports = db;
