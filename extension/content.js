/* ForTrader Backtest Extension — content.js v2 (minimal floating widget) */
const FT_URL  = 'https://orbbjgjzaissjbovbcbc.supabase.co';
const FT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYmJqZ2p6YWlzc2pib3ZiY2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzA3NTMsImV4cCI6MjA5NDM0Njc1M30.ZTHyM5PMcFiOlL7Ji6d6Tcx9aC001S3PpA_D9FkKefM';

let DB = null, SESSION = null;
let STATE = { step: 'idle', session: null }; // idle | setup | active

/* ── Bootstrap ── */
chrome.storage.local.get(['ft_session', 'ft_active_session'], ({ ft_session, ft_active_session }) => {
  if (ft_session) {
    initDB(ft_session);
    SESSION = ft_session;
    if (ft_active_session) { STATE.session = ft_active_session; STATE.step = 'active'; }
  }
  injectUI();
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'FT_SESSION_UPDATED') return;
  if (msg.session) { initDB(msg.session); SESSION = msg.session; }
  else { DB = null; SESSION = null; STATE = { step: 'idle', session: null }; }
  render();
});

function initDB(s) {
  DB = window.supabase.createClient(FT_URL, FT_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  DB.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token }).catch(() => {});
}

/* ── Inject Shadow DOM ── */
function injectUI() {
  if (document.getElementById('ft-ext-host')) return;
  const host = document.createElement('div');
  host.id = 'ft-ext-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  const root = document.createElement('div');
  root.id = 'ft-root';
  shadow.appendChild(styleEl);
  shadow.appendChild(root);
  document.body.appendChild(host);
  STATE._root = root;

  /* Trigger FAB (bottom-right) */
  const fab = document.createElement('button');
  fab.id = 'ft-fab';
  fab.title = 'ForTrader';
  fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>';
  Object.assign(fab.style, {
    position:'fixed', bottom:'24px', right:'24px', zIndex:'2147483647',
    width:'50px', height:'50px', borderRadius:'50%', border:'none', cursor:'pointer',
    background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
    boxShadow:'0 4px 20px rgba(99,102,241,.55)', color:'#fff',
    display:'flex', alignItems:'center', justifyContent:'center',
  });
  fab.addEventListener('click', togglePanel);
  document.body.appendChild(fab);

  render();
}

function togglePanel() {
  const p = STATE._root;
  if (!p) return;
  const w = p.querySelector('#ft-widget');
  if (!w) { if (SESSION) { STATE.step = STATE.step === 'idle' ? 'setup' : STATE.step; } render(); return; }
  w.style.display = w.style.display === 'none' ? '' : 'none';
}

/* ── Render router ── */
function render() {
  const root = STATE._root; if (!root) return;
  if (!SESSION) { root.innerHTML = ''; return; }
  if (STATE.step === 'setup') renderSetup();
  else if (STATE.step === 'active') renderActive();
  else root.innerHTML = '';
}

/* ── Setup Form ── */
async function renderSetup() {
  const root = STATE._root;
  const methods = await fetchMethods();
  const mOpts = methods.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  root.innerHTML = `
<div id="ft-widget" class="widget setup-widget">
  <div class="w-header">
    <div class="w-logo">📊</div>
    <div class="w-title">Setup Sesi Backtest</div>
    <button class="w-close" id="ft-close-setup">✕</button>
  </div>
  <div class="w-body">
    <div class="frow"><label>Nama Sesi</label><input id="s-name" placeholder="ICT OB XAUUSD H4"></div>
    <div class="f2col">
      <div class="frow"><label>Modal ($)</label><input id="s-bal" type="number" value="10000"></div>
      <div class="frow"><label>Risk %</label>
        <div class="fx"><input id="s-risk" type="number" step="0.25" min="0.25" max="3" value="1"><span>%</span></div>
      </div>
    </div>
    <div class="frow"><label>Pair / Aset</label><input id="s-pair" placeholder="XAUUSD, EURUSD, ..."></div>
    <div class="frow"><label>Metode Teknikal</label>
      <select id="s-method"><option value="">— Pilih (opsional) —</option>${mOpts}</select>
    </div>
    <button class="btn-start" id="ft-start">🚀 Mulai</button>
  </div>
</div>`;
  root.querySelector('#ft-start').addEventListener('click', startSession);
  root.querySelector('#ft-close-setup').addEventListener('click', () => { STATE.step = 'idle'; render(); });
}

/* ── Start Session ── */
async function startSession() {
  const root = STATE._root;
  const name   = root.querySelector('#s-name').value.trim();
  const bal    = parseFloat(root.querySelector('#s-bal').value) || 10000;
  const risk   = parseFloat(root.querySelector('#s-risk').value) || 1;
  const pair   = root.querySelector('#s-pair').value.trim() || 'XAUUSD';
  const mId    = root.querySelector('#s-method').value;
  const methods = await fetchMethods();
  const mName  = methods.find(m => m.id === mId)?.name || '—';
  if (!name) { alert('Isi nama sesi dulu!'); return; }

  STATE.session = {
    id: 'ext_' + Date.now(), name, pair, methodId: mId, methodName: mName,
    initialBalance: bal, currentBalance: bal, riskPct: risk,
    trades: [], createdAt: new Date().toISOString(), source: 'extension',
  };
  STATE.step = 'active';
  chrome.storage.local.set({ ft_active_session: STATE.session });
  render();
}

