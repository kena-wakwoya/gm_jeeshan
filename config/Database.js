const { Sequelize } = require('sequelize');
const DatabaseConfig = require('./databaseConfig');

class Database {
    static #instance = null;
    #sequelize = null;

    /**
     * Private-by-convention constructor to enforce the singleton pattern.
     * Initializes the Sequelize instance.
     */
    constructor() {
        if (Database.#instance) {
            return Database.#instance;
        }

        console.log('Initializing Sequelize connection...');
        this.#sequelize = new Sequelize(
            DatabaseConfig.NAME,
            DatabaseConfig.USER,
            DatabaseConfig.PASS,
            {
                host: DatabaseConfig.HOST,
                dialect: DatabaseConfig.DIALECT,
                logging: false, // Set to true to see SQL queries in console
                pool: {
                    max: 10,
                    min: 0,
                    acquire: 30000,
                    idle: 10000
                }
            }
        );

        Database.#instance = this;
    }

    /**
     * Gets the singleton instance of the Database class.
     * If an instance does not exist, it creates one.
     * @returns {Database} The singleton Database instance.
     */
    static getInstance() {
        if (!Database.#instance) {
            new Database();
        }
        return Database.#instance;
    }

    /**
     * Returns the underlying Sequelize instance.
     * @returns {Sequelize} The Sequelize instance.
     */
    getSequelize() {
        return this.#sequelize;
    }

    /**
     * Asynchronously tests the database connection.
     * @returns {Promise<void>}
     */
    async testConnection() {
        try {
            await this.#sequelize.authenticate();
            console.log('Successfully connected to MySQL database: Jeeshan_Global_Market via Sequelize!');
        } catch (err) {
            console.error('Failed to connect to MySQL database:', err.message);
            throw err;
        }
    }

    /**
     * Synchronizes all defined models with the database.
     * This will create tables if they don't exist.
     * Use { force: true } with caution as it will drop existing tables.
     * @param {object} options Options for synchronization (e.g., { force: true })
     * @returns {Promise<void>}
     */
    async syncModels(options = {}) {
        try {
            await this.#sequelize.sync(options);
            console.log('All models synchronized successfully.');
        } catch (err) {
            console.error('Failed to synchronize models:', err.message);
            throw err;
        }
    }
}

module.exports = Database;