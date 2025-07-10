const BaseModel = require('./BaseModel');

class Module extends BaseModel {
    constructor() {
        super('gm_modules');
    }

    /**
     * Finds a module by its name.
     * @param {string} moduleName
     * @returns {Promise<Object|null>}
     */
    async findByName(moduleName) {
        const sql = `SELECT * FROM ${this._tableName} WHERE module_name = ?`;
        const [rows] = await this.query(sql, [moduleName]);
        return rows[0] || null;
    }

    /**
     * Creates a new module.
     * Handles JSON fields by stringifying before insert.
     * @param {Object} data
     * @returns {Promise<number>}
     */
    async createModule(data) {
        const dataToSave = { ...data };
        if (dataToSave.headers) dataToSave.headers = JSON.stringify(dataToSave.headers);
        if (dataToSave.post_data) dataToSave.post_data = JSON.stringify(dataToSave.post_data);
        if (dataToSave.captcha_keys) dataToSave.captcha_keys = JSON.stringify(dataToSave.captcha_keys);
        if (dataToSave.extra_data) dataToSave.extra_data = JSON.stringify(dataToSave.extra_data);
        if (dataToSave.extra_attributes) dataToSave.extra_attributes = JSON.stringify(dataToSave.extra_attributes);

        return this.create(dataToSave);
    }

    /**
     * Updates an existing module.
     * Handles JSON fields by stringifying before update.
     * @param {number} id
     * @param {Object} data
     * @returns {Promise<boolean>}
     */
    async updateModule(id, data) {
        const dataToUpdate = { ...data };
        if (dataToUpdate.headers) dataToUpdate.headers = JSON.stringify(dataToUpdate.headers);
        if (dataToUpdate.post_data) dataToUpdate.post_data = JSON.stringify(dataToUpdate.post_data);
        if (dataToUpdate.captcha_keys) dataToUpdate.captcha_keys = JSON.stringify(dataToUpdate.captcha_keys);
        if (dataToUpdate.extra_data) dataToUpdate.extra_data = JSON.stringify(dataToUpdate.extra_data);
        if (dataToUpdate.extra_attributes) dataToUpdate.extra_attributes = JSON.stringify(dataToUpdate.extra_attributes);

        return this.update(id, dataToUpdate);
    }

    /**
     * Retrieves all modules with pagination and optional filters.
     * This method will automatically parse JSON fields when returning results.
     * @param {number} page
     * @param {number} perPage
     * @param {Object} filters
     * @returns {Promise<Object>}
     */
    async getAllModulesPaginated(page = 1, perPage = 10, filters = {}) {
        const result = await this.getAllPaginated(page, perPage, filters);
        result.payload = result.payload.map(mod => {
            if (mod.headers) mod.headers = JSON.parse(mod.headers);
            if (mod.post_data) mod.post_data = JSON.parse(mod.post_data);
            if (mod.captcha_keys) mod.captcha_keys = JSON.parse(mod.captcha_keys);
            if (mod.extra_data) mod.extra_data = JSON.parse(mod.extra_data);
            if (mod.extra_attributes) mod.extra_attributes = JSON.parse(mod.extra_attributes);
            return mod;
        });
        return result;
    }

    /**
     * Finds a module by ID and parses JSON fields.
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async findModuleById(id) {
        const moduleData = await this.findById(id);
        if (moduleData) {
            if (moduleData.headers) moduleData.headers = JSON.parse(moduleData.headers);
            if (moduleData.post_data) moduleData.post_data = JSON.parse(moduleData.post_data);
            if (moduleData.captcha_keys) moduleData.captcha_keys = JSON.parse(moduleData.captcha_keys);
            if (moduleData.extra_data) moduleData.extra_data = JSON.parse(moduleData.extra_data);
            if (moduleData.extra_attributes) moduleData.extra_attributes = JSON.parse(moduleData.extra_attributes);
        }
        return moduleData;
    }

    /**
     * Retrieves all module IDs and names.
     * This directly maps to your PHP `getModulesForUpload` method.
     * @returns {Promise<Array<Object>>} An array of objects, each with 'id' and 'module_name'.
     */
    async getNamesAndIds() {
        const sql = `SELECT id, module_name FROM ${this._tableName}`;
        const [rows] = await this.query(sql);
        return rows;
    }
}

module.exports = new Module();