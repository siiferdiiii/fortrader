-- =============================================
-- ForTrader — Supabase Realtime Configuration
-- Jalankan SETELAH 002_rls_policies.sql
-- =============================================

-- Enable Realtime untuk tabel yang membutuhkan live sync
-- (Aktifkan juga di Supabase Dashboard → Database → Replication)

ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_methods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.backtest_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- Note: subscriptions dan payment_history tidak perlu realtime
-- karena diupdate via server-side webhook (payment callback)
