/**
 * Auth Routes - Register, Login, Profile
 * Supports both in-memory (demo) and Supabase (production)
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { supabaseAdmin, isSupabaseConfigured } = require('../config/db');
const { createCustomer } = require('../config/stripe');

// In-memory fallback store for demo mode
const memUsers = [
  {
    id: 'admin-001',
    email: 'admin@greenswing.com',
    password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // "password"
    full_name: 'Admin User',
    role: 'admin',
    charity_id: null,
    charity_percentage: 10,
    created_at: new Date().toISOString()
  }
];

// Helper: get user by email
async function findUserByEmail(email) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
  return memUsers.find(u => u.email === email) || null;
}

// Helper: get user by ID
async function findUserById(id) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
  return memUsers.find(u => u.id === id) || null;
}

// Helper: create user
async function createUser(userData) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert(userData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const user = { id: 'user-' + Date.now(), ...userData, created_at: new Date().toISOString() };
  memUsers.push(user);
  return user;
}

// ===== POST /api/auth/register =====
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, charity_id, charity_percentage, plan_type } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create Stripe customer if configured
    let stripe_customer_id = null;
    try {
      const customer = await createCustomer(email, full_name);
      if (customer) stripe_customer_id = customer.id;
    } catch (stripeErr) {
      console.warn('Stripe customer creation skipped:', stripeErr.message);
    }

    const newUser = await createUser({
      email,
      password_hash,
      full_name,
      role: 'user',
      charity_id: charity_id || null,
      charity_percentage: Math.max(10, parseInt(charity_percentage) || 10),
      stripe_customer_id
    });

    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
        charity_id: newUser.charity_id,
        charity_percentage: newUser.charity_percentage
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/auth/login =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        charity_id: user.charity_id,
        charity_percentage: user.charity_percentage
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/auth/refresh =====
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = generateToken(user);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/auth/me =====
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      charity_id: user.charity_id,
      charity_percentage: user.charity_percentage,
      avatar_url: user.avatar_url,
      created_at: user.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT /api/auth/profile =====
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, charity_id, charity_percentage, avatar_url } = req.body;

    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (charity_id) updates.charity_id = charity_id;
    if (charity_percentage && charity_percentage >= 10) updates.charity_percentage = charity_percentage;
    if (avatar_url) updates.avatar_url = avatar_url;
    updates.updated_at = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', req.user.id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ message: 'Profile updated', user: data });
    }

    // In-memory fallback
    const user = memUsers.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    Object.assign(user, updates);
    res.json({ message: 'Profile updated', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
