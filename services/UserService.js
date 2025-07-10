const bcrypt = require('bcryptjs');
const { Sequelize, User, UserAccountHistory } = require('../models');   // <- MAIN CHANGE
const AppError                   = require('../utils/AppError');
const JobsAndProcessingService   = require('./JobsAndProcessingService');

class UserService {
  constructor() {
    this.jobsAndProcessingService = JobsAndProcessingService;
    this.passwordSaltRounds = parseInt(process.env.PASSWORD_SALT_ROUNDS || 10, 10);
  }


  async register(data) {
    const exists = await User.findOne({ where: { email: data.email } });
    if (exists) throw new AppError('Email already exists.', 409);

    const hashed = await bcrypt.hash(data.password, this.passwordSaltRounds);

    try {
      const user = await User.create({ ...data, password: hashed });
      return {
        success: true,
        message: 'User registered successfully.',
        userId : user.id
      };
    } catch (err) {
      throw new AppError(`Error registering user: ${err.message}`, 500);
    }
  }


  findUserById(id) {
    return User.findByPk(id);                    
  }

  findUserByEmail(email) {
    return User.findOne({ where: { email } });
  }


  async addBalance({ user_id, amount, memo }) {
    const t = await Sequelize.transaction();
    try {
      const [rows] = await User.increment(
        { balance: amount },
        { where: { id: user_id }, transaction: t }
      );
      if (rows === 0) throw new AppError('User not found', 404);

      const user = await User.findByPk(user_id, { transaction: t });
      await UserAccountHistory.create({
        user_id,
        memo,
        amount,
        balance: user.balance
      }, { transaction: t });

      await t.commit();
      return true;
    } catch (err) {
      await t.rollback();
      throw err instanceof AppError
        ? err
        : new AppError(`Error adding balance: ${err.message}`, 500);
    }
  }


  async getUserBalance(user_id) {
    const user = await this.findUserById(user_id);
    return user ? user.balance : null;
  }


  async getUserTransactions(user_id, { page = 1, items_per_page = 10 }) {
    const offset = (page - 1) * items_per_page;

    const { count, rows } = await UserAccountHistory.findAndCountAll({
      where: { user_id },
      offset,
      limit: items_per_page,
      order: [['created_at', 'DESC']]
    });

    return {
      payload      : rows,
      totalRecords : count,
      noOfPages    : Math.ceil(count / items_per_page),
      currentPage  : page,
      perPage      : items_per_page
    };
  }


  async processCombosAndProxies(combos, proxies, userId, moduleId) {
    const user = await this.findUserById(userId);
    if (!user) throw new AppError('User not found.', 404);
    return this.jobsAndProcessingService.createJob(userId, moduleId, combos, proxies)
      .then(async jobId => {
        if (!jobId) throw new AppError('Failed to create job.', 500);

        const started = await this.jobsAndProcessingService.startJob(jobId);
        if (!started) throw new AppError('Failed to start job processing.', 500);

        const items = await this.jobsAndProcessingService.findJobProcessingByJobId(jobId);
        for (const item of items) await this.jobsAndProcessingService.processJobItem(item.id,user);
        return jobId;
      });
  }

  async processJob(jobId) {
    const started = await this.jobsAndProcessingService.startJob(jobId);
    if (!started) throw new AppError('Failed to start job processing for existing job.', 500);

    const items = await this.jobsAndProcessingService.findJobProcessingByJobId(jobId);
    for (const item of items) await this.jobsAndProcessingService.processJobItem(item.id);
    return jobId;
  }

  /* Delegated Job retrieval */
  getUsersAllCompletedJobs(...args) { return this.jobsAndProcessingService.getUsersAllCompletedJobs(...args); }
  getUsersAllFailedJobs   (...args) { return this.jobsAndProcessingService.getUsersAllFailedJobs  (...args); }
  getUsersAllJob          (...args) { return this.jobsAndProcessingService.getUsersAllJobs        (...args); }
  getAllJobs              (...args) { return this.jobsAndProcessingService.getAllJobs            (...args); }
  getJobDetails           (...args) { return this.jobsAndProcessingService.getJobDetails         (...args); }
}

module.exports = new UserService();
