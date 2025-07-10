const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const userService = require('../services/UserService'); 

const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secret_jwt_key_that_is_long_and_random';

const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
       
    }
    // 2) Check for token in httpOnly cookie
    else if (req.cookies.auth_token) {
        token = req.cookies.auth_token;
    }

    if (!token) {        
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    try {
        // 3) Verify token
        // console.log("Verifying token...",JWT_SECRET)
        const decoded = jwt.verify(token, JWT_SECRET);

        // 4) Check if user still exists
        const currentUser = await userService.findUserById(decoded.id || decoded.sub); 
        console.log(decoded)
        if (!currentUser) {
            return next(new AppError('The user belonging to this token no longer exists.', 401));
        }

        // 5) If everything is okay, attach user object to the request
        req.user = currentUser;
        next();
    } catch (err) {
        console.error(err);
        return next(new AppError('Invalid or expired token. Please log in again.', 401));
    }
};

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action.', 403));
        }
        next();
    };
};

module.exports = { protect, restrictTo };