-- =============================================
-- ForTrader — Row Level Security Policies
-- Jalankan SETELAH 001_initial_schema.sql
-- =============================================

-- ─── ENABLE RLS ──────────────────────────────
ALTER TABLE public.user_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_methods   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries   ENABLE ROW LEVEL SECURITY;

-- ─── USER PROFILES ───────────────────────────
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ─── SUBSCRIPTIONS ───────────────────────────
-- Users can only read their own subscription
-- Write is done server-side via service_role (payment callback)
CREATE POLICY "Users can view own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
    ON public.subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- ─── PAYMENT HISTORY ─────────────────────────
CREATE POLICY "Users can view own payment history"
    ON public.payment_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage payment history"
    ON public.payment_history FOR ALL
    USING (auth.role() = 'service_role');

-- ─── TRADING METHODS ─────────────────────────
CREATE POLICY "Users can view own methods"
    ON public.trading_methods FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own methods"
    ON public.trading_methods FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own methods"
    ON public.trading_methods FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own methods"
    ON public.trading_methods FOR DELETE
    USING (auth.uid() = user_id);

-- ─── BACKTEST SESSIONS ───────────────────────
CREATE POLICY "Users can view own sessions"
    ON public.backtest_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON public.backtest_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON public.backtest_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON public.backtest_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- ─── JOURNAL ENTRIES ─────────────────────────
CREATE POLICY "Users can view own journal entries"
    ON public.journal_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
    ON public.journal_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
    ON public.journal_entries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
    ON public.journal_entries FOR DELETE
    USING (auth.uid() = user_id);
