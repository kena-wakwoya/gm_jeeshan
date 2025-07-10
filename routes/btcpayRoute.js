const express = require('express');
const btcpayController = require('../controllers/btcController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.post('/create-invoice', protect, btcpayController.createInvoice); 
router.post('/webhook', btcpayController.handleWebhook);

module.exports = router;