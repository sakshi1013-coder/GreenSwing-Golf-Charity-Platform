/**
 * Charities Routes - CRUD & user selection
 * Supports both in-memory (demo) and Supabase (production)
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin, isSupabaseConfigured } = require('../config/db');

const memCharities = [
  { id: 'ch-001', name: 'Green Earth Fund', description: 'Environmental conservation & sustainability', category: 'Environment', logo_url: null, website_url: 'https://greenearth.org', total_received: 18240, is_active: true },
  { id: 'ch-002', name: 'Health Heroes UK', description: 'NHS support & medical research', category: 'Healthcare', logo_url: null, website_url: 'https://healthheroes.org.uk', total_received: 22150, is_active: true },
  { id: 'ch-003', name: 'Future Minds', description: 'Education for underprivileged children', category: 'Education', logo_url: null, website_url: 'https://futureminds.org', total_received: 15680, is_active: true },
  { id: 'ch-004', name: 'Paws & Claws', description: 'Animal welfare & rescue shelters', category: 'Animal Welfare', logo_url: null, website_url: 'https://pawsclaws.org', total_received: 12400, is_active: true },
  { id: 'ch-005', name: 'Ocean Guard', description: 'Marine conservation & ocean cleanup', category: 'Environment', logo_url: null, website_url: 'https://oceanguard.org', total_received: 9800, is_active: true },
  { id: 'ch-006', name: 'Youth Sports Trust', description: 'Youth sports programs & facilities', category: 'Sports', logo_url: null, website_url: 'https://youthsports.org', total_received: 8200, is_active: true },
];

// ===== GET /api/charities =====
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;

    if (isSupabaseConfigured()) {
      let query = supabaseAdmin
        .from('charities')
        .select('*')
        .eq('is_active', true)
        .order('total_received', { ascending: false });

      if (category) query = query.eq('category', category);
      if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return res.json({ charities: data });
    }

    let result = memCharities.filter(c => c.is_active);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }
    if (category) result = result.filter(c => c.category === category);
    res.json({ charities: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/charities/:id =====
router.get('/:id', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('charities')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (error) throw error;
      return res.json({ charity: data });
    }

    const charity = memCharities.find(c => c.id === req.params.id);
    if (!charity) return res.status(404).json({ error: 'Charity not found' });
    res.json({ charity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT /api/charities/select =====
router.put('/select', authenticateToken, async (req, res) => {
  try {
    const { charity_id } = req.body;
    if (!charity_id) return res.status(400).json({ error: 'Charity ID is required' });

    if (isSupabaseConfigured()) {
      // Verify charity exists
      const { data: charity, error: chErr } = await supabaseAdmin
        .from('charities')
        .select('*')
        .eq('id', charity_id)
        .eq('is_active', true)
        .single();
      if (chErr) throw chErr;
      if (!charity) return res.status(404).json({ error: 'Charity not found' });

      // Update user's charity
      const { error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ charity_id, updated_at: new Date().toISOString() })
        .eq('id', req.user.id);
      if (updateErr) throw updateErr;

      return res.json({ message: `Charity set to ${charity.name}`, charity });
    }

    const charity = memCharities.find(c => c.id === charity_id);
    if (!charity) return res.status(404).json({ error: 'Charity not found' });
    res.json({ message: `Charity set to ${charity.name}`, charity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/charities/donations/history =====
router.get('/donations/history', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('charity_donations')
        .select('*, charities(name)')
        .eq('user_id', req.user.id)
        .order('month', { ascending: false })
        .limit(12);
      if (error) throw error;

      const total = data.reduce((sum, d) => sum + parseFloat(d.amount), 0);
      return res.json({ donations: data, total });
    }

    res.json({
      donations: [
        { month: '2026-03-01', amount: 1.00, charities: { name: 'Health Heroes UK' } },
        { month: '2026-02-01', amount: 1.00, charities: { name: 'Health Heroes UK' } },
        { month: '2026-01-01', amount: 1.00, charities: { name: 'Health Heroes UK' } },
      ],
      total: 3.00
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
