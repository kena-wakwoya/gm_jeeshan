const BaseModel = require('./BaseModel');

class Combo extends BaseModel {
    static STATUS = {
        PENDING: 'pending',
        SUCCESS: 'success',
        FAILED: 'failed',
        RETRY: 'retry'
    };

    constructor() {
        super('gm_combos');
    }

    /**
     * Finds a combo entry by email and password.
     * @param {string} email
     * @param {string} password
     * @returns {Promise<Object|null>}
     */
    async findByEmailAndPassword(email, password) {
        const sql = `SELECT * FROM ${this._tableName} WHERE email = ? AND password = ?`;
        const [rows] = await this.query(sql, [email, password]);
        return rows[0] || null;
    }

    /**
     * Updates the status of a combo.
     * @param {number} id
     * @param {string} status (use Combo.STATUS)
     * @returns {Promise<boolean>}
     */
    async updateStatus(id, status) {
        if (!Object.values(Combo.STATUS).includes(status)) {
            throw new Error(`Invalid status: ${status}`);
        }
        return this.update(id, { status: status });
    }

    /**
     * Retrieves all combos for a given user.
     * @param {number} userId
     * @param {number} page
     * @param {number} perPage
     * @param {string|null} statusFilter (optional)
     * @returns {Promise<Object>}
     */
    async getCombosByUserIdPaginated(userId, page = 1, perPage = 10, statusFilter = null) {
        let params = { user_id: userId };
        if (statusFilter) {
            params.status = statusFilter;
        }
        return this.getAllPaginated(page, perPage, params);
    }
}

module.exports = new Combo();