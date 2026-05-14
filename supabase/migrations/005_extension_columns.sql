-- Migration 005: Extension support columns
ALTER TABLE public.backtest_sessions
    ADD COLUMN IF NOT EXISTS rr_mode VARCHAR(10) DEFAULT 'fixed'
        CHECK (rr_mode IN ('fixed', 'dynamic')),
    ADD COLUMN IF NOT EXISTS source  VARCHAR(20) DEFAULT 'web'
        CHECK (source IN ('web', 'extension'));
