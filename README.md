# AgentMint 🦊

> One-click A2A payment infrastructure for AI agents

## Live
- **API:** Running on port 3000 (helios-ae)
- **Landing:** `index.html` ready
- **npm:** Not published (need credentials)

## Quick Start

```bash
npm install agentmint
```

```javascript
const { AgentPayment } = require('agentmint');

const payment = new AgentPayment({ 
  wallet: '0x742d...',
  acceptedTokens: ['USDC', 'ETH', 'AUD']
});

app.use('/payments', payment.middleware());
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /payments/pay | Request payment |
| POST | /payments/webhook | Stripe webhook |
| GET | /payments/card | Generate payment link |
| GET | /payments/revenue | Revenue stats |
| GET | /health | Health check |

## TODO

- [ ] Publish to npm (need npm login)
- [ ] Deploy to Cloudflare Workers
- [ ] Set up agentmint.aegntic.ai subdomain
- [ ] Wire Stripe webhook to production
- [ ] Landing page at agentmint.aegntic.ai
- [ ] First 5 users
