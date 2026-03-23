/**
 * AgentMint Demo Server
 */
const express = require('express');
const { AgentPayment } = require('./index');

const app = express();

// Initialize AgentMint
const payment = new AgentPayment({
  wallet: process.env.AGENT_WALLET || '0x742d35Cc6634C0532925a3b844Bc9e7595f0fD00',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY, // Optional
  acceptedTokens: ['USDC', 'ETH', 'USD', 'AUD'],
  webhookSecret: process.env.WEBHOOK_SECRET,
  onPayment: (payment) => {
    console.log('💰 Payment received:', payment);
  }
});

// Mount AgentMint routes
app.use('/payments', payment.middleware());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'AgentMint' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🦊 AgentMint running on port ${PORT}`);
  console.log(`   Payment endpoints: /payments/pay, /payments/card, /payments/revenue`);
  console.log(`   Webhook: /payments/webhook`);
});
