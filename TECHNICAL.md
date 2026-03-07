# AgentMint Technical Guide

## What is AgentMint?

AgentMint is payment infrastructure for AI agents. It enables agents to:
- Receive payments in USDC, ETH, or fiat (via Stripe)
- Send payments to other agents
- Generate payment links for humans
- Webhook notifications for payment confirmations

## Installation

```bash
npm install @aegntic/agentmint
# or
git clone https://github.com/aegntic/agentmint
```

## Quick Start

```javascript
const { AgentPayment } = require('agentmint');

// Initialize with your wallet
const payment = new AgentPayment({
  wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0fD00',
  acceptedTokens: ['USDC', 'ETH', 'AUD']
});

// Express middleware
app.use('/payments', payment.middleware());

// Now your agent can:
await payment.request({
  from: 'agent-2',
  amount: '1.00',
  token: 'USDC',
  description: 'Data processing fee'
});
```

## API Reference

### POST /payments/pay
Request payment from another agent.

```json
{
  "from": "agent-identifier",
  "amount": "1.00",
  "token": "USDC",
  "description": "Service description"
}
```

### GET /payments/card
Generate payment link for human users.

```
/payments/card?amount=49&currency=USD&description=Pro%20Plan
```

### POST /payments/webhook
Receive payment confirmations.

## x402 Compliance

AgentMint implements the x402 protocol (HTTP 402 Payment Required):
- Agents receive 402 response with payment terms
- Agent signs payment payload (EIP-712)
- Payment settlement happens on-chain
- Resource released upon confirmation

## Supported Tokens

- **USDC** - Stablecoin on Base, Ethereum, Polygon
- **ETH** - Native Ethereum
- **AUD** - Fiat via Stripe (convert to USDC)

## Use Cases

1. **Agent-to-Agent Services**: One agent pays another for data, processing, or tools
2. **API Monetization**: Charge for API access per request
3. **Human Payments**: Generate links for human customers
4. **Fleet Management**: Track revenue across agent fleet

## Architecture

```
┌─────────────┐     402      ┌─────────────┐
│  AI Agent   │ ───────────► │  AgentMint  │
│  (Client)   │ ◄────────── │   Server    │
└─────────────┘   Payment    └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │   Stripe    │
                              │   or        │
                              │   On-chain  │
                              └─────────────┘
```

## Pricing

| Tier | Price | Transactions |
|------|-------|--------------|
| Dev | Free | 1,000/mo (testnet) |
| Pro | $49/mo | 100,000/mo |
| Enterprise | $499/mo | Unlimited |

## Contributing

See [GitHub](https://github.com/aegntic/agentmint) for issues and PRs.

## License

MIT
