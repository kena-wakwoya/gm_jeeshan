const AppError = require('../utils/AppError');

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    console.error('ERROR 💥', err);

    res.status(err.statusCode).json({
        status: err.status,
        message: err.isOperational ? err.message : 'An unexpected error occurred. Please try again later.',
        
    });
};