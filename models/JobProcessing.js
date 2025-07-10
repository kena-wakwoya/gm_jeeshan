const BaseModel = require('./BaseModel');

class JobProcessing extends BaseModel {
    static STATUS = {
        PENDING: 'pending',
        SUCCESS: 'success',
        FAIL: 'fail', // Matches your schema
        RETRY: 'retry',
        SKIPPED: 'skipped'
    };

    constructor() {
        super('gm_job_processing');
    }

    /**
     * Finds all job processing entries for a specific job ID.
     * This directly maps to your PHP `findJobProcessingByJobId` method.
     * @param {number} jobId The ID of the job.
     * @returns {Promise<Array<Object>>} An array of job processing entries.
     */
    async findByJobId(jobId) {
        const sql = `SELECT * FROM ${this._tableName} WHERE job_id = ?`;
        const [rows] = await this.query(sql, [jobId]);
        return rows;
    }

    /**
     * Creates a new job processing entry.
     * @param {Object} data
     * @returns {Promise<number>} Insert ID.
     */
    async createProcessingEntry(data) {
        if (data.status && !Object.values(JobProcessing.STATUS).includes(data.status)) {
            throw new Error(`Invalid job processing status: ${data.status}`);
        }
        return this.create(data);
    }

    /**
     * Updates the status and other details of a job processing entry based on specific conditions.
     * This directly maps to your PHP `updateProcessingStatus` method.
     * @param {number} id The ID of the job processing entry.
     * @param {string|null} status The new status (use JobProcessing.STATUS).
     * @param {number|null} retryCount If provided, updates retry_count.
     * @param {string|null} lastProxy If status is 'success', updates last_proxy.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async updateProcessingDetails(id, status = null, retryCount = null, lastProxy = null) {
        const dataToUpdate = {};

        if (retryCount !== null) {
            dataToUpdate.retry_count = retryCount;
        } else if (status === JobProcessing.STATUS.SUCCESS) {
            dataToUpdate.status = status;
            if (lastProxy !== null) {
                dataToUpdate.last_proxy = lastProxy;
            }
        } else if (status !== null) {
            dataToUpdate.status = status;
        }

        if (Object.keys(dataToUpdate).length === 0) {
            console.warn(`No valid update parameters provided for JobProcessing ID: ${id}`);
            return false; // No update to perform
        }

        // Validate status if it's being updated
        if (dataToUpdate.status && !Object.values(JobProcessing.STATUS).includes(dataToUpdate.status)) {
            throw new Error(`Invalid job processing status: ${dataToUpdate.status}`);
        }

        return this.update(id, dataToUpdate);
    }

    /**
     * Retrieves job processing entries for a specific user, with pagination.
     * This requires a JOIN with the gm_jobs table.
     * This directly maps to your PHP `getUserDataPaginated` method, correcting for table structure.
     * @param {number} userId The ID of the user.
     * @param {number} page The current page number.
     * @param {number} perPage The number of items per page.
     * @param {Object} [filters={}] Additional filters for gm_job_processing table.
     * @returns {Promise<Object>} Paginated job processing data.
     */
    async getForUserPaginated(userId, page = 1, perPage = 10, filters = {}) {
        // Construct WHERE clauses for filters on gm_job_processing
        let processingWhereClauses = [];
        let processingParams = [];
        for (const column in filters) {
            if (Object.prototype.hasOwnProperty.call(filters, column)) {
                processingWhereClauses.push(`jp.${column} = ?`);
                processingParams.push(filters[column]);
            }
        }
        const processingWhereString = processingWhereClauses.length > 0 ? ` AND ${processingWhereClauses.join(' AND ')}` : '';

        const customSql = `
            SELECT jp.*
            FROM ${this._tableName} jp
            JOIN gm_jobs j ON jp.job_id = j.id
            WHERE j.user_id = ? ${processingWhereString}
            ORDER BY jp.created_at DESC
        `;

        // Combine all parameters for the custom SQL query
        const allParams = [userId, ...processingParams];

        // Call getAllPaginated with the custom SQL and combined parameters
        // Note: getAllPaginated's params are used for both count and data queries.
        // For custom SQL, it expects the parameters for the custom SQL directly.
        // We pass an empty object for `params` because we're handling conditions
        // directly in `customSql`.
        return this.getAllPaginated(page, perPage, allParams, customSql);
    }


    /**
     * Counts job processing entries by job ID and specific statuses.
     * This directly maps to your PHP `countByJobAndStatus` method.
     * @param {number} jobId The ID of the job.
     * @returns {Promise<number>} The count of pending or retry entries (retry_count < 20).
     */
    async countPendingOrRetryByJob(jobId) {
        const sql = `
            SELECT COUNT(*) 
            FROM ${this._tableName}
            WHERE job_id = ? 
            AND (
                status = ?
                OR (status = ? AND retry_count < 20)
            )
        `;
        // Note: PHP query explicitly used 'pending' and 'retry'
        const [rows] = await this.query(sql, [jobId, JobProcessing.STATUS.PENDING, JobProcessing.STATUS.RETRY]);
        return parseInt(rows[0]['COUNT(*)'] || 0, 10);
    }
}

module.exports = new JobProcessing();