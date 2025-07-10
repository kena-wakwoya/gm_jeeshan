const userService = require('../services/UserService');   
const moduleService = require('../services/ModuleService'); 
const AppError = require('../utils/AppError');
const path = require('path');
const fs = require('fs/promises');
const JobsAndProcessingService = require('../services/JobsAndProcessingService');

// Helper to parse file content or textarea input
const parseInputToArray = (input) => {
    if (!input) return [];

    let processedInput = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (processedInput.indexOf('\n') === -1 && processedInput.indexOf(',') !== -1) {
        return processedInput.split(',').map(item => item.trim()).filter(item => item !== "");
    } else {
        return processedInput.split('\n').map(item => item.trim()).filter(item => item !== "");
    }
};


const userController = {
   
    async register(req, res, next) {
        const { first_name, last_name, username, email, password } = req.body;
        if (!first_name || !last_name || !username || !email || !password) {
            return next(new AppError('All fields are required.', 400));
        }

        try {
            const result = await userService.register({ first_name, last_name, username, email, password });

            if (result && result.success) {
                return res.status(201).json({
                    status: 'success',
                    message: 'Registration successful. You can now log in.'
                });
            } else {
                return next(new AppError(result.message || 'Registration failed.', 400));
            }
        } catch (error) {
            return next(error);
        }
    },

  
    async makeDeposit(req, res, next) {
        const userId = req.user.id; 
        const { amount, reason } = req.body;
        const memo = reason || "Deposit";

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return next(new AppError('Invalid amount. Amount must be a positive number.', 400));
        }

        try {
            const data = {
                user_id: userId,
                amount: amount,
                memo: memo
            };
            const newBalance = await userService.addBalance(data);

            if (newBalance !== false) { 
                return res.status(200).json({
                    status: 'success',
                    message: 'Deposit successful.',
                    new_balance: newBalance
                });
            } else {
                return next(new AppError('Failed to process deposit.', 500));
            }
        } catch (error) {
            return next(error); 
        }
    },


    async showTransactionHistory(req, res, next) {
        const userId = req.user.id; 
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

        const pagination_data = { page, items_per_page: itemsPerPage };

        try {
            const transactions = await userService.getUserTransactions(userId, pagination_data);
            return res.status(200).json({
                status: 'success',
                data: transactions 
            });
        } catch (error) {
            return next(error);
        }
    },


    async getModulesForUpload(req, res, next) {
        try {
            const modules = await moduleService.getModulesForUpload();
            return res.status(200).json({
                status: 'success',
                data: modules
            });
        } catch (error) {
            return next(error);
        }
    },
    async handleUpload(req, res, next) {
        try {

            const { combo_text, proxy_text, module_id } = req.body;           
            if (!combo_text) {
                return res.status(400).json({ status: 'fail', message: 'Combo input missing.' });
            }
            if (!proxy_text) {
                return res.status(400).json({ status: 'fail', message: 'Proxy input missing.' });
            }
            if (!module_id) {
                return res.status(400).json({ status: 'fail', message: 'Module not selected.' });
            }
            const requesting_user = req.user.id;
            const parsedCombo = parseInputToArray(combo_text);
            const parsedProxy = parseInputToArray(proxy_text);

            // Proceed to create job
            // await userService.processCombosAndProxies(parsedComobo, parsedProxy,  requesing_user,module_id);

            // Fire the job in background (no await)
            userService.processCombosAndProxies(parsedCombo, parsedProxy, requesting_user, module_id)
                .then(() => {
                    console.log(`[JOB] Completed for user ${requesting_user}`);
                })
                .catch(err => {
                    console.error(`[JOB ERROR] user ${requesting_user}:`, err);
                });

            // Respond immediately
            return res.status(200).json({
                status: 'success',
                message: 'Job started in background.'
            });
        } catch (err) {
            console.error('Upload handler error:', err);
            return res.status(500).json({ status: 'error', message: 'Server error during upload.' });
        }
    },

    async handleUpload1(req, res, next) {
        const userId = req.user.id; 
       
        const comboInput = req.body.combo_text;
        const proxyInput = req.body.proxy_text;
        const moduleId = req.body.module_id;
        if (!moduleId) {
            return next(new AppError('Module ID is required.', 400));
        }

        let finalComboInput = comboInput;
        let finalProxyInput = proxyInput;

        if (req.files && req.files.combo_file && req.files.combo_file[0]) {
            // Multer stores temp file path
            finalComboInput = await fs.readFile(req.files.combo_file[0].path, 'utf8');
        }
        if (req.files && req.files.proxy_file && req.files.proxy_file[0]) {
            finalProxyInput = await fs.readFile(req.files.proxy_file[0].path, 'utf8');
        }

        // Cleanup temp files after reading
        if (req.files && req.files.combo_file && req.files.combo_file[0]) {
            await fs.unlink(req.files.combo_file[0].path).catch(e => console.error("Error deleting temp combo file:", e));
        }
        if (req.files && req.files.proxy_file && req.files.proxy_file[0]) {
            await fs.unlink(req.files.proxy_file[0].path).catch(e => console.error("Error deleting temp proxy file:", e));
        }


        if (!finalComboInput || !finalProxyInput) {
            return next(new AppError('Combos and proxies (textarea or file) are required.', 400));
        }

        const comboArray = parseInputToArray(finalComboInput);
        const proxyArray = parseInputToArray(finalProxyInput);

        if (comboArray.length === 0 || proxyArray.length === 0) {
            return next(new AppError('Combos and proxies (textarea or file) are required and must contain valid entries.', 400));
        }

        try {
            // Assuming processCombosAndProxies handles job creation and returns job ID or success status
            const jobId = await userService.processCombosAndProxies(comboArray, proxyArray, userId, moduleId);

            if (jobId) {
                return res.status(200).json({
                    status: 'success',
                    message: `Job processing initiated for Job ID ${jobId}.`,
                    job_id: jobId
                });
            } else {
                return next(new AppError('Failed to initiate job processing.', 500));
            }
        } catch (error) {
            return next(error); 
        }
    },

  
    async processJob(req, res, next) {
        const { job_id: jobId } = req.body;

        if (!jobId) {
            return next(new AppError('Job ID is required.', 400));
        }

        try {
            const result = await userService.processJob(jobId);
            if (result) {
                return res.status(200).json({
                    status: 'success',
                    message: `Job ${jobId} started for processing.`,
                    data: result 
                });
            } else {
                return next(new AppError('Failed to start job processing.', 500));
            }
        } catch (error) {
            return next(error); 
        }
    },


    async jobList(req, res, next) {
        const user = req.user; 
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

        let jobs;
        try {
            if (user.role === 'ADMIN') {
                jobs = await userService.getAllJobs(page, itemsPerPage);
            } else if (user.role === 'USER') {
                jobs = await userService.getUsersAllJob(user.id, page, itemsPerPage);
            } else {
                return next(new AppError('User role not recognized.', 403));
            }

            return res.status(200).json({
                status: 'success',
                data: jobs
            });
        } catch (error) {
            return next(error); 
        }
    },

    async jobDetail(req, res, next) {
        const user = req.user; 
        const jobId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 50;
        if (!jobId) {
            return next(new AppError('Job ID is missing.', 400));
        }

        try {
            const job = await userService.getJobDetails(jobId, page, itemsPerPage);

            if (!job) {
                return next(new AppError(`Job with ID ${jobId} not found.`, 404));
            }

            console.log("Job details:", job);

            return res.status(200).json({
                status: 'success',
                data: job
            });
        } catch (error) {
            return next(error); 
        }
    }
};

module.exports = userController;