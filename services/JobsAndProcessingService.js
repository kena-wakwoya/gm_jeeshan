const { Op, col, fn, literal, Sequelize } = require('sequelize');
const jobModel = require('../models/Job1');
const moduleModel = require('../models/Module1');
const userModel = require('../models/User1');
const jobProcessingModel = require('../models/JobProcessing1');
const proxyService = require('./ProxyService');
const userService = require('./UserService');
const moduleService = require('./ModuleService');
const AppError = require('../utils/AppError');
const httpClient = require('../utils/HttpClient');
const captchaService = require('./CaptchaService');
const cheerio = require('cheerio');
const  loginWithPlaywright  = require('./../utils/PlaywrightLoginHelper.cjs');

class JobsAndProcessingService {
    static MAX_RETRIES = parseInt(process.env.JOB_MAX_RETRIES || 20, 10);

    async createJob(userId, moduleId, combos, proxies) {

        const transaction = await jobModel.sequelize.transaction();
        try {
            const job = await jobModel.create({
                user_id: userId,
                module_id: moduleId,
                status: 'waiting'
            }, );

            const processingItems = combos.map(combo => {
                const [email, password] = combo.split(':').map(part => part.trim());
                return {
                    job_id: job.id,
                    email,
                    password,
                    status: 'pending',
                    retry_count: 0,
                    last_proxy: null
                };
            });

            await jobProcessingModel.bulkCreate(processingItems, );
            await proxyService.saveProxiesForJob(job.id, userId, proxies, transaction);
            await transaction.commit();
            return job.id;
        } catch (error) {
            await transaction.rollback();
            throw new AppError(`Error creating job: ${error.message}`, error.statusCode || 500);
        }
    }

    async startJob(jobId) {
        const job = await jobModel.findByPk(jobId);
        if (!job || job.status !== 'waiting') {
            throw new AppError('Job is not in waiting state or does not exist.', 400);
        }
        job.status = 'processing';
        await job.save();
        return true;
    }

    async findJobProcessingByJobId(jobId) {
        return jobProcessingModel.findAll({ where: { job_id: jobId } });
    }

    async processJobItem(jobProcessingId, user) {
        // const transaction = await jobProcessingModel.sequelize.transaction();
        try {
            const item = await jobProcessingModel.findByPk(jobProcessingId);
            if (!item || !['pending'].includes(item.status)) {
                return false;
            }
            //job processing started and status is in processing
            item.status = 'processing';
            await item.save();
            const job = await jobModel.findByPk(item.job_id);
            const module = await moduleService.getModuleById(job.module_id);


            if (!job || !module || !user) throw new AppError('Missing job/module/user.', 404);
            const post_data = module.post_data;
            const retryCount = item.retry_count;
            const excludeProxyIds = item.last_proxy ? [item.last_proxy] : [];

            // if (module.requires_captcha && module.captcha_keys?.captcha_url) {
            //     try {
            //         const siteKey = await this.extractSiteKeyFromPage(module.captcha_keys.captcha_url);
            //         if (siteKey) {
            //             const captchaToken = await captchaService.solveCaptcha(
            //                 module.captcha_keys.captcha_type,
            //                 siteKey,
            //                 module.captcha_keys.captcha_url,
            //                 user.captcha_api_key
            //             );
            //             post_data['g-recaptcha-response'] = captchaToken;
            //         }
            //     } catch (err) {
            //         item.retry_count++;
            //         item.status = 'retry';
            //         await item.save();
            //         await transaction.commit();
            //         return false;
            //     }
            // }

            while (item.retry_count < JobsAndProcessingService.MAX_RETRIES) {
                console.log('Processing job item retry count :', item);
                const proxy = await proxyService.getNextAliveProxy(job.id, jobProcessingId);
                console.log('Processing job item proxy random:', proxy);
                if (!proxy) {
                    item.status = 'skipped';
                    await item.save();
                    await this.checkAndCompleteJob(job.id);
                    return false;
                }
                //set this current proxy as used
                await proxyService.setProxyLastUsed(job.id, proxy.id, jobProcessingId);
                //got to playwright and try to login
                const result = await loginWithPlaywright({
                    proxy: proxy.proxy,
                    email: item.email,
                    password: item.password,
                    module
                });

                // console.log('[Playwright Result]', result);


                if (!result || result.status === 'error') {
                    item.retry_count++;
                    item.save();
                    continue
                }
                const responseContent = result.contentSnippet;
                console.log('[Response Content]', responseContent);
                if (this.containsKeyword(responseContent, module.extra_data?.success_key)) {
                    item.status = 'success';
                    item.last_proxy = proxy.proxy;
                    await item.save();
                    await this.deductUserBalance({ user_id: user.id, amount: -1* module.price, memo: 'Job Processing fee' }, transaction);
                    await this.checkAndCompleteJob(job.id, transaction);
                   
                    return true;
                } else if (this.containsKeyword(responseContent, module.extra_data?.fail_key)) {
                    item.status = 'fail';
                    item.last_proxy = proxy.proxy;
                    await item.save();
                    await this.checkAndCompleteJob(job.id);
                   
                    return false;
                } else {
                    item.retry_count++;                    
                    item.last_proxy = proxy.proxy;
                    await item.save();
                    continue
                }
            }

            item.status = 'skipped';
            await item.save();
            await this.checkAndCompleteJob(job.id);
            return false;
        } catch (err) {
            throw new AppError(`Error processing job item: ${err.message}`, err.statusCode || 500);
        }
    }

