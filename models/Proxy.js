const BaseModel = require('./BaseModel');

class Proxy extends BaseModel {
    static STATUS = {
        ACTIVE: 'active',
        DEAD: 'dead',
        RETRY: 'retry'
    };

    constructor() {
        super('gm_proxies');
    }

    /**
     * Retrieves the next available active proxy for a given job, excluding the one
     * associated with a specific job processing ID.
     * This directly maps to your PHP `getNextAliveProxy` method.
     * @param {number} jobId The ID of the job requesting the proxy.
     * @param {number} processingId The ID of the job processing entry using the proxy.
     * @returns {Promise<Object|null>} The proxy data or null if no active proxy is found.
     */
    async getNextAvailableProxy(jobId, processingId) {
        // The PHP `lastUsed` parameter was only for logging and not used in the query itself.
        // We will exclude proxies currently tied to this specific processing ID.
        const sql = `
            SELECT * FROM ${this._tableName} 
            WHERE job_id = ?
              AND status = ?
              AND (job_proc_id IS NULL OR job_proc_id != ?) 
            ORDER BY RAND() LIMIT 1
        `;
        const [rows] = await this.query(sql, [jobId, Proxy.STATUS.ACTIVE, processingId]);
        return rows[0] || null;
    }

    /**
     * Marks a proxy as used for a specific job processing entry.
     * This directly maps to your PHP `setLastUsed` method.
     * @param {number} proxyId The ID of the proxy.
     * @param {number} jobId The ID of the job the proxy belongs to.
     * @param {number} processingId The ID of the job processing entry using this proxy.
     * @returns {Promise<boolean>} True if the update was successful, false otherwise.
     */
    async setLastUsed(proxyId, jobId, processingId) {
        const sql = `
            UPDATE ${this._tableName} 
            SET already_used = ?, job_proc_id = ? 
            WHERE id = ? AND job_id = ?
        `;
        const [result] = await this.query(sql, [true, processingId, proxyId, jobId]);
        return result.affectedRows > 0;
    }

    /**
     * Updates the status of a proxy for a specific job.
     * This directly maps to your PHP `updateProxyStatus` method.
     * @param {number} proxyId The ID of the proxy.
     * @param {number} jobId The ID of the job the proxy belongs to.
     * @param {string} status The new status (use Proxy.STATUS).
     * @returns {Promise<boolean>} True if the update was successful, false otherwise.
     */
    async updateProxyStatus(proxyId, jobId, status) {
        if (!Object.values(Proxy.STATUS).includes(status)) {
            throw new Error(`Invalid proxy status: ${status}`);
        }
        const sql = `
            UPDATE ${this._tableName} 
            SET status = ? 
            WHERE id = ? AND job_id = ?
        `;
        const [result] = await this.query(sql, [status, proxyId, jobId]);
        return result.affectedRows > 0;
    }

    /**
     * Performs a bulk insert of multiple proxy records.
     * Assumes the 'proxy' column stores the full address (e.g., 'ip:port' or 'user:pass@ip:port').
     * Each item in 'data' should be an object like { user_id: N, job_id: M, proxy: 'some:proxy' }.
     * This directly maps to your PHP `bulkInsert` method, adjusting for the `gm_proxies` schema.
     * @param {Array<Object>} data An array of proxy objects to insert.
     * @returns {Promise<boolean>} True if the bulk insert was successful, false otherwise.
     */
    async bulkInsert(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return false;
        }

        const columns = ['user_id', 'job_id', 'proxy', 'status']; // Adjusted based on your schema
        const placeholders = data.map(() => `(?, ?, ?, ?)`).join(', '); // 4 placeholders per row
        const values = [];

        data.forEach(item => {
            values.push(
                item.user_id,
                item.job_id, // Added job_id as it's NOT NULL in schema
                item.proxy, // Assumes `item.proxy` is the combined string like 'ip:port'
                item.status || Proxy.STATUS.ACTIVE // Default to 'active'
            );
        });

        const sql = `INSERT INTO ${this._tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
        try {
            const [result] = await this.query(sql, values);
            return result.affectedRows > 0; // Or result.insertId if you need the first ID
        } catch (error) {
            console.error('Error during bulk proxy insert:', error.message);
            throw error;
        }
    }

    // Existing methods from previous versions
    // async markAsUsed(proxyId, jobProcId = null) { ... } // Replaced by setLastUsed
    // async resetProxiesForJob(jobId) { ... }
    // async getUnusedProxiesForJob(jobId) { ... }
    // async getProxiesByJobIdPaginated(jobId, page = 1, perPage = 10) { ... }
}

module.exports = new Proxy();