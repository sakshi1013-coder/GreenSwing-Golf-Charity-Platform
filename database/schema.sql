-- ===================================
-- GreenSwing Database Schema
-- PostgreSQL / Supabase
-- ===================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    charity_id UUID REFERENCES charities(id) ON DELETE SET NULL,
    charity_percentage INT DEFAULT 10 CHECK (charity_percentage >= 10 AND charity_percentage <= 100),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    stripe_subscription_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores table (FIFO - only latest 5 per user enforced at app level)
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INT NOT NULL CHECK (score >= 1 AND score <= 45),
    round_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Charities table
CREATE TABLE charities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    logo_url TEXT,
    website_url TEXT,
    total_received DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draws table
CREATE TABLE draws (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_month DATE NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'published')),
    total_pool DECIMAL(12,2) DEFAULT 0,
    five_match_pool DECIMAL(12,2) DEFAULT 0,
    four_match_pool DECIMAL(12,2) DEFAULT 0,
    three_match_pool DECIMAL(12,2) DEFAULT 0,
    winning_numbers INT[] NOT NULL DEFAULT '{}',
    jackpot_rollover DECIMAL(12,2) DEFAULT 0,
    drawn_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Winners table
CREATE TABLE winners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_id UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('5-match', '4-match', '3-match')),
    matched_numbers INT[],
    prize_amount DECIMAL(10,2),
    proof_url TEXT,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
    verified_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Charity Donations table
CREATE TABLE charity_donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    charity_id UUID NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id),
    month DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_scores_user_id ON scores(user_id);
CREATE INDEX idx_scores_created_at ON scores(created_at DESC);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_winners_draw_id ON winners(draw_id);
CREATE INDEX idx_winners_user_id ON winners(user_id);
CREATE INDEX idx_winners_verification ON winners(verification_status);
CREATE INDEX idx_charity_donations_user_id ON charity_donations(user_id);
CREATE INDEX idx_charity_donations_charity_id ON charity_donations(charity_id);
CREATE INDEX idx_draws_month ON draws(draw_month);

-- Seed initial charities
INSERT INTO charities (name, description, category, website_url) VALUES
  ('Green Earth Fund', 'Environmental conservation & sustainability', 'Environment', 'https://greenearth.org'),
  ('Health Heroes UK', 'NHS support & medical research', 'Healthcare', 'https://healthheroes.org.uk'),
  ('Future Minds', 'Education for underprivileged children', 'Education', 'https://futureminds.org'),
  ('Paws & Claws', 'Animal welfare & rescue shelters', 'Animal Welfare', 'https://pawsclaws.org'),
  ('Ocean Guard', 'Marine conservation & ocean cleanup', 'Environment', 'https://oceanguard.org'),
  ('Youth Sports Trust', 'Youth sports programs & facilities', 'Sports', 'https://youthsports.org');

-- Seed admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, role) VALUES
  ('admin@greenswing.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36V2D6Rh87W.Gq0j/3OEQF6', 'Admin User', 'admin');
