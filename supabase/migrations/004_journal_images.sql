-- =============================================
-- ForTrader — Journal Image Upload Support
-- Jalankan di: Supabase Dashboard → SQL Editor
-- Jalankan SETELAH 003_realtime_config.sql
-- =============================================

-- 1. Tambah kolom before/after images ke journal_entries
ALTER TABLE public.journal_entries
    ADD COLUMN IF NOT EXISTS before_images JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS after_images  JSONB DEFAULT '[]';

-- 2. Tambah kolom actual_result (pips atau dollar aktual saat close)
ALTER TABLE public.journal_entries
    ADD COLUMN IF NOT EXISTS actual_result NUMERIC(15,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS close_date    DATE DEFAULT NULL;

-- 3. Buat Storage Bucket publik untuk journal images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'journal-images',
    'journal-images',
    true,
    5242880,     -- 5MB max per file (sebelum compress)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public            = true,
    file_size_limit   = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 4. Storage RLS Policies
-- User bisa upload ke folder {user_id}/journal-images/
CREATE POLICY "journal_images_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'journal-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- User bisa baca gambar miliknya (dan semua karena public bucket)
CREATE POLICY "journal_images_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'journal-images');

-- Anonymous bisa baca (untuk share publik)
CREATE POLICY "journal_images_public_read" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'journal-images');

-- User hanya bisa hapus gambar miliknya
CREATE POLICY "journal_images_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'journal-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 5. Index untuk query galeri
CREATE INDEX IF NOT EXISTS idx_journal_before_images
    ON public.journal_entries USING GIN (before_images);
CREATE INDEX IF NOT EXISTS idx_journal_after_images
    ON public.journal_entries USING GIN (after_images);
CREATE INDEX IF NOT EXISTS idx_journal_close_date
    ON public.journal_entries (user_id, close_date);
