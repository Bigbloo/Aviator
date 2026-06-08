/**
 * paymentController.js
 * Handles Stripe payment intents and webhooks.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

/**
 * POST /api/create-payment-intent
 * Body: { amount: number (in euros), userId: string }
 * Creates a Stripe PaymentIntent and returns the clientSecret.
 */
const createPaymentIntent = async (req, res) => {
  try {
    const userId = req.userId; // from verified JWT
    const { amount } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Minimum deposit is 1€' });
    }

    // Ensure user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      db.prepare('INSERT INTO users (id, balance) VALUES (?, ?)').run(userId, 0);
    }

    // Create PaymentIntent (amount in cents)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'eur',
      metadata: { userId },
      automatic_payment_methods: { enabled: true },
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[PaymentIntent Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/webhook
 * Stripe webhook endpoint — credits user balance after successful payment.
 * Must use raw body (express.raw middleware).
 */
const handleWebhook = (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Webhook Signature Error]', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const userId = intent.metadata.userId;
    const amountEuros = intent.amount / 100;

    // Credit user balance
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amountEuros, userId);

    // Record transaction
    db.prepare(
      'INSERT INTO transactions (id, user_id, type, amount, stripe_intent) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, 'deposit', amountEuros, intent.id);

    console.log(`[Webhook] Credited ${amountEuros}€ to user ${userId}`);
  }

  return res.json({ received: true });
};

/**
 * POST /api/deposit/simulate
 * DEV ONLY — Simulates a deposit without real Stripe payment.
 * Body: { userId, amount }
 */
const simulateDeposit = (req, res) => {
  const userId = req.userId; // from verified JWT
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    db.prepare('INSERT INTO users (id, balance) VALUES (?, ?)').run(userId, 0);
  }

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
  db.prepare(
    'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), userId, 'deposit', amount);

  const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  return res.json({ success: true, balance: updated.balance });
};

/**
 * POST /api/withdraw
 * Body: { userId, amount, stripeAccountId }
 * In test mode: simulates withdrawal and deducts from balance.
 */
const withdraw = (req, res) => {
  const userId = req.userId; // from verified JWT
  const { amount, stripeAccountId } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal request' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

  // Deduct balance
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);
  db.prepare(
    'INSERT INTO transactions (id, user_id, type, amount) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), userId, 'withdrawal', amount);

  const updated = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);

  // In production: use Stripe Connect to transfer funds
  // await stripe.transfers.create({ amount: amount * 100, currency: 'eur', destination: stripeAccountId });

  return res.json({
    success: true,
    message: `Withdrawal of ${amount}€ simulated. In production, funds sent to Stripe account.`,
    balance: updated.balance,
  });
};

module.exports = { createPaymentIntent, handleWebhook, simulateDeposit, withdraw };
