const test = require('node:test');
const assert = require('node:assert/strict');

const { AgentPayment } = require('../index');

function createResponseRecorder() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    }
  };
}

test('returns crypto payment instructions when Stripe is not configured', async () => {
  const payment = new AgentPayment({ wallet: '0xabc', acceptedTokens: ['USDC', 'ETH'] });
  const res = createResponseRecorder();

  await payment.handlePaymentRequest(
    {
      body: { from: 'agent-1', amount: 1.25, token: 'USDC', description: 'test' }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, {
    type: 'crypto',
    to: '0xabc',
    amount: 1.25,
    token: 'USDC',
    description: 'test',
    instructions: 'Send 1.25 USDC to 0xabc'
  });
});

test('rejects tokens that are not in acceptedTokens', async () => {
  const payment = new AgentPayment({ wallet: '0xabc', acceptedTokens: ['USDC'] });
  const res = createResponseRecorder();

  await payment.handlePaymentRequest(
    {
      body: { from: 'agent-1', amount: 1, token: 'ETH', description: 'test' }
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Unsupported token: ETH');
});

test('creates Stripe payment intents using the correct minor unit amount', async () => {
  const payment = new AgentPayment({
    wallet: '0xabc',
    acceptedTokens: ['USDC', 'AUD'],
    stripeSecretKey: 'sk_test_placeholder'
  });

  let capturedIntent;
  payment.stripe = {
    paymentIntents: {
      create: async (intent) => {
        capturedIntent = intent;
        return { client_secret: 'secret_123', id: 'pi_123' };
      }
    }
  };

  const res = createResponseRecorder();
  await payment.handlePaymentRequest(
    {
      body: { from: 'agent-1', amount: '1.25', token: 'AUD', description: 'test' }
    },
    res
  );

  assert.equal(capturedIntent.amount, 125);
  assert.equal(capturedIntent.currency, 'aud');
  assert.equal(res.payload.clientSecret, 'secret_123');
});

test('generates payment links from query parameters', async () => {
  const payment = new AgentPayment({
    wallet: '0xabc',
    stripeSecretKey: 'sk_test_placeholder'
  });

  let capturedLink;
  payment.stripe = {
    paymentLinks: {
      create: async (link) => {
        capturedLink = link;
        return { url: 'https://example.com/pay' };
      }
    }
  };

  const res = createResponseRecorder();
  await payment.generatePaymentCard(
    {
      query: { amount: '49', currency: 'AUD', description: 'Pro Plan' }
    },
    res
  );

  assert.equal(capturedLink.line_items[0].price_data.unit_amount, 4900);
  assert.equal(capturedLink.line_items[0].price_data.currency, 'aud');
  assert.equal(capturedLink.line_items[0].price_data.product_data.description, 'Pro Plan');
  assert.equal(res.payload.paymentLink, 'https://example.com/pay');
});
