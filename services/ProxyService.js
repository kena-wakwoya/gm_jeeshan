const { Op, Sequelize } = require('sequelize');
const { Proxy } = require('../models');
const AppError = require('../utils/AppError');

class ProxyService {
    constructor() {
        this.model = Proxy;
    }

   
    async saveProxiesForJob(jobId, userId, proxies, transaction) {
        if (!Array.isArray(proxies) || proxies.length === 0) return true;

        const rows = proxies.map(p => ({
            job_id: jobId,
            user_id: userId,
            proxy: p,
            status: 'active'
        }));

        // ONE bulk insert in the SAME transaction 👇
        await this.model.bulkCreate(rows, { transaction });
        return true;
    }


    /**
     * Updates proxy to mark it as used and associate it with a processing ID.
     */
    async setProxyLastUsed(jobId, proxyId, processingId) {
        const proxy = await this.model.findOne({ where: { id: proxyId, job_id: jobId } });
        if (!proxy) throw new AppError(`Proxy with ID ${proxyId} not found for job ${jobId}`, 404);

        try {
            proxy.job_proc_id = processingId;
            await proxy.save();
            return true;
        } catch (error) {
            throw new AppError(`Error updating proxy usage: ${error.message}`, 500);
        }
    }

    /**
     * Get the next available active proxy for a job that hasn't been used in another processing step.
     */
    async getNextAliveProxy(jobId, currentProcId) {
        try {
            const proxy = await this.model.findOne({
                where: {
                    job_id: jobId,
                    status: 'active',
                    [Op.or]: [ // Use Op.or to combine conditions
            {
                job_proc_id: {
                    [Op.ne]: currentProcId // Condition 1: not equal to currentProcId
                }
            },
            {
                job_proc_id: {
                    [Op.is]: null // Condition 2: is NULL
                }
            }
        ]
                },
               order: [Sequelize.literal('RAND()')]
            });
            return proxy || null;
        } catch (error) {
            throw new AppError(`Error fetching next proxy: ${error.message}`, 500);
        }
    }

    /**
     * Marks a proxy as dead.
     */
    async markProxyDead(jobId, proxyId) {
        const proxy = await this.model.findOne({ where: { id: proxyId, job_id: jobId } });
        if (!proxy) throw new AppError(`Proxy with ID ${proxyId} not found for job ${jobId}`, 404);

        try {
            proxy.status = 'dead';
            await proxy.save();
            return true;
        } catch (error) {
            throw new AppError(`Error marking proxy as dead: ${error.message}`, 500);
        }
    }
}

module.exports = new ProxyService();
