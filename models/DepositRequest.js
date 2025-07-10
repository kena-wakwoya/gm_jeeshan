const BaseModel = require('./BaseModel');

class DepositRequest extends BaseModel {
    static STATUS = {
        PENDING: 'pending',
        SETTLED: 'settled',
        EXPIRED: 'expired',
        FAILED: 'failed'
    };

    constructor() {
        super('gm_deposits_request');
    }

    /**
     * Records new deposit data.
     * This method directly maps to your PHP `recordData` method.
     * @param {Object} data - Key-value pairs matching table columns.
     * @returns {Promise<number>} The ID of the newly created record.
     */
    async recordData(data) {
        // Ensure status is valid if provided, otherwise default 'pending'
        if (data.status && !Object.values(DepositRequest.STATUS).includes(data.status)) {
            throw new Error(`Invalid deposit status: ${data.status}`);
        }
        return this.create(data);
    }

    /**
     * Finds a deposit request by its invoice ID.
     * This directly maps to your PHP `findByInvoiceId` method.
     * @param {string} invoiceId The invoice ID to search for.
     * @returns {Promise<Object|null>} The deposit request data or null if not found.
     */
    async findByInvoiceId(invoiceId) {
        const sql = `SELECT * FROM ${this._tableName} WHERE invoice_id = ?`;
        const [rows] = await this.query(sql, [invoiceId]);
        return rows[0] || null;
    }

    /**
     * Updates the status of a deposit request using its invoice ID.
     * This directly maps to your PHP `updateStatus` method.
     * @param {string} invoiceId The invoice ID of the record to update.
     * @param {string} status The new status (e.g., 'settled', 'expired', 'failed'). Use DepositRequest.STATUS.
     * @param {Object} [additionalData={}] Optional additional data to update.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async updateStatus(invoiceId, status, additionalData = {}) {
        if (!Object.values(DepositRequest.STATUS).includes(status)) {
            throw new Error(`Invalid deposit status: ${status}`);
        }

        const dataToUpdate = { status: status, ...additionalData };
        const fields = Object.keys(dataToUpdate).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(dataToUpdate), invoiceId];

        const sql = `UPDATE ${this._tableName} SET ${fields} WHERE invoice_id = ?`;
        const [result] = await this.query(sql, values);
        return result.affectedRows > 0;
    }

    /**
     * Finds deposit requests by user ID.
     * @param {number} userId
     * @param {number} page
     * @param {number} perPage
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getDepositsByUserIdPaginated(userId, page = 1, perPage = 10, filters = {}) {
        const params = { user_id: userId, ...filters };
        return this.getAllPaginated(page, perPage, params);
    }
}

module.exports = new DepositRequest();