


class BaseModel {
    _dbPool;
    _tableName;

    constructor(tableName) {
        if (new.target === BaseModel) {
            throw new Error("BaseModel is an abstract class and cannot be instantiated directly.");
        }
        if (!tableName) {
            throw new Error("Model must define a table name.");
        }
        this._tableName = tableName;
        this._dbPool = Database.getInstance().getPool();
    }

    async query(sql, params = []) {
        let connection;
        try {
            connection = await this._dbPool.getConnection();
            const [rows, fields] = await connection.execute(sql, params);
            return [rows, fields];
        } catch (error) {
            console.error(`Error executing query on table ${this._tableName}:`, error.message);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async create(data) {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => `?`).join(', ');
        const values = Object.values(data);
        console.log(`Inserting into table ${this._tableName} with data:`, data);
        const sql = `INSERT INTO ${this._tableName} (${columns}) VALUES (${placeholders})`;
        try {
            const [result] = await this.query(sql, values);
            return result.insertId;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Duplicate entry: This record already exists.');
            }
            throw error;
        }
    }

    async update(id, data) {
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), id];

        const sql = `UPDATE ${this._tableName} SET ${fields} WHERE id = ?`;
        const [result] = await this.query(sql, values);
        return result.affectedRows > 0;
    }

    /**
     * Saves or updates a record. If ID is provided, updates; otherwise, creates.
     * @param {Object} data Data to save.
     * @param {number|null} id Optional ID for updating.
     * @returns {Promise<number|boolean>} Insert ID if created, or boolean if updated.
     */
    async save(data, id = null) {
        if (id) {
            return this.update(id, data);
        } else {
            return this.create(data);
        }
    }

    /**
     * Finds a record by its ID.
     * @param {number} id The ID of the record.
     * @returns {Promise<Object|null>} The record data or null if not found.
     */
    async findById(id) {
        const sql = `SELECT * FROM ${this._tableName} WHERE id = ?`;
        const [rows] = await this.query(sql, [id]);
        return rows[0] || null;
    }

    /**
     * Deletes a record by its ID.
     * This directly maps to your PHP `delete` functionality for Modules and is made generic.
     * @param {number} id The ID of the record to delete.
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async delete(id) {
        const sql = `DELETE FROM ${this._tableName} WHERE id = ?`;
        const [result] = await this.query(sql, [id]);
        return result.affectedRows > 0;
    }


    async getAllPaginated(page = 1, perPage = 10, params = {}, customSql = null) {
        const offset = (page - 1) * perPage;
        let queryParams = [];

        // For customSql, params are expected to be an array for direct injection
        // For non-customSql, params is an object, and we convert it
        if (customSql) {
            queryParams = params; // Assume params is already an array for customSql
        } else {
            for (const column in params) {
                if (Object.prototype.hasOwnProperty.call(params, column)) {
                    queryParams.push(params[column]);
                }
            }
        }


        let totalRecords = 0;
        let results = [];

        try {
            if (customSql) {
                // For COUNT(*), we remove LIMIT and OFFSET from the custom SQL and use its params
                const countSql = `SELECT COUNT(*) as total FROM (${customSql}) as subquery_for_count`;
                const [countRows] = await this.query(countSql, queryParams); // Use original params for count
                totalRecords = countRows[0].total;

                const paginatedSql = `${customSql} LIMIT ? OFFSET ?`;
                // Add pagination params to the end for the actual data query
                const paginatedQueryParams = [...queryParams, perPage, offset];
                const [rows] = await this.query(paginatedSql, paginatedQueryParams);
                results = rows;
            } else {
                let whereClauses = [];
                let whereParams = [];

                for (const column in params) {
                    if (Object.prototype.hasOwnProperty.call(params, column)) {
                        whereClauses.push(`${column} = ?`);
                        whereParams.push(params[column]);
                    }
                }

                const whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

                const countSql = `SELECT COUNT(*) as total FROM ${this._tableName}${whereString}`;
                const [countRows] = await this.query(countSql, whereParams);
                totalRecords = countRows[0].total;

                const paginatedSql = `SELECT * FROM ${this._tableName}${whereString} LIMIT ? OFFSET ?`;
                // Add pagination params to the end
                const finalParams = [...whereParams, perPage, offset];
                
                const [rows] = await this.query(paginatedSql, finalParams);
                results = rows;
            }

            return {
                payload: results,
                totalRecords: totalRecords,
                noOfPages: Math.ceil(totalRecords / perPage),
                currentPage: page,
                perPage: perPage
            };
        } catch (error) {
            console.error(`Error in getAllPaginated for table ${this._tableName}:`, error.message);
            throw error;
        }
    }
}

module.exports = BaseModel;