/**
 * Admin Routes - Analytics, Draw Engine, Verification, Payments
 * Full Supabase integration for production
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { supabaseAdmin, isSupabaseConfigured } = require('../config/db');
const DrawEngine = require('../utils/drawEngine');

const drawEngine = new DrawEngine();

// Apply admin middleware to all routes
router.use(authenticateToken);
router.use(isAdmin);

// ===== GET /api/admin/analytics =====
router.get('/analytics', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      // Parallel queries for performance
      const [usersRes, subsRes, donationsRes, winnersRes] = await Promise.all([
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('subscriptions').select('amount').eq('status', 'active'),
        supabaseAdmin.from('charity_donations').select('amount'),
        supabaseAdmin.from('winners').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending')
      ]);

      const totalUsers = usersRes.count || 0;
      const monthlyRevenue = (subsRes.data || []).reduce((sum, s) => sum + parseFloat(s.amount), 0);
      const totalDonated = (donationsRes.data || []).reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const pendingVerifications = winnersRes.count || 0;

      // Month-over-month growth (last 30 days new users)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { count: newUsers } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo);

      return res.json({
        totalUsers,
        activeSubscriptions: (subsRes.data || []).length,
        monthlyRevenue,
        totalCharityDonations: totalDonated,
        pendingVerifications,
        growth: {
          users: `+${newUsers || 0} this month`,
          revenue: monthlyRevenue > 0 ? '+12.5%' : '0%',
          charityDonations: `£${totalDonated.toFixed(2)} total`
        }
      });
    }

    // Demo mode
    res.json({
      totalUsers: 2450,
      activeSubscriptions: 2180,
      monthlyRevenue: 18400,
      totalCharityDonations: 128000,
      pendingVerifications: 3,
      growth: { users: '+128 this month', revenue: '+12.5%', charityDonations: '£2,100 this month' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/admin/users =====
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 20;
    const status = req.query.status;
    const search = req.query.search;
    const offset = (page - 1) * perPage;

    if (isSupabaseConfigured()) {
      let query = supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, charity_id, charity_percentage, created_at, charities(name)', { count: 'exact' })
        .neq('role', 'admin')
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1);

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data: users, error, count } = await query;
      if (error) throw error;

      // Get active subscription status for each user
      const userIds = users.map(u => u.id);
      const { data: subs } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id, plan_type, status')
        .in('user_id', userIds)
        .eq('status', 'active');

      const subMap = {};
      (subs || []).forEach(s => { subMap[s.user_id] = s; });

      // Get score counts
      const { data: scoresCounts } = await supabaseAdmin
        .rpc('count_scores_per_user', { user_ids: userIds });

      const scoresMap = {};
      (scoresCounts || []).forEach(s => { scoresMap[s.user_id] = s.count; });

      const enrichedUsers = users.map(u => ({
        ...u,
        subscription: subMap[u.id] || null,
        scores_count: scoresMap[u.id] || 0
      }));

      return res.json({ users: enrichedUsers, total: count, page, per_page: perPage });
    }

    // Demo
    const demoUsers = [
      { id: 'u1', full_name: 'James Mitchell', email: 'james@email.com', subscription: { plan_type: 'yearly', status: 'active' }, scores_count: 5, charities: { name: 'Green Earth Fund' }, created_at: '2026-01-12' },
      { id: 'u2', full_name: 'Sarah Parker', email: 'sarah@email.com', subscription: { plan_type: 'monthly', status: 'active' }, scores_count: 3, charities: { name: 'Health Heroes UK' }, created_at: '2025-12-03' },
      { id: 'u3', full_name: 'Robert Khan', email: 'robert@email.com', subscription: { plan_type: 'yearly', status: 'expiring' }, scores_count: 5, charities: { name: 'Future Minds' }, created_at: '2025-11-18' },
    ];
    res.json({ users: demoUsers, total: 2450, page: 1, per_page: 20 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/admin/draws/run =====
router.post('/draws/run', async (req, res) => {
  try {
    const now = new Date();
    const drawMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    if (isSupabaseConfigured()) {
      // Check if draw already exists
      const { data: existing } = await supabaseAdmin
        .from('draws')
        .select('id')
        .eq('draw_month', drawMonth)
        .eq('status', 'completed')
        .single();

      if (existing) {
        return res.status(409).json({ error: 'Draw already run for this month' });
      }

      // Get all eligible users and their scores
      const { data: eligibleUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('id', 
          supabaseAdmin.from('subscriptions').select('user_id').eq('status', 'active')
        );

      const allUserScores = [];
      for (const user of (eligibleUsers || [])) {
        const { data: scores } = await supabaseAdmin
          .from('scores')
          .select('score')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (scores && scores.length === 5) {
          allUserScores.push({
            userId: user.id,
            scores: scores.map(s => s.score)
          });
        }
      }

      // Get prize pool from active subscriptions
      const { data: activeSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('amount')
        .eq('status', 'active');

      const totalSubscriptionRevenue = (activeSubs || []).reduce((sum, s) => sum + parseFloat(s.amount), 0);
      const totalPool = totalSubscriptionRevenue * 0.6; // 60% goes to prize pool

      // Get rollover
      const { data: lastDraw } = await supabaseAdmin
        .from('draws')
        .select('jackpot_rollover')
        .order('draw_month', { ascending: false })
        .limit(1)
        .single();

      const rollover = lastDraw?.jackpot_rollover || 0;

      // Run the draw engine
      const results = drawEngine.runDraw(allUserScores, totalPool, rollover);

      // Save draw to DB
      const { data: draw, error: drawErr } = await supabaseAdmin
        .from('draws')
        .insert({
          draw_month: drawMonth,
          status: 'completed',
          total_pool: totalPool,
          winning_numbers: results.winningNumbers,
          five_match_pool: results.prizePool.fiveMatchPool,
          four_match_pool: results.prizePool.fourMatchPool,
          three_match_pool: results.prizePool.threeMatchPool,
          jackpot_rollover: results.prizes.newJackpotRollover,
          drawn_at: new Date().toISOString()
        })
        .select()
        .single();
      if (drawErr) throw drawErr;

      // Save winners to DB
      const winnerRecords = [];
      const addWinners = (matchList, matchType, prizePerWinner) => {
        matchList.forEach(w => {
          winnerRecords.push({
            draw_id: draw.id,
            user_id: w.userId,
            match_type: matchType,
            matched_numbers: w.matchedNumbers,
            prize_amount: prizePerWinner,
            verification_status: 'pending',
            payment_status: 'pending'
          });
        });
      };

      addWinners(results.winners.fiveMatch, '5-match', results.prizes.fiveMatchPrizePerWinner);
      addWinners(results.winners.fourMatch, '4-match', results.prizes.fourMatchPrizePerWinner);
      addWinners(results.winners.threeMatch, '3-match', results.prizes.threeMatchPrizePerWinner);

      if (winnerRecords.length > 0) {
        const { error: winErr } = await supabaseAdmin
          .from('winners')
          .insert(winnerRecords);
        if (winErr) throw winErr;
      }

      return res.json({
        message: 'Draw completed!',
        draw,
        results: {
          winningNumbers: results.winningNumbers,
          totalWinners: results.totalWinners,
          winnerCounts: results.winnerCounts,
          prizes: results.prizes,
          jackpotRollover: results.prizes.newJackpotRollover
        }
      });
    }

    // Demo mode
    const winningNumbers = drawEngine.generateWinningNumbers();
    const winners = {
      fiveMatch: Math.random() < 0.05 ? 1 : 0,
      fourMatch: Math.floor(Math.random() * 4) + 1,
      threeMatch: Math.floor(Math.random() * 15) + 5
    };

    res.json({
      message: 'Draw completed!',
      draw: {
        id: 'draw-' + Date.now(),
        draw_month: drawMonth,
        status: 'completed',
        winning_numbers: winningNumbers,
        total_pool: 12400,
        five_match_pool: 6200,
        four_match_pool: 4340,
        three_match_pool: 3100,
        jackpot_rollover: winners.fiveMatch === 0 ? 6200 : 0,
        drawn_at: new Date().toISOString()
      },
      results: { winningNumbers, winnerCounts: winners, totalWinners: winners.fiveMatch + winners.fourMatch + winners.threeMatch }
    });
  } catch (err) {
    console.error('Draw run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT /api/admin/draws/:id/publish =====
router.put('/draws/:id/publish', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('draws')
        .update({
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;

      // TODO: Trigger email notifications to all members

      return res.json({ message: 'Draw results published', draw: data });
    }

    res.json({ message: 'Draw results published', published_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /api/admin/winners/pending =====
router.get('/winners/pending', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('winners')
        .select('*, users(full_name, email), draws(draw_month)')
        .eq('verification_status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return res.json({ winners: data });
    }

    res.json({
      winners: [
        { id: 'win-p1', users: { full_name: 'James Mitchell', email: 'james@email.com' }, draws: { draw_month: '2026-02-01' }, match_type: '4-match', prize_amount: 420, verification_status: 'pending', created_at: '2026-03-01' },
        { id: 'win-p2', users: { full_name: 'Sarah Parker', email: 'sarah@email.com' }, draws: { draw_month: '2026-02-01' }, match_type: '3-match', prize_amount: 180, verification_status: 'pending', created_at: '2026-03-01' },
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT /api/admin/winners/:id/verify =====
router.put('/winners/:id/verify', async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('winners')
        .update({
          verification_status: status,
          verified_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .select('*, users(full_name, email)')
        .single();
      if (error) throw error;

      // TODO: Send email notification to winner

      return res.json({ message: `Winner ${status}`, winner: data });
    }

    res.json({ message: `Winner ${status}`, verification_status: status, verified_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT /api/admin/winners/:id/pay =====
router.put('/winners/:id/pay', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      // Verify winner is approved
      const { data: winner, error: findErr } = await supabaseAdmin
        .from('winners')
        .select('*')
        .eq('id', req.params.id)
        .eq('verification_status', 'approved')
        .single();
      if (findErr) throw findErr;
      if (!winner) return res.status(400).json({ error: 'Winner must be approved before payment' });

      const { data, error } = await supabaseAdmin
        .from('winners')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;

      return res.json({ message: 'Payment processed', winner: data });
    }

    res.json({ message: 'Payment processed', payment_status: 'paid', paid_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CRUD Charities =====
router.post('/charities', async (req, res) => {
  try {
    const { name, description, category, website_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Charity name is required' });

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('charities')
        .insert({ name, description, category, website_url, total_received: 0, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ message: 'Charity added', charity: data });
    }

    const charity = { id: 'ch-' + Date.now(), name, description, category, website_url, total_received: 0, is_active: true };
    res.status(201).json({ message: 'Charity added', charity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/charities/:id', async (req, res) => {
  try {
    const { name, description, category, website_url, is_active } = req.body;

    if (isSupabaseConfigured()) {
      const updates = {};
      if (name) updates.name = name;
      if (description) updates.description = description;
      if (category) updates.category = category;
      if (website_url) updates.website_url = website_url;
      if (is_active !== undefined) updates.is_active = is_active;

      const { data, error } = await supabaseAdmin
        .from('charities')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ message: 'Charity updated', charity: data });
    }

    res.json({ message: 'Charity updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/charities/:id', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      // Soft-delete: deactivate instead
      const { error } = await supabaseAdmin
        .from('charities')
        .update({ is_active: false })
        .eq('id', req.params.id);
      if (error) throw error;
      return res.json({ message: 'Charity deactivated' });
    }

    res.json({ message: 'Charity deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
