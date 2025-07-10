const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, dashboardController.getDashboardData);

module.exports = router;