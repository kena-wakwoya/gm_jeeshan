require('dotenv').config();

const DatabaseConfig = {
    HOST: process.env.DB_HOST || 'localhost',
    NAME: process.env.DB_DATABASE || 'gm_db',
    USER: process.env.DB_USER || 'admin',
    PASS: process.env.DB_PASSWORD || 'password',
    PORT: process.env.DB_PORT || 3306,
    DIALECT: 'mysql'
};

Object.freeze(DatabaseConfig); // Make properties read-only

module.exports = DatabaseConfig;