-- =============================================
-- ForTrader — Migration 007: Fix RLS Update
-- Jalankan di: Supabase Dashboard → SQL Editor
-- =============================================

-- ─── 1. Tambah policy UPDATE untuk user_profiles ──
-- (Migration 006 hanya menambah SELECT policy, bukan UPDATE)
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ─── 2. Pastikan column updated_at ada (optional) ──
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── 3. Verifikasi semua policies yang aktif ──
-- SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