/* ── Active Widget ── */
function renderActive() {
  const root = STATE._root;
  const s = STATE.session;

  root.innerHTML = `
<div id="ft-widget" class="widget active-widget">
  <!-- Header -->
  <div class="w-header">
    <div class="w-logo">📊</div>
    <div>
      <div class="w-title">${esc(s.name)}</div>
      <div class="w-sub">${esc(s.pair)} · ${esc(s.methodName)}</div>
    </div>
    <button class="w-end" id="ft-end" title="Akhiri sesi">⏹</button>
  </div>

  <!-- RR Dinamis -->
  <div class="rr-row">
    <label class="rr-label">R : R</label>
    <input id="ft-rr" class="rr-input" type="number" step="0.1" min="0.5" value="2" placeholder="2.0">
    <span class="rr-unit">R</span>
  </div>

  <!-- Sesi Selector -->
  <div class="sess-row">
    <button class="sess-chip ${STATE._activeSession === 'asia'    ? 'active' : ''}" data-sess="asia">Asia</button>
    <button class="sess-chip ${STATE._activeSession === 'london'  ? 'active' : ''}" data-sess="london">London</button>
    <button class="sess-chip ${STATE._activeSession === 'newyork' ? 'active' : ''}" data-sess="newyork">New York</button>
    <button class="sess-chip ${!STATE._activeSession ? 'active' : ''}" data-sess="">—</button>
  </div>

  <!-- BUY / SELL -->
  <div class="action-row">
    <button id="ft-buy"  class="btn-buy">
      <span class="btn-dir">▲ BUY</span>
      <span class="btn-sub">TP +$${calcTP(s).toFixed(2)}</span>
    </button>
    <button id="ft-sell" class="btn-sell">
      <span class="btn-dir">▼ SELL</span>
      <span class="btn-sub">SL -$${calcRisk(s).toFixed(2)}</span>
    </button>
  </div>

  <div class="save-row">
    <button id="ft-save" class="btn-save">💾 Simpan ke Web</button>
  </div>

  <div id="ft-flash" class="flash-msg" style="display:none;"></div>
</div>`;

  /* Session chip events */
  root.querySelectorAll('.sess-chip').forEach(c => {
    c.addEventListener('click', () => { STATE._activeSession = c.dataset.sess || null; render(); });
  });

  /* RR live update TP preview */
  root.querySelector('#ft-rr').addEventListener('input', () => {
    const r = parseFloat(root.querySelector('#ft-rr').value) || 2;
    root.querySelector('#ft-buy .btn-sub').textContent = `TP +$${(calcRisk(s)*r).toFixed(2)}`;
  });

  root.querySelector('#ft-buy').addEventListener('click',  () => recordTrade('buy'));
  root.querySelector('#ft-sell').addEventListener('click', () => recordTrade('sell'));
  root.querySelector('#ft-end').addEventListener('click',  endSession);
  root.querySelector('#ft-save').addEventListener('click', saveToSupabase);
}

/* ── Record Trade (real-time save) ── */
async function recordTrade(dir) {
  const s    = STATE.session;
  const root = STATE._root;
  const rr   = parseFloat(root?.querySelector('#ft-rr')?.value) || 2;
  const risk = calcRisk(s);
  const pnl  = dir === 'buy' ? risk * rr : -risk;
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const trade = {
    id: 'tr_' + Date.now(), direction: dir, type: dir === 'buy' ? 'tp' : 'sl',
    time, rr, pnl, session: STATE._activeSession || null,
    balanceBefore: s.currentBalance, balanceAfter: s.currentBalance + pnl,
    timestamp: now.toISOString(),
  };

  s.trades.push(trade);
  s.currentBalance += pnl;

  /* Save to chrome.storage */
  chrome.storage.local.set({ ft_active_session: s });

  /* Save to Supabase real-time */
  if (DB && SESSION) {
    const row = buildRow(s);
    DB.from('backtest_sessions').upsert(row).then(({ error }) => {
      if (!error) flashMsg(dir === 'buy' ? '✅ BUY saved' : '❌ SELL saved', dir === 'buy' ? '#26a69a' : '#ef5350');
    });
  }

  render();
}

/* ── End Session ── */
function endSession() {
  if (!confirm('Akhiri sesi ini?')) return;
  chrome.storage.local.remove('ft_active_session');
  STATE.session = null; STATE.step = 'idle';
  render();
}

