const BaseModel = require('./BaseModel');
const Database = require('./../config/Database'); // Import Database for transactions

class User extends BaseModel {
    // Define ENUM values as static properties for clarity and validation
    static ROLES = {
        ADMIN: 'ADMIN',
        USER: 'USER'
    };

    constructor() {
        super('gm_users');
    }

    /**
     * Finds a user by email.
     * @param {string} email The email of the user.
     * @returns {Promise<Object|null>} The user data or null if not found.
     */
    async findByEmail(email) {
        const sql = `SELECT * FROM ${this._tableName} WHERE email = ?`;
        const [rows] = await this.query(sql, [email]);
        return rows[0] || null;
    }

    /**
     * Retrieves the balance for a specified user.
     * This directly maps to your PHP `getBalance` method.
     * @param {number} userId The ID of the user.
     * @returns {Promise<number|null>} The user's balance as a float, or null if user not found.
     */
    async getBalance(userId) {
        const sql = `SELECT balance FROM ${this._tableName} WHERE id = ?`;
        const [rows] = await this.query(sql, [userId]);
        return rows.length > 0 ? parseFloat(rows[0].balance) : null;
    }

    /**
     * Updates the user's balance by adding the specified amount.
     * This directly maps to your PHP `updateBalance` method.
     * @param {number} userId The ID of the user.
     * @param {number} amount The amount to add to the user's current balance (can be negative for deductions).
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async updateBalance(userId, amount) {
        const sql = `UPDATE ${this._tableName} SET balance = balance + ? WHERE id = ?`;
        const [result] = await this.query(sql, [amount, userId]);
        return result.affectedRows > 0;
    }

    /**
     * Records a user transaction in the account history and updates the user's main balance.
     * This operation is wrapped in a transaction to ensure atomicity.
     * This directly maps to your PHP `recordUserTransaction` method.
     * @param {Object} data An object containing:
     * - 'user_id' (number): The ID of the user.
     * - 'amount' (number): The transaction amount.
     * - 'memo' (string): A description for the transaction.
     * @returns {Promise<boolean>} True if the transaction is recorded and balance updated successfully, otherwise false.
     */
    async recordUserTransaction(data) {
        const { user_id, amount, memo } = data;
        let connection;
        try {
            connection = await Database.getInstance().getPool().getConnection();
            await connection.beginTransaction();

            // 1. Calculate the new balance for the history record
            // Get the last balance from history for this user
            const [lastHistoryRows] = await connection.execute(
                `SELECT COALESCE(balance, 0) AS last_balance 
                 FROM gm_user_account_history 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC, id DESC LIMIT 1`,
                [user_id]
            );
            const lastBalanceInHistory = lastHistoryRows.length > 0 ? parseFloat(lastHistoryRows[0].last_balance) : 0;
            const newBalanceForHistory = lastBalanceInHistory + amount;

            // 2. Insert into gm_user_account_history
            const [historyResult] = await connection.execute(
                `INSERT INTO gm_user_account_history (user_id, amount, balance, memo) VALUES (?, ?, ?, ?)`,
                [user_id, amount, newBalanceForHistory, memo]
            );

            if (historyResult.affectedRows === 0) {
                throw new Error('Failed to record transaction history.');
            }

            // 3. Update the user's main balance in gm_users
            const [userUpdateResult] = await connection.execute(
                `UPDATE ${this._tableName} SET balance = balance + ? WHERE id = ?`,
                [amount, user_id]
            );

            if (userUpdateResult.affectedRows === 0) {
                throw new Error('Failed to update user balance.');
            }

            await connection.commit();
            return true;

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error in recordUserTransaction:', error.message);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Returns all transactions for a given user with pagination.
     * This directly maps to your PHP `getUserTransactions` method.
     * @param {number} userId The user ID to retrieve transactions for.
     * @param {number} page The current page number.
     * @param {number} itemsPerPage The number of items per page.
     * @returns {Promise<Object>} An object containing paginated transaction records and pagination info.
     */
    async getUserTransactionsPaginated(userId, page, itemsPerPage) {
        const customSql = `
            SELECT h.*, gm.username 
            FROM ${this._tableName} gm  
            LEFT JOIN gm_user_account_history h ON h.user_id = gm.id 
            WHERE gm.id = ? 
            ORDER BY h.created_at DESC
        `;
        // The `getAllPaginated` method will automatically handle the COUNT and LIMIT/OFFSET
        const paginationResult = await this.getAllPaginated(page, itemsPerPage, [userId], customSql);

        return {
            payload: paginationResult.payload,
            page: paginationResult.currentPage,
            items_per_page: paginationResult.perPage,
            total_records: paginationResult.totalRecords,
            total_pages: paginationResult.noOfPages
        };
    }
}

module.exports = new User();