const BaseModel = require('./BaseModel');

class Job extends BaseModel {
    static STATUS = {
        WAITING: 'waiting',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed'
    };

    constructor() {
        super('gm_jobs');
    }

    /**
     * Finds a job by its ID. (Directly uses BaseModel's findById)
     * This directly maps to your PHP `findJobById` method.
     * @param {number} jobId
     * @returns {Promise<Object|null>} The job data or null if not found.
     */
    async findById(jobId) {
        return super.findById(jobId);
    }

    /**
     * Creates a new job.
     * @param {number} userId
     * @param {number} moduleId
     * @returns {Promise<number>} Insert ID.
     */
    async createJob(userId, moduleId) {
        const data = {
            user_id: userId,
            module_id: moduleId,
            status: Job.STATUS.WAITING // Default status
        };
        return this.create(data);
    }

    /**
     * Updates the status of a job.
     * This directly maps to your PHP `updateJobStatus` method.
     * @param {number} jobId
     * @param {string} status (use Job.STATUS)
     * @returns {Promise<boolean>}
     */
    async updateStatus(jobId, status) {
        if (!Object.values(Job.STATUS).includes(status)) {
            throw new Error(`Invalid job status: ${status}`);
        }
        return this.update(jobId, { status: status });
    }

    /**
     * Retrieves all detailed jobs for a specific user with pagination.
     * This directly maps to your PHP `getUserJobsPaginated` method.
     * @param {number} userId
     * @param {number} page
     * @param {number} perPage
     * @returns {Promise<Object>} Paginated job data including module name, username, and total combos.
     */
    async getDetailedUserJobsPaginated(userId, page = 1, perPage = 10) {
        // Note: We need to use aliases in the outer query for `getAllPaginated` to correctly count.
        // The `WHERE gm_users.id = :user_id` should be passed as a parameter for getAllPaginated.
        const customSql = `
            SELECT 
                gm_jobs.id,
                gm_jobs.status,
                gm_jobs.created_at,
                gm_jobs.updated_at,
                gm_modules.module_name,
                gm_users.username,
                IFNULL(job_counts.total_combos, 0) AS total_combos
            FROM gm_jobs 
            LEFT JOIN gm_modules ON gm_jobs.module_id = gm_modules.id 
            LEFT JOIN gm_users ON gm_jobs.user_id = gm_users.id 
            LEFT JOIN (
                SELECT job_id, COUNT(*) AS total_combos 
                FROM gm_job_processing 
                GROUP BY job_id
            ) AS job_counts ON gm_jobs.id = job_counts.job_id
            WHERE gm_users.id = ?
        `;
        // Pass userId as a parameter for the WHERE clause
        return this.getAllPaginated(page, perPage, [userId], customSql);
    }

    /**
     * Retrieves all jobs with pagination, including module name, username, and total combos.
     * This directly maps to your PHP `getAllJobsPaginated` method.
     * @param {number} page
     * @param {number} perPage
     * @returns {Promise<Object>} Paginated job data.
     */
    async getAllDetailedJobsPaginated(page = 1, perPage = 10) {
        const customSql = `
            SELECT 
                gm_jobs.id,
                gm_jobs.status,
                gm_jobs.created_at,
                gm_jobs.updated_at,
                gm_modules.module_name,
                gm_users.username,
                IFNULL(job_counts.total_combos, 0) AS total_combos
            FROM gm_jobs 
            LEFT JOIN gm_modules ON gm_jobs.module_id = gm_modules.id 
            LEFT JOIN gm_users ON gm_jobs.user_id = gm_users.id 
            LEFT JOIN (
                SELECT job_id, COUNT(*) AS total_combos 
                FROM gm_job_processing 
                GROUP BY job_id
            ) AS job_counts ON gm_jobs.id = job_counts.job_id
            ORDER BY gm_jobs.id DESC
        `;
        // No additional parameters needed for this specific query's WHERE clause
        return this.getAllPaginated(page, perPage, [], customSql);
    }

    /**
     * Retrieves job processing details for a specific job ID, including various counts and proxy data.
     * This directly maps to your PHP `jobDetails` method.
     * @param {number} jobId
     * @returns {Promise<Array<Object>>} An array of detailed job processing results.
     */
    async getJobDetails(jobId) {
        const sql = `
            SELECT 
                m.module_name,
                jp.*,
                j.status AS job_status,
                IFNULL(job_counts.total_combos, 0) AS total_combos,
                IFNULL(job_counts.success_count, 0) AS success_count,
                IFNULL(job_counts.skipped_count, 0) AS skipped_count,
                IFNULL(job_counts.fail_count, 0) AS fail_count,
                proxy_data.proxy AS proxy
            FROM gm_job_processing jp
            -- Main job
            INNER JOIN gm_jobs j ON jp.job_id = j.id
            -- Module name
            LEFT JOIN gm_modules m ON j.module_id = m.id
            -- Combined counts (total, success, skipped, fail, retry)
            LEFT JOIN (
                SELECT 
                    job_id,
                    COUNT(*) AS total_combos,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) AS success_count,
                    COUNT(CASE WHEN status = 'skipped' THEN 1 END) AS skipped_count,
                    COUNT(CASE WHEN status = 'fail' THEN 1 END) AS fail_count
                FROM gm_job_processing
                GROUP BY job_id
            ) AS job_counts ON jp.job_id = job_counts.job_id
            -- Latest used proxy
            LEFT JOIN (
                SELECT job_id, proxy
                FROM (
                    SELECT job_id, proxy,
                           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY id DESC) AS rn
                    FROM gm_proxies
                    WHERE already_used = 1
                ) p
                WHERE p.rn = 1
            ) AS proxy_data ON j.id = proxy_data.job_id
            WHERE j.id = ?;
        `;
        const [rows] = await this.query(sql, [jobId]);
        return rows;
    }

    // Existing method that handles filtering by user_id and status (e.g., 'completed', 'failed')
    // This method effectively covers getCompletedUserJobsPaginated and getFailedUserJobsPaginated
    async getJobsByUserIdPaginated(userId, page = 1, perPage = 10, statusFilter = null) {
        let params = { user_id: userId };
        if (statusFilter) {
            params.status = statusFilter;
        }
        return this.getAllPaginated(page, perPage, params);
    }
}

module.exports = new Job();