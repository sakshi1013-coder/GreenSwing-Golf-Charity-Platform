/**
 * Draws Routes - Draw system with prize distribution
 * Supports both in-memory (demo) and Supabase (production)
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin, isSupabaseConfigured } = require('../config/db');

// In-memory fallback
const memDraws = [
  {
    id: 'draw-feb-2026',
    draw_month: '2026-02-01',
    status: 'published',
    total_pool: 12400,
    winning_numbers: [14, 18, 27, 32, 38],
    five_match_pool: 4960,
    four_match_pool: 4340,
    three_match_pool: 3100,
    jackpot_rollover: 1240,
    drawn_at: '2026-03-01T12:00:00Z',
    published_at: '2026-03-01T14:00:00Z'
  }
];

// ===== GET /api/draws/current =====
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    if (isSupabaseConfigured()) {
      let { data: draw, error } = await supabaseAdmin
        .from('draws')
        .select('*')
        .eq('draw_month', currentMonth)
        .single();

      if (error && error.code === 'PGRST116') {
        // No draw for this month — calculate prize pool
        const { data: activeSubs } = await supabaseAdmin
          .from('subscriptions')
          .select('amount')
          .eq('status', 'active');

        const totalPool = (activeSubs || []).reduce((sum, s) => sum + parseFloat(s.amount), 0) * 0.6;

        // Get rollover from last draw
        const { data: lastDraw } = await supabaseAdmin
          .from('draws')
          .select('jackpot_rollover')
          .order('draw_month', { ascending: false })
          .limit(1)
          .single();

        const rollover = lastDraw?.jackpot_rollover || 0;

        draw = {
          id: null,
          draw_month: currentMonth,
          status: 'pending',
          total_pool: totalPool,
          winning_numbers: [],
          five_match_pool: totalPool * 0.40 + rollover,
          four_match_pool: totalPool * 0.35,
          three_match_pool: totalPool * 0.25,
          jackpot_rollover: rollover
        };
      } else if (error) throw error;

      return res.json({ draw });
    }

    // In-memory fallback
    let draw = memDraws.find(d => d.draw_month === currentMonth);
    if (!draw) {
      draw = {
        id: 'draw-' + currentMonth,
        draw_month: currentMonth,
        status: 'pending',
        total_pool: 12400,
        winning_numbers: [],
        five_match_pool: 6200,
        four_match_pool: 4340,
        three_match_pool: 3100,
        jackpot_rollover: 1240
      };
    }
    res.json({ draw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/draws/history =====
router.get('/history', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('draws')
        .select('*')
        .eq('status', 'published')
        .order('draw_month', { ascending: false })
        .limit(12);
      if (error) throw error;
      return res.json({ draws: data });
    }

    const draws = memDraws
      .filter(d => d.status === 'published')
      .sort((a, b) => new Date(b.draw_month) - new Date(a.draw_month));
    res.json({ draws });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/draws/:id/results =====
router.get('/:id/results', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data: draw, error: drawErr } = await supabaseAdmin
        .from('draws')
        .select('*')
        .eq('id', req.params.id)
        .single();
      if (drawErr) throw drawErr;

      // Get winners for this draw
      const { data: winners, error: winErr } = await supabaseAdmin
        .from('winners')
        .select('*, users(full_name, email)')
        .eq('draw_id', req.params.id);
      if (winErr) throw winErr;

      return res.json({ draw, winners });
    }

    const draw = memDraws.find(d => d.id === req.params.id);
    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    res.json({ draw, winners: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/draws/my-results =====
// Check if user won in any draw
router.get('/my/results', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('winners')
        .select('*, draws(draw_month, winning_numbers, status)')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json({ results: data });
    }

    res.json({ results: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
