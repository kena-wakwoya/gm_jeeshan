
const authService = require('../services/AuthService'); 
const AppError = require('../utils/AppError'); 

const authController = {
    async login(req, res, next) {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'fail',
                message: 'Email and password are required.'
            });
        }

        try {
            const {token,user } = await authService.login(email, password);
            if (token) {
                return res.status(200).json({
                    status: 'success',
                    message: 'Logged in successfully.',
                    token: token,
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role
                    }
                });
            } else {
                throw new AppError('Invalid credentials.', 401);
            }
        } catch (error) {
            return res.status(error.statusCode || 401).json({
                status: 'error',
                message: error.message || 'Authentication failed. Please try again.'
            });
        }
    },

    async me(req, res, next) {        

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('Unauthorized: No token provided or malformed.', 401));
        }
        const token = authHeader.split(' ')[1];
        try {
            const userData = await authService.verifyToken(token);
            if (!userData) {
                return next(new AppError('Unauthorized: User not found.', 401));
            }
            res.status(200).json({
                status: 'success',
                user: userData
            });

        } catch (error) {
            return next(new AppError('Unauthorized: Token verification failed.', 401));
        }
    },

    logout(req, res) {
        res.clearCookie('auth_token', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
        });

        res.status(200).json({
            status: 'success',
            message: 'You have been logged out successfully.'
        });
    },
};

module.exports = authController;