const btcPayService = require('../services/btcPayService');
const AppError = require('../utils/AppError');

const btcpayController = {
   
    async createInvoice(req, res, next) {
        const userId = req.user.id;
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
       const amount = req.body.amount;
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",amount)

        if (!amount || amount <= 0) {
            return next(new AppError('Valid amount is required.', 400));
        }       
        try {
            const invoiceDetails = await btcPayService.createInvoice(userId, amount);
            res.status(201).json({
                status: 'success',
                message: 'Invoice created successfully.',
                data: invoiceDetails
            });
        } catch (error) {
            next(error);
        }
    },

    
    async handleWebhook(req, res, next) {

        const webhookPayload = req.body;
        const invoiceId = webhookPayload.invoiceId;
        const newStatus = webhookPayload.status;
        const actualAmount = webhookPayload.amount; 
        console.log('Received BTCPay Webhook:', JSON.stringify(webhookPayload, null, 2));

        if (!invoiceId || !newStatus) {
            return res.status(400).json({ status: 'fail', message: 'Invalid webhook payload.' });
        }

        try {
            const processed = await btcPayService.handleWebhook(invoiceId, newStatus, actualAmount);
            if (processed) {
                return res.status(200).json({ status: 'success', message: 'Webhook processed.' });
            } else {
                // If not processed (e.g., already settled), still return 200 to BTCPay Server
                return res.status(200).json({ status: 'success', message: 'Webhook received, no action taken.' });
            }
        } catch (error) {
            console.error(`Error processing BTCPay webhook for invoice ${invoiceId}:`, error);
            return res.status(500).json({ status: 'error', message: 'Internal server error processing webhook.' });
        }
    }
};

module.exports = btcpayController;