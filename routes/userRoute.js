const express = require('express');
const userController = require('../controllers/UserController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });
const router = express.Router();
router.post('/register', userController.register); 
router.post('/deposit',protect, userController.makeDeposit); 
router.get('/transactions',protect, userController.showTransactionHistory); 
router.get('/modules-for-upload', protect, userController.getModulesForUpload); 
router.post('/upload',protect,userController.handleUpload); 
router.post('/process-job',protect, userController.processJob);
router.get('/jobs',protect, userController.jobList); 
router.get('/jobs/:id',protect, userController.jobDetail); 

module.exports = router;