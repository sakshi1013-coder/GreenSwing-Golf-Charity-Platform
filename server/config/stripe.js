/**
 * Stripe Payment Configuration
 * Handles subscription creation, webhooks, and customer management
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let stripe = null;

/**
 * Lazy-initialize Stripe to avoid errors when key isn't configured
 */
function getStripe() {
  if (!stripe && STRIPE_SECRET_KEY) {
    stripe = require('stripe')(STRIPE_SECRET_KEY);
  }
  return stripe;
}

function isStripeConfigured() {
  return !!STRIPE_SECRET_KEY && STRIPE_SECRET_KEY !== 'sk_test_your_key_here';
}

/**
 * Create a Stripe customer for a new user
 */
async function createCustomer(email, name) {
  const s = getStripe();
  if (!s) return null;

  const customer = await s.customers.create({
    email,
    name,
    metadata: { platform: 'greenswing' }
  });
  return customer;
}

/**
 * Create a Stripe Checkout session for subscription
 */
async function createCheckoutSession({ customerId, priceId, successUrl, cancelUrl, userId }) {
  const s = getStripe();
  if (!s) return null;

  const session = await s.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { user_id: userId },
    subscription_data: {
      metadata: { user_id: userId }
    }
  });
  return session;
}

/**
 * Cancel a Stripe subscription
 */
async function cancelSubscription(subscriptionId) {
  const s = getStripe();
  if (!s) return null;

  const sub = await s.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true
  });
  return sub;
}

/**
 * Get subscription details from Stripe
 */
async function getSubscription(subscriptionId) {
  const s = getStripe();
  if (!s) return null;

  return await s.subscriptions.retrieve(subscriptionId);
}

/**
 * Construct and verify a webhook event
 */
function constructWebhookEvent(body, signature) {
  const s = getStripe();
  if (!s || !STRIPE_WEBHOOK_SECRET) return null;

  return s.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
}

// Price IDs for plans (set from Stripe Dashboard)
const PRICE_IDS = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID || 'price_monthly_placeholder',
  yearly: process.env.STRIPE_YEARLY_PRICE_ID || 'price_yearly_placeholder'
};

module.exports = {
  getStripe,
  isStripeConfigured,
  createCustomer,
  createCheckoutSession,
  cancelSubscription,
  getSubscription,
  constructWebhookEvent,
  PRICE_IDS
};
