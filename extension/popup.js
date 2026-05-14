/* ======================================
   POPUP.JS — Login & Auth State
   ====================================== */

const SUPABASE_URL  = 'https://orbbjgjzaissjbovbcbc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYmJqZ2p6YWlzc2pib3ZiY2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzA3NTMsImV4cCI6MjA5NDM0Njc1M30.ZTHyM5PMcFiOlL7Ji6d6Tcx9aC001S3PpA_D9FkKefM';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false }
});

/* ── DOM ── */
const viewLogin    = document.getElementById('view-login');
const viewLoggedIn = document.getElementById('view-loggedin');
const emailInput   = document.getElementById('login-email');
const pwInput      = document.getElementById('login-password');
const btnLogin     = document.getElementById('btn-login');
const btnLogout    = document.getElementById('btn-logout');
const togglePw     = document.getElementById('toggle-pw');
const errorMsg     = document.getElementById('login-error');
const userNameEl   = document.getElementById('user-name');
const userEmailEl  = document.getElementById('user-email');
const userAvatarEl = document.getElementById('user-avatar');

/* ── Toggle password visibility ── */
togglePw.addEventListener('click', () => {
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    togglePw.textContent = pwInput.type === 'password' ? '👁' : '🙈';
});

/* ── Check existing session on load ── */
chrome.storage.local.get(['ft_session'], async ({ ft_session }) => {
    if (ft_session) {
        showLoggedIn(ft_session.user);
    }
});

/* ── Login ── */
btnLogin.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const pw    = pwInput.value;
    if (!email || !pw) { showError('Email dan password wajib diisi.'); return; }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Memproses...';
    hideError();

    const { data, error } = await db.auth.signInWithPassword({ email, password: pw });

    if (error) {
        showError(error.message === 'Invalid login credentials'
            ? 'Email atau password salah.' : error.message);
        btnLogin.disabled = false;
        btnLogin.textContent = 'Masuk';
        return;
    }

    // Simpan session ke chrome.storage.local
    const sessionData = {
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
            id:       data.user.id,
            email:    data.user.email,
            name:     data.user.user_metadata?.full_name || data.user.email.split('@')[0],
            plan:     data.user.user_metadata?.plan || 'free',
        },
    };
    await chrome.storage.local.set({ ft_session: sessionData });

    // Notify content scripts
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'FT_SESSION_UPDATED', session: sessionData })
                .catch(() => {}); // ignore if content script not running
        }
    });

    showLoggedIn(sessionData.user);
});

/* ── Logout ── */
btnLogout.addEventListener('click', async () => {
    await chrome.storage.local.remove('ft_session');
    await db.auth.signOut();

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'FT_SESSION_UPDATED', session: null })
                .catch(() => {});
        }
    });

    viewLoggedIn.style.display = 'none';
    viewLogin.style.display = 'block';
    emailInput.value = '';
    pwInput.value = '';
    btnLogin.disabled = false;
    btnLogin.textContent = 'Masuk';
});

/* ── Helpers ── */
function showLoggedIn(user) {
    viewLogin.style.display = 'none';
    viewLoggedIn.style.display = 'block';
    userNameEl.textContent    = user.name || user.email;
    userEmailEl.textContent   = user.email;
    userAvatarEl.textContent  = (user.name || user.email)[0].toUpperCase();
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
}
function hideError() { errorMsg.style.display = 'none'; }
