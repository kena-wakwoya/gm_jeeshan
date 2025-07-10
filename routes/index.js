const express = require('express');
const authRoutes = require('./authRoute');
const userRoutes = require('./userRoute');
const manageModulesRoutes = require('./modulesRoute');
const btcpayRoutes = require('./btcpayRoute');
// const dashboardRoutes = require('./dashboard');

const router = express.Router();

router.get('/test', (req, res) => {
    res.send('Test route is working!');
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/modules', manageModulesRoutes);
router.use('/btcpay', btcpayRoutes);
// router.use('/dashboard', dashboardRoutes);

module.exports = router;