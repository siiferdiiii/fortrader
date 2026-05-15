-- =============================================
-- ForTrader — Migration 007: Fix RLS Update
-- Jalankan di: Supabase Dashboard → SQL Editor
-- =============================================

-- ─── Pastikan column updated_at ada ──
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── Verifikasi policies yang aktif ──
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';
