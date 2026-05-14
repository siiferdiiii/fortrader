/* ======================================
   BACKGROUND.JS — Service Worker
   Handles token refresh for long sessions
   ====================================== */

const SUPABASE_URL  = 'https://orbbjgjzaissjbovbcbc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYmJqZ2p6YWlzc2pib3ZiY2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzA3NTMsImV4cCI6MjA5NDM0Njc1M30.ZTHyM5PMcFiOlL7Ji6d6Tcx9aC001S3PpA_D9FkKefM';

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'FT_GET_SESSION') {
        chrome.storage.local.get(['ft_session'], ({ ft_session }) => {
            sendResponse({ session: ft_session || null });
        });
        return true; // async response
    }

    if (msg.type === 'FT_REFRESH_TOKEN') {
        refreshSession(msg.refresh_token).then(data => sendResponse(data));
        return true;
    }
});

async function refreshSession(refreshToken) {
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const data = await res.json();
        if (data.access_token) {
            const current = await new Promise(r => chrome.storage.local.get('ft_session', r));
            const updated = {
                ...current.ft_session,
                access_token:  data.access_token,
                refresh_token: data.refresh_token,
            };
            await chrome.storage.local.set({ ft_session: updated });
            return { success: true, session: updated };
        }
        return { success: false };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
