const express = require('express');
const authController = require('../controllers/AuthController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', authController.login); 

router.get('/me', protect, authController.me);
router.get('/logout', authController.logout); 

module.exports = router;