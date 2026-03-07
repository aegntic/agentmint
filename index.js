/**
 * AgentMint - A2A Payment Infrastructure for AI Agents
 * 
 * One-line setup to accept agent-to-agent payments:
 * 
 * const { AgentPayment } = require('agentmint');
 * const payment = new AgentPayment({ wallet: '0x...', acceptedTokens: ['USDC', 'ETH'] });
 * app.use('/api', payment.middleware());
 */

const Stripe = require('stripe');
const express = require('express');

class AgentPayment {
  constructor(options = {}) {
    this.wallet = options.wallet;
    this.acceptedTokens = options.acceptedTokens || ['USDC', 'ETH'];
    this.stripe = options.stripeSecretKey 
      ? new Stripe(options.stripeSecretKey) 
      : null;
    this.webhookSecret = options.webhookSecret;
    this.onPayment = options.onPayment || (() => {});
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.json());
    
    // x402 Payment Request endpoint
    this.app.post('/pay', this.handlePaymentRequest.bind(this));
    
    // Webhook for payment confirmations
    this.app.post('/webhook', this.handleWebhook.bind(this));
    
    // Generate agent payment card/link
    this.app.get('/card', this.generatePaymentCard.bind(this));
    
    // Revenue dashboard data
    this.app.get('/revenue', this.getRevenue.bind(this));
  }

  /**
   * Handle x402 Payment Request
   * Agents call this to request payment for services
   */
  async handlePaymentRequest(req, res) {
    try {
      const { from, amount, token, description, mandate } = req.body;
      
      // Verify mandate if provided (x402 compliance)
      if (mandate && !this.verifyMandate(mandate)) {
        return res.status(403).json({ error: 'Invalid mandate' });
      }

      // Create payment intent with Stripe
      if (this.stripe) {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: this.convertToCents(amount, token),
          currency: this.getCurrency(token),
          metadata: {
            from_agent: from,
            to_agent: this.wallet,
            token
          },
          description
        });

        return res.json({
          clientSecret: paymentIntent.client_secret,
          paymentId: paymentIntent.id,
          status: 'requires_payment_method'
        });
      }

      // Crypto-only mode (no Stripe)
      return res.json({
        type: 'crypto',
        to: this.wallet,
        amount,
        token,
        description,
        instructions: `Send ${amount} ${token} to ${this.wallet}`
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle Stripe webhooks for payment confirmations
   */
  async handleWebhook(req, res) {
    if (!this.webhookSecret) {
      return res.status(400).json({ error: 'No webhook secret configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = Stripe.webhooks.constructEvent(
        req.body,
        sig,
        this.webhookSecret
      );
    } catch (err) {
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle successful payment
    if (event.type === 'payment_intent.succeeded') {
      const payment = event.data.object;
      await this.onPayment({
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        from: payment.metadata?.from_agent,
        status: 'completed'
      });
    }

    res.json({ received: true });
  }

  /**
   * Generate payment card/link for the agent
   */
  async generatePaymentCard(req, res) {
    if (!this.stripe) {
      return res.json({
        type: 'crypto_wallet',
        address: this.wallet,
        supportedTokens: this.acceptedTokens
      });
    }

    try {
      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Agent Service Payment',
              description: 'Payment for AI agent services'
            },
            unit_amount: 100 // $1.00 minimum
          },
          quantity: 1
        }],
        metadata: {
          agent_wallet: this.wallet
        }
      });

      return res.json({
        paymentLink: paymentLink.url,
        agentId: this.wallet
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get revenue statistics
   */
  async getRevenue(req, res) {
    if (!this.stripe) {
      return res.json({ error: 'Stripe not configured' });
    }

    try {
      const balance = await this.stripe.balance.retrieve();
      
      return res.json({
        available: balance.available,
        pending: balance.pending,
        currency: 'USD'
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Verify payment mandate (x402 compliance)
   */
  verifyMandate(mandate) {
    // In production: verify cryptographic signature
    // For now: basic validation
    return mandate && 
           mandate.from && 
           mandate.permissions && 
           mandate.signature;
  }

  /**
   * Convert amount to cents based on token
   */
  convertToCents(amount, token) {
    // USDC = 6 decimals, ETH = 18 decimals
    const decimals = token === 'USDC' ? 2 : 0; // Simplified
    return Math.floor(amount * Math.pow(10, decimals));
  }

  /**
   * Get Stripe currency code
   */
  getCurrency(token) {
    const map = {
      'USDC': 'usd',
      'ETH': 'usd', // Convert crypto to USD for Stripe
      'USD': 'usd',
      'AUD': 'aud'
    };
    return map[token] || 'usd';
  }

  /**
   * Express middleware
   */
  middleware() {
    return this.app;
  }
}

module.exports = { AgentPayment };
