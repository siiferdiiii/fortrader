-- =============================================
-- ForTrader — Supabase Database Schema
-- Jalankan di: Supabase Dashboard → SQL Editor
-- =============================================

-- ─── USER PROFILES ───────────────────────────
-- Extended profile yang link ke auth.users (dikelola Supabase Auth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name       VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url      TEXT,
    plan            VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS ───────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan                    VARCHAR(20) NOT NULL CHECK (plan IN ('basic', 'pro')),
    status                  VARCHAR(30) DEFAULT 'incomplete'
                            CHECK (status IN ('incomplete', 'active', 'canceled', 'past_due', 'expired')),
    ipaymu_transaction_id   VARCHAR(100),
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    canceled_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENT HISTORY ─────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_cents    INTEGER NOT NULL DEFAULT 0,
    currency        VARCHAR(5) DEFAULT 'idr',
    status          VARCHAR(30) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    ipaymu_trx_id   VARCHAR(100),
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRADING METHODS ─────────────────────────
-- Metode/strategi trading milik user (sebelumnya di localStorage)
CREATE TABLE IF NOT EXISTS public.trading_methods (
    id              TEXT PRIMARY KEY,          -- nanoid dari client
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    sop_entry       TEXT DEFAULT '',
    sop_exit        TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BACKTEST SESSIONS ───────────────────────
-- Sesi backtest beserta array trades (JSONB)
CREATE TABLE IF NOT EXISTS public.backtest_sessions (
    id                  TEXT PRIMARY KEY,      -- nanoid dari client
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                VARCHAR(200) NOT NULL,
    pair                VARCHAR(20) NOT NULL,
    method_id           TEXT,
    method_name         VARCHAR(200),
    initial_balance     NUMERIC(15,2) NOT NULL DEFAULT 10000,
    current_balance     NUMERIC(15,2) NOT NULL DEFAULT 10000,
    risk_pct            NUMERIC(6,3) NOT NULL DEFAULT 1,
    rr                  NUMERIC(6,2) NOT NULL DEFAULT 2,
    trades              JSONB NOT NULL DEFAULT '[]',
    is_active           BOOLEAN DEFAULT FALSE, -- sesi yang sedang berjalan
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── JOURNAL ENTRIES ─────────────────────────
-- Jurnal trade individual (sebelumnya di localStorage)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id                  TEXT PRIMARY KEY,      -- nanoid dari client
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pair                VARCHAR(20) NOT NULL,
    method_name         VARCHAR(200),
    method_id           TEXT,
    open_time           VARCHAR(10),
    close_time          VARCHAR(10),
    balance             NUMERIC(15,2),
    risk                NUMERIC(6,3),
    lot_size            NUMERIC(10,4),
    sl_pips             NUMERIC(10,2),
    tp_pips             NUMERIC(10,2),
    potential_loss      NUMERIC(15,2),
    potential_profit    NUMERIC(15,2),
    emotion             VARCHAR(50),
    notes               TEXT DEFAULT '',
    sop_entry_checked   JSONB DEFAULT '[]',
    sop_exit_checked    JSONB DEFAULT '[]',
    news_tags           JSONB DEFAULT '[]',
    status              VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'tp', 'sl')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_methods_user ON public.trading_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_sessions_user ON public.backtest_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_sessions_active ON public.backtest_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries(user_id, status);

-- ─── TRIGGERS: auto update updated_at ────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_trading_methods_updated_at
    BEFORE UPDATE ON public.trading_methods
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_backtest_sessions_updated_at
    BEFORE UPDATE ON public.backtest_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_journal_entries_updated_at
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── TRIGGER: auto-create user_profile on signup ─
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