    async checkAndCompleteJob(jobId) {
        const pending = await jobProcessingModel.count({
            where: {
                job_id: jobId,
                status: { [Op.in]: ['pending', 'retry'] }
            }
        });
        if (pending === 0) {
            await jobModel.update({ status: 'completed' }, { where: { id: jobId }});
        }
    }

    async deductUserBalance(data, transaction) {
        const success = await userService.addBalance(data, transaction);
        if (!success) throw new AppError('Failed to deduct user balance.', 500);
    }

    extractHiddenFields(html) {
        if (!html) return {};
        const $ = cheerio.load(html);
        const fields = {};
        $('input[type="hidden"]').each((_, el) => {
            const name = $(el).attr('name');
            const value = $(el).attr('value');
            if (name) fields[name] = value;
        });
        return fields;
    }

    async extractSiteKeyFromPage(url) {
        const { response: html } = await httpClient.sendRequest(url, 'GET');
        const match = html?.match(/data-sitekey=["'](.+?)["']/);
        return match ? match[1] : null;
    }

    containsKeyword(content, keyString) {
        if (!content || !keyString) return false;
        const keywords = keyString.split(',').map(k => k.trim().replace(/^['"]|['"]$/g, ''));
        return keywords.some(k => content.toLowerCase().includes(k.toLowerCase()));
    }

    async getJobResults(userId, page = 1, perPage = 20) {
        return jobProcessingModel.getUserDataPaginated(userId, page, perPage);
    }

    async getUsersAllCompletedJobs(userId, page = 1, perPage = 20) {
        return jobModel.getCompletedUserJobsPaginated(userId, page, perPage);
    }

    async getUsersAllFailedJobs(userId, page = 1, perPage = 20) {
        return jobModel.getFailedUserJobsPaginated(userId, page, perPage);
    }

    async getUsersAllJobs(userId, page = 1, perPage = 20) {
        const offset = (page - 1) * perPage;

        try {
            const { count, rows } = await jobModel.findAndCountAll({
                limit: perPage,
                offset,
                order: [['created_at', 'DESC']],
                attributes: {
                    include: [
                        [jobModel.sequelize.col('User.username'), 'username'],
                        [jobModel.sequelize.col('Module.module_name'), 'module_name']
                    ]
                },
                include: [
                    {
                        model: userModel,
                        attributes: []
                    },
                    {
                        model: moduleModel,
                        attributes: [] 
                    }
                ],
                raw: true,
                where: {
                    user_id: userId
                }
            });

            return {
                totalRecords: count,
                currentPage: page,
                totalPages: Math.ceil(count / perPage),
                perPage: perPage,
                payload: rows // 👈 converts model instances to plain objects
            };
        } catch (error) {
            throw new AppError(`Error fetching all modules: ${error.message}`, 500);
        }
    }

    async getAllJobs(page = 1, perPage = 20) {
        const offset = (page - 1) * perPage;

        try {
            const { count, rows } = await jobModel.findAndCountAll({
                limit: perPage,
                offset,
                order: [['created_at', 'DESC']],
                attributes: {
                    include: [
                        [jobModel.sequelize.col('User.username'), 'username'],
                        [jobModel.sequelize.col('Module.module_name'), 'module_name']
                    ]
                },
                include: [
                    {
                        model: userModel,
                        attributes: []
                    },
                    {
                        model: moduleModel,
                        attributes: []
                    }
                ],
                raw: true,
            });

            return {
                totalRecords: count,
                currentPage: page,
                totalPages: Math.ceil(count / perPage),
                perPage: perPage,
                payload: rows
            };
        } catch (error) {
            throw new AppError(`Error fetching all modules: ${error.message}`, 500);
        };
    }

    async getJobDetails(jobId, page = 1, limit = 50) {
        const offset = (page - 1) * limit;

        const { count, rows: details } = await jobProcessingModel.findAndCountAll({
            where: { job_id: jobId },
            limit,
            offset,
            attributes: {
                include: [
                    [Sequelize.col('Job.User.username'), 'username'],
                    [Sequelize.col('Job.Module.module_name'), 'module_name']
                ]
            },
            include: [
                {
                    model: jobModel,
                    as: 'Job',
                    attributes: [ ['id', 'job_id'],
  ['status', 'job_status']],
                    include: [
                        {
                            model: userModel,
                            as: 'User',
                            attributes: []
                        },
                        {
                            model: moduleModel,
                            as: 'Module',
                            attributes: []
                        }
                    ]
                }
            ],
            raw: true
        });
        const data = {
            totalRecords: count,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                perPage: limit,
                details: details
        }
        

        if (!details || details.length === 0) {
            throw new AppError('Job not found', 404);
        }
        const summary = await jobProcessingModel.findAll({
            where: { job_id: jobId },
            attributes: [
                'status',
                [fn('COUNT', col('status')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        return { count,data, summary }
    }

}

module.exports = new JobsAndProcessingService();
