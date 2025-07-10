
const moduleService = require('../services/ModuleService'); // Assuming this path
const AppError = require('../utils/AppError');

const manageModulesController = {
    
    async getAllModules(req, res, next) {
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

        try {
            const modules = await moduleService.getAll(page, itemsPerPage);
            res.status(200).json({
                status: 'success',
                data: modules
            });
        } catch (error) {
            next(error); 
        }
    },
    async getModule(req, res, next) {
        const id = parseInt(req.params.id, 10); 
        if (isNaN(id)) {
            return next(new AppError('Invalid module ID provided.', 400));
        }

        try {
            const module = await moduleService.getModuleById(id);
            res.status(200).json({
                status: 'success',
                data: module
            });
        } catch (error) {
            next(error);
        }
    },

    
    async addModule(req, res, next) {
        const loggedInUserId = req.user.id; 
        const formData = {
            module_name: req.body.module_name, 
            login_url: req.body.login_url,
            method: req.body.method ? String(req.body.method).toUpperCase() : '',
            price: parseFloat(req.body.price),
            headers: req.body.headers || {}, 
            post_data: req.body.post_data || {}, 
            success_key: req.body.success_key,
            fail_key: req.body.fail_key,
            retry_key: req.body.retry_key,
            multiform: req.body.multiform,
            captcha_keys: req.body.captcha_keys || {}, 
            extra_attributes: req.body.extra_attributes || {}, 
        };

        if (!formData.module_name || !formData.login_url || !formData.method || isNaN(formData.price)) {
            return next(new AppError('Module name, login URL, method, and price are required.', 400));
        }

        try {
            const newModuleId = await moduleService.addModule(formData, loggedInUserId);
            res.status(201).json({ 
                status: 'success',
                message: 'Module added successfully.',
                module_id: newModuleId
            });
        } catch (error) {
            next(error); 
        }
    },

   
    async editModule(req, res, next) {
        const loggedInUserId = req.user.id;
        const moduleId = parseInt(req.params.id, 10);
        console.log("moduleId data ", moduleId);

        if (isNaN(moduleId)) {
            return next(new AppError('Invalid module ID provided for update.', 400));
        }
        console.log("updated data ", req.body);
        
        const updateData = {
            module_name: req.body.module_name,
            login_url: req.body.login_url,
            method: req.body.method ? String(req.body.method).toUpperCase() : undefined, 
            price: req.body.price !== undefined ? parseFloat(req.body.price) : undefined,
            created_by: loggedInUserId, 
            headers: req.body.headers,
            post_data: req.body.post_data,
            extra_data: req.body.extra_data, 
            captcha_keys: req.body.captcha_keys,
            extra_attributes: req.body.extra_attributes,
        };

        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        try {
            const updated = await moduleService.editModule(moduleId, updateData);
            if (updated) {
                res.status(200).json({
                    status: 'success',
                    message: `Module ${moduleId} updated successfully.`,
                });
            } else {
                return next(new AppError('Failed to update module, or no changes were made.', 400));
            }
        } catch (error) {
            next(error);
        }
    },

    async deleteModule(req, res, next) {
        const id = parseInt(req.params.id, 10); 
        if (isNaN(id)) {
            return next(new AppError('Invalid module ID provided for deletion.', 400));
        }

        try {
            const deleted = await moduleService.deleteModule(id);
            return res.status(204).json({ 
                status: 'success',
                message: 'Module deleted successfully.' 
            });
        } catch (error) {
            next(error); 
        }
    }
};

module.exports = manageModulesController;