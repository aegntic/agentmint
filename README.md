# AgentMint

> One-click A2A payment infrastructure for AI agents

## Quick Start

```bash
npm install @aegntic/agentmint
```

```javascript
const { AgentPayment } = require('@aegntic/agentmint');

const payment = new AgentPayment({ 
  wallet: '0x742d...',
  acceptedTokens: ['USDC', 'ETH', 'USD', 'AUD']
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

## Notes

- `USDC`, `USD`, and `AUD` are supported in Stripe mode.
- `ETH` is supported in crypto-only mode and returns direct wallet payment instructions.
- Stripe webhooks require the raw request body, which AgentMint handles internally on `/payments/webhook`.
- The `/health` route exists in the demo server at [server.js](/Users/iamcatface/agentmint/server.js), not in the exported middleware itself.
