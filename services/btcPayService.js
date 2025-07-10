const axios = require('axios');
const AppError = require('../utils/AppError');
require('dotenv').config();
const { DepositRequest } = require('../models');
class BtcpayService {
  constructor() {
    this.btcpay = axios.create({
      baseURL: `${process.env.BTCPAY_HOST}/api/v1`,
      headers: {
        Authorization: `token ${process.env.BTCPAY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    this.storeId = process.env.BTCPAY_STORE_ID;
  }

  /**
   * Create a real invoice using BTCPay API
   */
  async createInvoice(userId, amount, currency = 'USD') {
    console.log(`BtcpayService: Creating real invoice for user ${userId}, amount ${amount} ${currency}`);
    try {
      // 1. Call BTCPay API to create invoice
      const response = await this.btcpay.post(`/stores/${this.storeId}/invoices`, {
        amount: amount,
        currency: currency,
        metadata: {
          userId: userId.toString(),
          purpose: 'account_deposit'
        }
      });
console.log("response",response)
      const invoice = response.data;
      const btcAmount = invoice.amount; // already in response
      const externalInvoiceId = invoice.id;

      // 2. Store locally in DB
      const depositId = await DepositRequest.create({
        user_id: userId,
        order_id: externalInvoiceId,
        invoice_id: externalInvoiceId,
        amount: amount,
        btc_amount: btcAmount,
        currency: currency,
        status: 'pending'
      });

      if (!depositId) {
        throw new AppError('Failed to record deposit request locally.', 500);
      }

      // 3. Return invoice details
      return {
        status: invoice.status,
        invoice_id: invoice.id,
        btc_amount: invoice.amount,
        currency: invoice.currency,
        invoice_url: invoice.checkoutLink
      };
    } catch (error) {
      console.error('BTCPay Error:', error.response?.data || error.message);
      throw new AppError(
        `Failed to create BTCPay invoice: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500
      );
    }
  }

  /**
   * Webhook handler: updates deposit status & user balance
   */
  async handleWebhook(invoiceId, newStatus, actualAmount) {
    console.log(`BtcpayService: Handling webhook for invoice ${invoiceId} with status ${newStatus}`);
    try {
      const depositRequest = await DepositRequest.findOne({where:{invoice_id:invoiceId}})
      if (!depositRequest) {
        console.warn(`Webhook received for unknown invoice: ${invoiceId}`);
        return false;
      }

      if (depositRequest.status === 'settled') {
        console.log(`Invoice ${invoiceId} already settled. Skipping.`);
        return false;
      }

      // Update status in DB
      const updated = await DepositRequest.update(invoiceId,{status:newStatus} );
      if (!updated) {
        throw new AppError('Failed to update deposit status locally.', 500);
      }

      // Update balance if settled
      if (newStatus === 'settled') {
        const userService = require('./UserService');
        await userService.addBalance({
          user_id: depositRequest.user_id,
          amount: actualAmount || depositRequest.amount,
          memo: `Deposit via BTCPay Invoice ${invoiceId}`
        });
        console.log(`User ${depositRequest.user_id} balance updated for invoice ${invoiceId}.`);
      }

      return true;
    } catch (error) {
      throw new AppError(`Failed to process BTCPay webhook: ${error.message}`, error.statusCode || 500);
    }
  }
}

module.exports = new BtcpayService();
