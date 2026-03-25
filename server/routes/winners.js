/**
 * Winners Routes - Winnings history, proof upload (Supabase Storage)
 * Supports both in-memory (demo) and Supabase (production)
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin, isSupabaseConfigured } = require('../config/db');

const memWinners = [
  { id: 'win-001', draw_id: 'draw-feb-2026', user_id: 'demo-user-1', match_type: '3-match', matched_numbers: [18, 27, 32], prize_amount: 240, verification_status: 'approved', payment_status: 'paid', created_at: '2026-03-01' },
];

// ===== GET /api/winners/my =====
router.get('/my', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from('winners')
        .select('*, draws(draw_month, winning_numbers)')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const total = data.reduce((sum, w) => sum + parseFloat(w.prize_amount), 0);
      return res.json({ winnings: data, total });
    }

    const userWinnings = memWinners.filter(w => w.user_id === req.user.id);
    const total = userWinnings.reduce((sum, w) => sum + w.prize_amount, 0);
    res.json({ winnings: userWinnings, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/winners/:id/proof =====
// Upload scorecard proof using Supabase Storage
router.post('/:id/proof', authenticateToken, async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      // Verify this winner belongs to the user
      const { data: winner, error: findErr } = await supabaseAdmin
        .from('winners')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .single();
      if (findErr) throw findErr;
      if (!winner) return res.status(404).json({ error: 'Winner entry not found' });

      // Upload file to Supabase Storage
      // Expects base64 encoded file in req.body.file_data
      // Or a URL in req.body.proof_url
      let proof_url = req.body.proof_url;

      if (req.body.file_data && req.body.file_name) {
        const buffer = Buffer.from(req.body.file_data, 'base64');
        const filePath = `proofs/${req.user.id}/${Date.now()}_${req.body.file_name}`;

        const { error: uploadErr } = await supabaseAdmin.storage
          .from('winner-proofs')
          .upload(filePath, buffer, {
            contentType: req.body.content_type || 'image/jpeg',
            upsert: false
          });
        if (uploadErr) throw uploadErr;

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('winner-proofs')
          .getPublicUrl(filePath);
        proof_url = urlData.publicUrl;
      }

      if (!proof_url) {
        return res.status(400).json({ error: 'Proof file or URL is required' });
      }

      // Update winner with proof
      const { data, error: updateErr } = await supabaseAdmin
        .from('winners')
        .update({
          proof_url,
          verification_status: 'pending'
        })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updateErr) throw updateErr;

      return res.json({
        message: 'Proof uploaded. Awaiting admin verification.',
        winner: data
      });
    }

    // Demo mode
    const winner = memWinners.find(w => w.id === req.params.id);
    if (!winner) return res.status(404).json({ error: 'Winner entry not found' });
    winner.proof_url = req.body.proof_url || 'demo_proof.jpg';
    winner.verification_status = 'pending';
    res.json({ message: 'Proof uploaded. Awaiting admin verification.', winner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
