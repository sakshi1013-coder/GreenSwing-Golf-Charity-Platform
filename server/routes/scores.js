/**
 * Scores Routes - CRUD with FIFO (max 5 scores)
 * Supports both in-memory (demo) and Supabase (production)
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin, isSupabaseConfigured } = require('../config/db');

// In-memory score store for demo
const memScores = {};

// ===== GET /api/scores =====
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('scores')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return res.json({ scores: data });
    }

    const userScores = (memScores[req.user.id] || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    res.json({ scores: userScores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/scores =====
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { score, round_date } = req.body;
    const scoreVal = parseInt(score);

    if (!scoreVal || scoreVal < 1 || scoreVal > 45) {
      return res.status(400).json({ error: 'Score must be between 1 and 45 (Stableford)' });
    }

    if (isSupabaseConfigured()) {
      // Insert new score
      const { data: newScore, error: insertErr } = await supabaseAdmin
        .from('scores')
        .insert({
          user_id: req.user.id,
          score: scoreVal,
          round_date: round_date || new Date().toISOString().split('T')[0]
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      // FIFO: Get all scores for user ordered by date, delete oldest beyond 5
      const { data: allScores, error: fetchErr } = await supabaseAdmin
        .from('scores')
        .select('id')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;

      let removed = null;
      if (allScores.length > 5) {
        const toDelete = allScores.slice(5).map(s => s.id);
        const { error: delErr } = await supabaseAdmin
          .from('scores')
          .delete()
          .in('id', toDelete);
        if (delErr) throw delErr;
        removed = { count: toDelete.length };
      }

      return res.status(201).json({
        message: removed
          ? `Score added. ${removed.count} old score(s) removed (FIFO).`
          : 'Score added successfully.',
        score: newScore,
        removed
      });
    }

    // In-memory fallback
    if (!memScores[req.user.id]) memScores[req.user.id] = [];

    const newScore = {
      id: 'score-' + Date.now(),
      user_id: req.user.id,
      score: scoreVal,
      round_date: round_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    memScores[req.user.id].unshift(newScore);

    let removed = null;
    if (memScores[req.user.id].length > 5) {
      removed = memScores[req.user.id].pop();
    }

    res.status(201).json({
      message: removed
        ? `Score added. Oldest score (${removed.score}) removed (FIFO).`
        : 'Score added successfully.',
      score: newScore,
      removed,
      total: memScores[req.user.id].length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT /api/scores/:id =====
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { score } = req.body;
    const scoreVal = parseInt(score);

    if (!scoreVal || scoreVal < 1 || scoreVal > 45) {
      return res.status(400).json({ error: 'Score must be between 1 and 45' });
    }

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('scores')
        .update({ score: scoreVal })
        .eq('id', req.params.id)
        .eq('user_id', req.user.id) // ensure ownership
        .select()
        .single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Score not found' });
      return res.json({ message: 'Score updated', score: data });
    }

    const userScores = memScores[req.user.id] || [];
    const scoreEntry = userScores.find(s => s.id === req.params.id);
    if (!scoreEntry) return res.status(404).json({ error: 'Score not found' });

    scoreEntry.score = scoreVal;
    res.json({ message: 'Score updated', score: scoreEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE /api/scores/:id =====
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { error } = await supabaseAdmin
        .from('scores')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.user.id);
      if (error) throw error;
      return res.json({ message: 'Score deleted' });
    }

    if (!memScores[req.user.id]) {
      return res.status(404).json({ error: 'No scores found' });
    }

    const before = memScores[req.user.id].length;
    memScores[req.user.id] = memScores[req.user.id].filter(s => s.id !== req.params.id);
    if (memScores[req.user.id].length === before) {
      return res.status(404).json({ error: 'Score not found' });
    }

    res.json({ message: 'Score deleted', remaining: memScores[req.user.id].length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
