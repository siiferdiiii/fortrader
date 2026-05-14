/* ========================================
   SUPABASE-CLIENT.JS — Singleton Supabase Client
   Diinisialisasi sebelum semua modul lain.
   ======================================== */

// Supabase URL & Key
const SUPABASE_URL  = window.__SUPABASE_URL  || 'https://orbbjgjzaissjbovbcbc.supabase.co';
const SUPABASE_ANON = window.__SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYmJqZ2p6YWlzc2pib3ZiY2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzA3NTMsImV4cCI6MjA5NDM0Njc1M30.ZTHyM5PMcFiOlL7Ji6d6Tcx9aC001S3PpA_D9FkKefM';

// Guard: pastikan SDK sudah ter-load
(function initSupabase() {
    // jsDelivr UMD build mengexpose window.supabase
    const lib = window.supabase;

    if (!lib || typeof lib.createClient !== 'function') {
        console.error(
            '[ForTrader] Supabase SDK belum ter-load!\n' +
            'Pastikan CDN <script> ada di <head> SEBELUM supabase-client.js.\n' +
            'CDN: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
        );
        // Tampilkan banner error ke user
        document.addEventListener('DOMContentLoaded', () => {
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ef4444;color:#fff;padding:12px 16px;font-family:monospace;font-size:13px;z-index:99999;text-align:center;';
            banner.textContent = '⚠️ Supabase SDK gagal dimuat. Periksa koneksi internet Anda dan refresh halaman.';
            document.body.prepend(banner);
        });
        return;
    }

    // Buat singleton client
    const client = lib.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: {
            autoRefreshToken:  true,
            persistSession:    true,
            detectSessionInUrl: true,
            storageKey:        'ft_supabase_auth',
        },
        realtime: {
            params: { eventsPerSecond: 10 },
        },
        global: {
            headers: { 'x-application-name': 'ForTrader' },
        },
    });

    // Expose ke semua modul via window.DB
    window.DB = client;
    console.log('[ForTrader] Supabase client initialized ✅', SUPABASE_URL);
})();
