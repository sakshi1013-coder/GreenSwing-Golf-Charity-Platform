/**
 * Subscription Routes - Plans, Stripe Checkout, management
 * Supports both in-memory (demo) and Supabase + Stripe (production)
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin, isSupabaseConfigured } = require('../config/db');
const { isStripeConfigured, createCheckoutSession, cancelSubscription, constructWebhookEvent, PRICE_IDS } = require('../config/stripe');

const plans = [
  {
    id: 'plan-monthly',
    name: 'Monthly',
    price: 9.99,
    interval: 'month',
    stripe_price_id: PRICE_IDS.monthly,
    features: ['Monthly draw entry', 'Track 5 Stableford scores', 'Choose your charity', 'Full dashboard access', 'Cancel anytime']
  },
  {
    id: 'plan-yearly',
    name: 'Yearly',
    price: 89.99,
    interval: 'year',
    stripe_price_id: PRICE_IDS.yearly,
    savings: 29.89,
    features: ['Everything in Monthly', '2 bonus draw entries', 'Priority charity matching', 'Early draw notifications', 'Exclusive member badge']
  }
];

// In-memory subscriptions for demo
const memSubs = {};

// ===== GET /api/subscriptions/plans =====
router.get('/plans', (req, res) => {
  res.json({ plans });
});

// ===== POST /api/subscriptions/checkout =====
// Creates a Stripe Checkout session for real payments
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    const { plan_id } = req.body;
    const plan = plans.find(p => p.id === plan_id);
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    if (isStripeConfigured() && isSupabaseConfigured()) {
      // Get user's Stripe customer ID
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id, email')
        .eq('id', req.user.id)
        .single();
      if (error) throw error;

      if (!user.stripe_customer_id) {
        return res.status(400).json({ error: 'No Stripe customer. Please re-register.' });
      }

      const session = await createCheckoutSession({
        customerId: user.stripe_customer_id,
        priceId: plan.stripe_price_id,
        successUrl: `${req.headers.origin || 'http://localhost:3000'}/pages/dashboard.html?subscription=success`,
        cancelUrl: `${req.headers.origin || 'http://localhost:3000'}/pages/dashboard.html?subscription=cancelled`,
        userId: req.user.id
      });

      return res.json({ checkout_url: session.url, session_id: session.id });
    }

    // Demo mode: create immediately
    const sub = {
      id: 'sub-' + Date.now(),
      user_id: req.user.id,
      plan_type: plan.interval === 'month' ? 'monthly' : 'yearly',
      status: 'active',
      amount: plan.price,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + (plan.interval === 'month' ? 30 : 365) * 86400000).toISOString()
    };
    memSubs[req.user.id] = sub;

    res.status(201).json({
      message: `${plan.name} subscription activated (demo mode)`,
      subscription: sub
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/subscriptions/create =====
// Direct creation (demo mode or after webhook confirmation)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { plan_id } = req.body;
    const plan = plans.find(p => p.id === plan_id);
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const subData = {
      user_id: req.user.id,
      plan_type: plan.interval === 'month' ? 'monthly' : 'yearly',
      status: 'active',
      amount: plan.price,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + (plan.interval === 'month' ? 30 : 365) * 86400000).toISOString()
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .insert(subData)
        .select()
        .single();
      if (error) throw error;

      // Also create charity donation for this month
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('charity_id, charity_percentage')
        .eq('id', req.user.id)
        .single();

      if (user?.charity_id) {
        const donationAmount = (plan.price * (user.charity_percentage || 10) / 100).toFixed(2);
        await supabaseAdmin.from('charity_donations').insert({
          user_id: req.user.id,
          charity_id: user.charity_id,
          amount: parseFloat(donationAmount),
          subscription_id: data.id,
          month: new Date().toISOString().split('T')[0].slice(0, 7) + '-01'
        });

        // Update charity total_received
        await supabaseAdmin.rpc('increment_charity_total', {
          p_charity_id: user.charity_id,
          p_amount: parseFloat(donationAmount)
        });
      }

      return res.status(201).json({ message: `${plan.name} subscription activated`, subscription: data });
    }

    memSubs[req.user.id] = { id: 'sub-' + Date.now(), ...subData };
    res.status(201).json({ message: `${plan.name} subscription activated`, subscription: memSubs[req.user.id] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/subscriptions/status =====
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code === 'PGRST116') {
        return res.json({ subscription: null, message: 'No active subscription' });
      }
      if (error) throw error;

      // Auto-expire if past end date
      if (data.status === 'active' && new Date(data.end_date) < new Date()) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', data.id);
        data.status = 'expired';
      }

      return res.json({ subscription: data });
    }

    const sub = memSubs[req.user.id];
    if (!sub) return res.json({ subscription: null, message: 'No active subscription' });

    if (sub.status === 'active' && new Date(sub.end_date) < new Date()) {
      sub.status = 'expired';
    }
    res.json({ subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT /api/subscriptions/cancel =====
router.put('/cancel', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data: sub, error: fetchErr } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (fetchErr) throw fetchErr;
      if (!sub) return res.status(404).json({ error: 'No active subscription' });

      // Cancel Stripe subscription if exists
      if (sub.stripe_subscription_id && isStripeConfigured()) {
        await cancelSubscription(sub.stripe_subscription_id);
      }

      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', sub.id)
        .select()
        .single();
      if (error) throw error;

      return res.json({ message: 'Subscription cancelled', subscription: data });
    }

    const sub = memSubs[req.user.id];
    if (!sub) return res.status(404).json({ error: 'No active subscription' });
    sub.status = 'cancelled';
    res.json({ message: 'Subscription cancelled', subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/subscriptions/webhook =====
// Handles Stripe webhooks for subscription lifecycle events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
    if (!event) return res.status(400).json({ error: 'Webhook verification failed' });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const subscriptionId = session.subscription;

        if (isSupabaseConfigured()) {
          // Link Stripe subscription to our DB
          await supabaseAdmin
            .from('subscriptions')
            .update({ stripe_subscription_id: subscriptionId })
            .eq('user_id', userId)
            .eq('status', 'active');
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log('Payment succeeded for subscription:', invoice.subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata.user_id;

        if (isSupabaseConfigured()) {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'cancelled' })
            .eq('stripe_subscription_id', sub.id);
        }
        break;
      }

      default:
        console.log('Unhandled Stripe event:', event.type);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
