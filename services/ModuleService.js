const { Module } = require('../models');
const AppError = require('../utils/AppError');

class ModuleService {
    async addModule(formData, userId) {
        const {
            module_name,
            login_url,
            method,
            price,
            headers = {},
            post_data = {},
            extra_attributes = {},
            captcha_keys = {},
            success_key,
            fail_key,
            retry_key,
            multiform
        } = formData;

        const hasCaptcha =
            captcha_keys.captcha_url ||
            captcha_keys.captcha_type ||
            captcha_keys.captcha_api_key;

        const extra_data = {};
        if (success_key) extra_data.success_key = success_key;
        if (fail_key) extra_data.fail_key = fail_key;
        if (retry_key) extra_data.retry_key = retry_key;

        try {
            const newModule = await Module.create({
                module_name,
                login_url,
                method,
                price,
                requires_captcha: !!hasCaptcha,
                multiform: !!multiform,
                created_by: userId,
                headers,
                post_data,
                extra_attributes,
                captcha_keys,
                multiform,
                extra_data
            });

            return newModule.id;
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                throw new AppError('Module with this name already exists.', 409);
            }
            throw new AppError(`Error adding module: ${error.message}`, 500);
        }
    }

    async getAll(page = 1, itemsPerPage = 20) {
    const offset = (page - 1) * itemsPerPage;

    try {
        const { count, rows } = await Module.findAndCountAll({
            limit: itemsPerPage,
            offset,
            order: [['created_at', 'DESC']]
        });

        return {
            total: count,
            page,
            pages: Math.ceil(count / itemsPerPage),
            payload: rows.map(row => row.toJSON()) 
        };
    } catch (error) {
        throw new AppError(`Error fetching all modules: ${error.message}`, 500);
    }
}


    async getModulesForUpload() {
        try {
            return await Module.findAll({
                attributes: ['id', 'module_name'],
                order: [['module_name', 'ASC']]
            });
        } catch (error) {
            throw new AppError(`Error fetching modules for upload: ${error.message}`, 500);
        }
    }

    async getModuleById(id) {
        try {
            const module = await Module.findByPk(id);
            if (!module) throw new AppError(`Module with ID ${id} not found.`, 404);
            return module.toJSON();

        } catch (error) {
            throw new AppError(`Error fetching module: ${error.message}`, 500);
        }
    }

    async editModule(id, formData) {
        try {
            const [updatedRows] = await Module.update(formData, {
                where: { id }
            });

            if (updatedRows === 0) {
                const exists = await Module.findByPk(id);
                if (!exists) {
                    throw new AppError(`Module with ID ${id} not found.`, 404);
                }
                return false; // no update needed
            }

            return true;
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                throw new AppError('Module name already exists.', 409);
            }
            throw new AppError(`Error editing module: ${error.message}`, 500);
        }
    }

    async deleteModule(id) {
        try {
            const deletedRows = await Module.destroy({
                where: { id }
            });

            if (deletedRows === 0) {
                throw new AppError(`Module with ID ${id} not found.`, 404);
            }

            return deletedRows;
        } catch (error) {
            throw new AppError(`Error deleting module: ${error.message}`, 500);
        }
    }
}

module.exports = new ModuleService();
