const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: process.env.BACKEND_PORT || 4000,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  dbPath: process.env.SQLITE_PATH || './backend/aviator.db'
};
