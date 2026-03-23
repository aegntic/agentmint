/**
 * AgentMint - A2A Payment Infrastructure for AI Agents
 * 
 * One-line setup to accept agent-to-agent payments:
 * 
 * const { AgentPayment } = require('@aegntic/agentmint');
 * const payment = new AgentPayment({ wallet: '0x...', acceptedTokens: ['USDC', 'ETH', 'USD', 'AUD'] });
 * app.use('/api', payment.middleware());
 */

const Stripe = require('stripe');
const express = require('express');

const STRIPE_TOKEN_CURRENCY_MAP = {
  USDC: 'usd',
  USD: 'usd',
  AUD: 'aud'
};

const CURRENCY_DECIMALS = {
  usd: 2,
  aud: 2
};

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
    // Stripe signature verification requires the raw request body.
    this.app.post(
      '/webhook',
      express.raw({ type: 'application/json' }),
      this.handleWebhook.bind(this)
    );
    
    // x402 Payment Request endpoint
    this.app.use(express.json());
    this.app.post('/pay', this.handlePaymentRequest.bind(this));
    
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
      const normalizedToken = this.normalizeToken(token);

      if (!this.wallet) {
        return res.status(500).json({ error: 'No destination wallet configured' });
      }
      if (!normalizedToken) {
        return res.status(400).json({ error: 'Token is required' });
      }
      if (!this.acceptedTokens.includes(normalizedToken)) {
        return res.status(400).json({ error: `Unsupported token: ${token}` });
      }
      if (!this.isPositiveAmount(amount)) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
      
      // Verify mandate if provided (x402 compliance)
      if (mandate && !this.verifyMandate(mandate)) {
        return res.status(403).json({ error: 'Invalid mandate' });
      }

      // Create payment intent with Stripe
      if (this.stripe) {
        const currency = this.getStripeCurrency(normalizedToken);
        if (!currency) {
          return res.status(400).json({
            error: `Stripe mode does not support ${normalizedToken}; use a fiat token such as USD or AUD`
          });
        }

        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: this.convertToMinorUnits(amount, currency),
          currency,
          metadata: {
            from_agent: from,
            to_agent: this.wallet,
            token: normalizedToken
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
        token: normalizedToken,
        description,
        instructions: `Send ${amount} ${normalizedToken} to ${this.wallet}`
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle Stripe webhooks for payment confirmations
   */
  async handleWebhook(req, res) {
    if (!this.stripe) {
      return res.status(400).json({ error: 'Stripe is not configured' });
    }
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
      const amount = req.query.amount || 1;
      const currency = String(req.query.currency || 'USD').toLowerCase();
      const description = req.query.description || 'Payment for AI agent services';

      if (!this.isPositiveAmount(amount)) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
      if (!CURRENCY_DECIMALS[currency]) {
        return res.status(400).json({ error: `Unsupported currency: ${currency}` });
      }

      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [{
          price_data: {
            currency,
            product_data: {
              name: 'Agent Service Payment',
              description
            },
            unit_amount: this.convertToMinorUnits(amount, currency)
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
   * Convert amount to the gateway's minor unit amount
   */
  convertToMinorUnits(amount, currency) {
    const decimals = CURRENCY_DECIMALS[currency] ?? 2;
    return Math.round(Number(amount) * Math.pow(10, decimals));
  }

  /**
   * Get Stripe currency code
   */
  getStripeCurrency(token) {
    return STRIPE_TOKEN_CURRENCY_MAP[token] || null;
  }

  normalizeToken(token) {
    return typeof token === 'string' ? token.toUpperCase() : '';
  }

  isPositiveAmount(amount) {
    return Number.isFinite(Number(amount)) && Number(amount) > 0;
  }

  /**
   * Express middleware
   */
  middleware() {
    return this.app;
  }
}

module.exports = { AgentPayment };
