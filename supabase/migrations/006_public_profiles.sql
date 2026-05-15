-- =============================================
-- ForTrader — Migration 006: Public Profiles
-- Jalankan di: Supabase Dashboard → SQL Editor
-- =============================================

-- ─── 1. TAMBAH KOLOM KE user_profiles ────────
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS username         VARCHAR(30) UNIQUE,
    ADD COLUMN IF NOT EXISTS bio              TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_journal_public  BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_methods_public  BOOLEAN DEFAULT FALSE;

-- ─── 2. INDEX UNTUK SEARCH & LOOKUP ──────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_public_journal ON public.user_profiles(is_journal_public) WHERE is_journal_public = TRUE;

-- ─── 3. BACKFILL: generate username untuk user yang sudah ada ──
-- Generate username dari email prefix + random suffix
UPDATE public.user_profiles
SET username = LOWER(
    REGEXP_REPLACE(
        SPLIT_PART(
            (SELECT email FROM auth.users WHERE auth.users.id = user_profiles.id),
            '@', 1
        ),
        '[^a-z0-9_]', '', 'g'
    )
) || SUBSTRING(MD5(id::TEXT), 1, 4)
WHERE username IS NULL;

-- ─── 4. UPDATE TRIGGER: auto-generate username saat signup ────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    suffix        TEXT;
    counter       INT := 0;
BEGIN
    -- Base username dari full_name atau email prefix
    base_username := LOWER(REGEXP_REPLACE(
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
            SPLIT_PART(NEW.email, '@', 1)
        ),
        '[^a-z0-9_]', '', 'g'
    ));

    -- Minimal 3 karakter
    IF LENGTH(base_username) < 3 THEN
        base_username := 'trader' || base_username;
    END IF;

    -- Truncate 24 chars + 4 suffix = max 28
    base_username := SUBSTRING(base_username, 1, 24);

    -- Cari username yang belum dipakai
    final_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = final_username) LOOP
        suffix := SUBSTRING(MD5(RANDOM()::TEXT), 1, 4);
        final_username := base_username || suffix;
        counter := counter + 1;
        IF counter > 10 THEN
            final_username := 'trader' || SUBSTRING(MD5(NEW.id::TEXT), 1, 8);
            EXIT;
        END IF;
    END LOOP;

    INSERT INTO public.user_profiles (id, full_name, username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        final_username
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. RLS: ALLOW ANON TO READ PUBLIC PROFILES ───
-- (user_profiles sudah enable RLS dari migration 002)

-- Hapus policy lama yang terlalu restrictif, ganti dengan yang mendukung publik
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

-- Pemilik bisa lihat profilnya sendiri; siapa saja bisa lihat profil yang punya is_journal_public atau is_methods_public
CREATE POLICY "Profile viewable by owner or if public"
    ON public.user_profiles FOR SELECT
    USING (
        auth.uid() = id
        OR is_journal_public = TRUE
        OR is_methods_public = TRUE
    );

-- ─── 6. RLS: ALLOW ANON TO READ PUBLIC JOURNAL ENTRIES ───
DROP POLICY IF EXISTS "Users can view own journal entries" ON public.journal_entries;

CREATE POLICY "Journal viewable by owner or if owner made it public"
    ON public.journal_entries FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.user_profiles p
            WHERE p.id = journal_entries.user_id
              AND p.is_journal_public = TRUE
        )
    );

-- ─── 7. RLS: ALLOW ANON TO READ PUBLIC TRADING METHODS ───
DROP POLICY IF EXISTS "Users can view own methods" ON public.trading_methods;

CREATE POLICY "Methods viewable by owner or if owner made it public"
    ON public.trading_methods FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.user_profiles p
            WHERE p.id = trading_methods.user_id
              AND p.is_methods_public = TRUE
        )
    );

-- ─── 8. FUNGSI: Search users by username (case-insensitive) ──
CREATE OR REPLACE FUNCTION public.search_public_users(query TEXT)
RETURNS TABLE (
    id          UUID,
    username    VARCHAR,
    full_name   VARCHAR,
    bio         TEXT,
    is_journal_public  BOOLEAN,
    is_methods_public  BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id, p.username, p.full_name, p.bio,
        p.is_journal_public, p.is_methods_public
    FROM public.user_profiles p
    WHERE
        (p.is_journal_public = TRUE OR p.is_methods_public = TRUE)
        AND (
            p.username ILIKE '%' || query || '%'
            OR p.full_name ILIKE '%' || query || '%'
        )
    ORDER BY p.username
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.search_public_users(TEXT) TO anon, authenticated;
