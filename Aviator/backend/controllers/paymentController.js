const Stripe = require('stripe');
const db = require('../db');
const { stripeSecretKey, stripeWebhookSecret, frontendUrl } = require('../config/env');

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function ensureUser(userId) {
  const existing = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO users (user_id, balance) VALUES (?, 0)').run(userId);
  }
}

exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, userId } = req.body;
    if (!amount || !userId) return res.status(400).json({ error: 'amount and userId are required' });

    ensureUser(userId);

    if (!stripe) {
      const fakeClientSecret = `pi_demo_${Date.now()}_secret_demo`;
      return res.json({ clientSecret: fakeClientSecret, mode: 'demo' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'usd',
      metadata: { userId },
      automatic_payment_methods: { enabled: true }
    });

    db.prepare('INSERT OR REPLACE INTO payments (user_id, payment_intent_id, amount, status) VALUES (?, ?, ?, ?)')
      .run(userId, paymentIntent.id, Number(amount), paymentIntent.status);

    res.json({ clientSecret: paymentIntent.client_secret, publishableHint: frontendUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.webhook = async (req, res) => {
  try {
    if (!stripe || !stripeWebhookSecret) {
      return res.json({ received: true, mode: 'demo' });
    }

    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const userId = intent.metadata.userId;
      const amount = intent.amount_received / 100;

      ensureUser(userId);
      db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').run(amount, userId);
      db.prepare('UPDATE payments SET status = ? WHERE payment_intent_id = ?').run('succeeded', intent.id);
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
