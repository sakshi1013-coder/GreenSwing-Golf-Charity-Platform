-- ===================================
-- GreenSwing Database Functions
-- Run AFTER schema.sql
-- ===================================

-- Add stripe_customer_id column to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Add stripe_subscription_id column to subscriptions if not exists  
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- ===================================
-- RPC Functions
-- ===================================

-- Increment charity total_received atomically
CREATE OR REPLACE FUNCTION increment_charity_total(p_charity_id UUID, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE charities 
  SET total_received = total_received + p_amount
  WHERE id = p_charity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count scores per user (batch)
CREATE OR REPLACE FUNCTION count_scores_per_user(user_ids UUID[])
RETURNS TABLE(user_id UUID, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id, COUNT(*) as count
  FROM scores s
  WHERE s.user_id = ANY(user_ids)
  GROUP BY s.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get monthly revenue (for charts)
CREATE OR REPLACE FUNCTION get_monthly_revenue(months_back INT DEFAULT 12)
RETURNS TABLE(month DATE, revenue DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT DATE_TRUNC('month', s.created_at)::DATE as month,
         SUM(s.amount) as revenue
  FROM subscriptions s
  WHERE s.created_at >= NOW() - (months_back || ' months')::INTERVAL
    AND s.status IN ('active', 'expired')
  GROUP BY DATE_TRUNC('month', s.created_at)
  ORDER BY month DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get charity leaderboard
CREATE OR REPLACE FUNCTION get_charity_leaderboard(limit_count INT DEFAULT 10)
RETURNS TABLE(
  charity_id UUID,
  charity_name VARCHAR,
  category VARCHAR,
  total_received DECIMAL,
  supporter_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.category, c.total_received,
         COUNT(DISTINCT u.id) as supporter_count
  FROM charities c
  LEFT JOIN users u ON u.charity_id = c.id
  WHERE c.is_active = true
  GROUP BY c.id, c.name, c.category, c.total_received
  ORDER BY c.total_received DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enforce FIFO: auto-delete oldest scores beyond 5 (can be used as a trigger)
CREATE OR REPLACE FUNCTION enforce_score_fifo()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM scores
  WHERE id IN (
    SELECT id FROM scores
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 5
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach FIFO trigger to scores table
DROP TRIGGER IF EXISTS trg_score_fifo ON scores;
CREATE TRIGGER trg_score_fifo
AFTER INSERT ON scores
FOR EACH ROW
EXECUTE FUNCTION enforce_score_fifo();

-- ===================================
-- Row Level Security (RLS) Policies
-- ===================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE charity_donations ENABLE ROW LEVEL SECURITY;

-- Users: can read own, admin can read all
CREATE POLICY users_read_own ON users FOR SELECT USING (
  auth.uid()::text = id::text OR 
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
);

-- Scores: user can CRUD own scores
CREATE POLICY scores_user_all ON scores FOR ALL USING (
  user_id::text = auth.uid()::text
);

-- Subscriptions: user can read own
CREATE POLICY subs_read_own ON subscriptions FOR SELECT USING (
  user_id::text = auth.uid()::text
);

-- Winners: user can read own
CREATE POLICY winners_read_own ON winners FOR SELECT USING (
  user_id::text = auth.uid()::text
);

-- Charity donations: user can read own
CREATE POLICY donations_read_own ON charity_donations FOR SELECT USING (
  user_id::text = auth.uid()::text
);

-- Charities: public read
ALTER TABLE charities ENABLE ROW LEVEL SECURITY;
CREATE POLICY charities_public_read ON charities FOR SELECT USING (true);

-- Draws: public read for published
ALTER TABLE draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY draws_public_read ON draws FOR SELECT USING (status = 'published');

-- ===================================
-- Supabase Storage (run in Dashboard)
-- ===================================
-- 1. Create bucket: winner-proofs (public: false)
-- 2. Create policy: Allow authenticated users to upload to proofs/{user_id}/*
-- 3. Create policy: Allow admin users to read all files
-- 4. Max file size: 5MB
-- 5. Allowed types: image/jpeg, image/png, application/pdf