/* ── Save to Supabase ── */
async function saveToSupabase() {
  if (!DB || !SESSION) return;
  const btn = STATE._root?.querySelector('#ft-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
  const { error } = await DB.from('backtest_sessions').upsert(buildRow(STATE.session));
  if (error) { if (btn) { btn.disabled = false; btn.textContent = '❌ Gagal, coba lagi'; } return; }
  flashMsg('✅ Tersimpan di ForTrader!', '#26a69a');
  setTimeout(() => { chrome.storage.local.remove('ft_active_session'); STATE.session = null; STATE.step = 'idle'; render(); }, 1600);
}

/* ── Helpers ── */
function calcRisk(s) { return s.currentBalance * (s.riskPct / 100); }
function calcTP(s)   {
  const root = STATE._root;
  const rr = parseFloat(root?.querySelector('#ft-rr')?.value) || 2;
  return calcRisk(s) * rr;
}
function buildRow(s) {
  return {
    id: s.id, user_id: SESSION.user.id, name: s.name, pair: s.pair,
    method_id: s.methodId || null, method_name: s.methodName,
    initial_balance: s.initialBalance, current_balance: s.currentBalance,
    risk_pct: s.riskPct, rr: 2, trades: s.trades,
    is_active: true, rr_mode: 'dynamic', source: 'extension',
  };
}
function flashMsg(msg, color) {
  const el = STATE._root?.querySelector('#ft-flash');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.style.display = 'block';
  setTimeout(() => { if (el) el.style.display = 'none'; }, 2000);
}
async function fetchMethods() {
  if (!DB || !SESSION) return [];
  try { const { data } = await DB.from('trading_methods').select('id,name').eq('user_id', SESSION.user.id).order('created_at'); return data || []; }
  catch { return []; }
}
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

/* ── CSS ── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
#ft-root{position:fixed;bottom:24px;left:20px;z-index:2147483646;font-family:'Inter',sans-serif;}

.widget{
  background:rgba(10,13,22,0.72);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid rgba(255,255,255,0.12);
  border-radius:18px;
  box-shadow:0 8px 40px rgba(0,0,0,0.45);
  color:#d1d4dc;overflow:hidden;width:300px;
}

/* setup */
.setup-widget .w-body{padding:14px;}
.frow{margin-bottom:10px;}
.frow label{display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;}
.f2col{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.fx{display:flex;align-items:center;gap:6px;}
.fx span{color:#64748b;font-size:12px;}
input,select{width:100%;padding:8px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e0e3eb;font-size:13px;outline:none;font-family:'Inter',sans-serif;}
input:focus,select:focus{border-color:#6366f1;}
.btn-start{width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px;font-family:'Inter',sans-serif;}
.btn-start:hover{opacity:.9;}

/* header */
.w-header{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid rgba(255,255,255,0.08);}
.w-logo{font-size:16px;flex-shrink:0;}
.w-title{font-size:13px;font-weight:700;color:#e0e3eb;line-height:1.2;}
.w-sub{font-size:10px;color:#64748b;margin-top:1px;}
.w-close,.w-end{margin-left:auto;background:rgba(255,255,255,.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0;}
.w-close:hover,.w-end:hover{background:rgba(255,255,255,.15);color:#e0e3eb;}

/* active widget */
.active-widget{}

/* RR row */
.rr-row{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06);}
.rr-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;}
.rr-input{flex:1;padding:7px 10px;font-size:15px;font-weight:700;color:#e0e3eb;text-align:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:8px;width:auto;}
.rr-unit{font-size:12px;color:#6366f1;font-weight:700;}

/* session chips */
.sess-row{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;}
.sess-chip{padding:5px 11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:#94a3b8;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s;}
.sess-chip.active{background:rgba(99,102,241,.25);border-color:rgba(99,102,241,.5);color:#818cf8;}
.sess-chip:hover:not(.active){background:rgba(255,255,255,.1);color:#d1d4dc;}

/* buy/sell */
.action-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 14px;}
.btn-buy,.btn-sell{padding:14px 10px;border:none;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;font-family:'Inter',sans-serif;transition:transform .1s,opacity .15s;}
.btn-buy{background:linear-gradient(135deg,rgba(38,166,154,0.9),rgba(0,137,123,0.9));box-shadow:0 4px 18px rgba(38,166,154,.3);}
.btn-sell{background:linear-gradient(135deg,rgba(239,83,80,0.9),rgba(198,40,40,0.9));box-shadow:0 4px 18px rgba(239,83,80,.3);}
.btn-buy:hover,.btn-sell:hover{opacity:.88;}
.btn-buy:active,.btn-sell:active{transform:scale(.94);}
.btn-dir{font-size:15px;font-weight:800;color:#fff;letter-spacing:.02em;}
.btn-sub{font-size:11px;color:rgba(255,255,255,.8);font-weight:500;}

/* save */
.save-row{padding:0 14px 12px;}
.btn-save{width:100%;padding:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#94a3b8;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:background .15s;}
.btn-save:hover{background:rgba(255,255,255,.1);}
.btn-save:disabled{opacity:.5;cursor:not-allowed;}

/* flash */
.flash-msg{text-align:center;font-size:12px;font-weight:600;padding:6px 14px 10px;animation:fadeIn .2s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
`;
