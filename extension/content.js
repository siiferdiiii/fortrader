/* ForTrader Extension — content.js v3 (micro toolbar) */
const FT_URL  = 'https://orbbjgjzaissjbovbcbc.supabase.co';
const FT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYmJqZ2p6YWlzc2pib3ZiY2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzA3NTMsImV4cCI6MjA5NDM0Njc1M30.ZTHyM5PMcFiOlL7Ji6d6Tcx9aC001S3PpA_D9FkKefM';

let DB = null, SESSION = null;
let STATE = { step: 'idle', session: null, tradingSession: null, rr: 2 };

/* ── Bootstrap ── */
chrome.storage.local.get(['ft_session', 'ft_active_session'], ({ ft_session, ft_active_session }) => {
  if (ft_session) { SESSION = ft_session; initDB(ft_session); }
  if (ft_active_session && ft_session) { STATE.session = ft_active_session; STATE.step = 'active'; }
  injectUI();
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'FT_SESSION_UPDATED') return;
  if (msg.session) { SESSION = msg.session; initDB(msg.session); if (STATE.step === 'idle') STATE.step = 'idle'; }
  else { DB = null; SESSION = null; STATE = { step: 'idle', session: null, tradingSession: null, rr: 2 }; }
  render();
});

function initDB(s) {
  DB = window.supabase.createClient(FT_URL, FT_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  DB.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token }).catch(() => {});
}

/* ── Shadow DOM setup ── */
let shadow, widgetRoot, fabBtn;

function injectUI() {
  if (document.getElementById('ft-host')) return;

  /* Shadow host */
  const host = document.createElement('div');
  host.id = 'ft-host';
  const sh = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  widgetRoot = document.createElement('div');
  widgetRoot.id = 'ft-wr';
  sh.appendChild(styleEl);
  sh.appendChild(widgetRoot);
  document.body.appendChild(host);
  shadow = sh;

  /* FAB — bottom right, small */
  fabBtn = document.createElement('button');
  fabBtn.id = 'ft-fab';
  fabBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
  Object.assign(fabBtn.style, {
    position:'fixed', bottom:'18px', right:'18px', zIndex:'2147483647',
    width:'38px', height:'38px', borderRadius:'50%', border:'none',
    background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
    boxShadow:'0 2px 12px rgba(99,102,241,.5)', color:'#fff',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
  });
  fabBtn.addEventListener('click', onFabClick);
  document.body.appendChild(fabBtn);

  render();
}

function onFabClick() {
  if (!SESSION) return;
  if (STATE.step === 'active') {
    const w = widgetRoot.querySelector('#ft-widget');
    if (w) { const hidden = w.style.display === 'none'; w.style.display = hidden ? '' : 'none'; return; }
  }
  if (STATE.step === 'idle') { STATE.step = 'setup'; render(); }
}

/* ── Render ── */
function render() {
  if (!widgetRoot) return;
  if (!SESSION || STATE.step === 'idle') { widgetRoot.innerHTML = ''; return; }
  if (STATE.step === 'setup') renderSetup();
  else renderMicroBar();
}

/* ── Setup Form (compact) ── */
async function renderSetup() {
  const [methods, sessions] = await Promise.all([fetchMethods(), fetchSessions()]);
  const mOpts = methods.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');

  // Build saved sessions list
  const sessList = sessions.length ? `
<div class="resume-section">
  <div class="resume-title">▶ Lanjutkan Sesi</div>
  ${sessions.slice(0, 4).map(s => {
    const wins  = (s.trades||[]).filter(t => t.type==='tp').length;
    const total = (s.trades||[]).length;
    const wr    = total > 0 ? Math.round(wins/total*100) : 0;
    const pnl   = (s.current_balance||0) - (s.initial_balance||0);
    const pnlColor = pnl >= 0 ? '#26a69a' : '#ef5350';
    return `<div class="resume-item" data-id="${s.id}">
      <div class="ri-left">
        <span class="ri-name">${esc(s.name)}</span>
        <span class="ri-meta">${esc(s.pair)} · ${total}T · WR ${wr}%</span>
      </div>
      <div class="ri-right">
        <span class="ri-pnl" style="color:${pnlColor}">${pnl>=0?'+':''}$${Math.abs(pnl).toFixed(0)}</span>
        <button class="btn-resume" data-id="${s.id}">▶</button>
      </div>
    </div>`;
  }).join('')}
</div>` : '';

  widgetRoot.innerHTML = `
<div id="ft-widget" class="card setup-card">
  <div class="s-head">
    <span class="s-icon">📊</span>
    <span class="s-title">Setup Sesi</span>
    <button class="icon-btn" id="ft-cancel">✕</button>
  </div>
  <div class="s-body">
    <input class="inp" id="s-name" placeholder="Nama sesi…">
    <div class="row2">
      <input class="inp" id="s-bal" type="number" value="10000" placeholder="Modal $">
      <div class="inp-pct"><input class="inp" id="s-risk" type="number" step="0.25" min="0.25" max="3" value="1"><span>%</span></div>
    </div>
    <input class="inp" id="s-pair" placeholder="Pair / Aset (XAUUSD…)">
    <select class="inp" id="s-method"><option value="">— Metode (opsional) —</option>${mOpts}</select>
    <button class="btn-go" id="ft-go">🚀 Mulai Baru</button>
  </div>
  ${sessList}
</div>`;

  widgetRoot.querySelector('#ft-go').addEventListener('click', startSession);
  widgetRoot.querySelector('#ft-cancel').addEventListener('click', () => { STATE.step = 'idle'; render(); });
  widgetRoot.querySelectorAll('.btn-resume').forEach(btn => {
    btn.addEventListener('click', () => resumeSession(btn.dataset.id, sessions));
  });
}

/* ── Micro Bar (execution) ── */
function renderMicroBar() {
  const s = STATE.session;
  const risk = s.currentBalance * (s.riskPct / 100);
  const tp   = (risk * STATE.rr).toFixed(0);
  const sl   = risk.toFixed(0);
  const sess = STATE.tradingSession;
  const sessBtns = [['asia','Asia'],['london','Lon'],['newyork','NY'],['','—']].map(([v,l]) =>
    `<button class="sc${sess===v?' sa':''}" data-v="${v}">${l}</button>`).join('');

  widgetRoot.innerHTML = `
<div id="ft-widget" class="card micro-card">
  <!-- Row 1: info + end -->
  <div class="m-head">
    <span class="m-name">${esc(s.name)}</span>
    <span class="m-pair">${esc(s.pair)}</span>
    <button class="icon-btn" id="ft-end" title="Akhiri">⏹</button>
    <button class="icon-btn" id="ft-sv" title="Simpan ke web">💾</button>
  </div>
  <!-- Row 2: RR + sessions -->
  <div class="m-ctrl">
    <span class="rr-lbl">R:R</span>
    <input class="rr-inp" id="rr-val" type="number" step="0.1" min="0.5" value="${STATE.rr}">
    <span class="rr-lbl">R</span>
    <div class="sess-grp">${sessBtns}</div>
  </div>
  <!-- Row 3: BUY / SELL -->
  <div class="m-act">
    <button id="ft-buy" class="btn-b">▲ BUY<small>+$${tp}</small></button>
    <button id="ft-sell" class="btn-s">▼ SELL<small>-$${sl}</small></button>
  </div>
  <div id="ft-flash" class="flash" style="display:none"></div>
</div>`;

  /* Events */
  widgetRoot.querySelector('#rr-val').addEventListener('input', e => {
    STATE.rr = parseFloat(e.target.value) || 2; renderMicroBar();
  });
  widgetRoot.querySelectorAll('.sc').forEach(b => {
    b.addEventListener('click', () => { STATE.tradingSession = b.dataset.v || null; renderMicroBar(); });
  });
  widgetRoot.querySelector('#ft-buy').addEventListener('click',  () => recordTrade('buy'));
  widgetRoot.querySelector('#ft-sell').addEventListener('click', () => recordTrade('sell'));
  widgetRoot.querySelector('#ft-end').addEventListener('click',  endSession);
  widgetRoot.querySelector('#ft-sv').addEventListener('click',   saveToSupabase);
}

/* ── Start Session ── */
async function startSession() {
  const name = widgetRoot.querySelector('#s-name').value.trim();
  const bal  = parseFloat(widgetRoot.querySelector('#s-bal').value) || 10000;
  const risk = parseFloat(widgetRoot.querySelector('#s-risk').value) || 1;
  const pair = widgetRoot.querySelector('#s-pair').value.trim() || 'XAUUSD';
  const mId  = widgetRoot.querySelector('#s-method').value;
  if (!name) { alert('Nama sesi wajib!'); return; }
  const methods = await fetchMethods();
  const mName   = methods.find(m => m.id === mId)?.name || '—';
  STATE.session = { id: 'ext_'+Date.now(), name, pair, methodId: mId, methodName: mName,
    initialBalance: bal, currentBalance: bal, riskPct: risk, trades: [],
    createdAt: new Date().toISOString(), source: 'extension' };
  STATE.step = 'active';
  chrome.storage.local.set({ ft_active_session: STATE.session });
  render();
}

/* ── Record Trade ── */
async function recordTrade(dir) {
  const s    = STATE.session;
  const risk = s.currentBalance * (s.riskPct / 100);
  const rr   = STATE.rr;
  const pnl  = dir === 'buy' ? risk * rr : -risk;
  const now  = new Date();
  s.trades.push({ id: 'tr_'+Date.now(), direction: dir, type: dir==='buy'?'tp':'sl',
    time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
    rr, pnl, session: STATE.tradingSession||null,
    balanceBefore: s.currentBalance, balanceAfter: s.currentBalance + pnl,
    timestamp: now.toISOString() });
  s.currentBalance += pnl;
  chrome.storage.local.set({ ft_active_session: s });
  flash(dir === 'buy' ? `✅ BUY +$${(risk*rr).toFixed(0)}` : `❌ SELL -$${risk.toFixed(0)}`,
        dir === 'buy' ? '#26a69a' : '#ef5350');
  /* Realtime upsert */
  if (DB && SESSION) DB.from('backtest_sessions').upsert(buildRow(s)).catch(()=>{});
  renderMicroBar();
}

/* ── End Session ── */
function endSession() {
  if (!confirm('Akhiri sesi?')) return;
  chrome.storage.local.remove('ft_active_session');
  STATE.session = null; STATE.step = 'idle'; render();
}

/* ── Save ── */
async function saveToSupabase() {
  if (!DB || !SESSION) return;
  const { error } = await DB.from('backtest_sessions').upsert(buildRow(STATE.session));
  if (!error) { flash('✅ Tersimpan!', '#26a69a');
    setTimeout(() => { chrome.storage.local.remove('ft_active_session'); STATE.session = null; STATE.step = 'idle'; render(); }, 1400); }
  else flash('❌ Gagal simpan', '#ef5350');
}

/* ── Helpers ── */
function buildRow(s) {
  return { id: s.id, user_id: SESSION.user.id, name: s.name, pair: s.pair,
    method_id: s.methodId || null, method_name: s.methodName,
    initial_balance: s.initialBalance, current_balance: s.currentBalance,
    risk_pct: s.riskPct, rr: STATE.rr, trades: s.trades,
    is_active: true, rr_mode: 'dynamic', source: 'extension' };
}
function flash(msg, color) {
  const el = widgetRoot?.querySelector('#ft-flash'); if (!el) return;
  el.textContent = msg; el.style.color = color; el.style.display = 'block';
  clearTimeout(STATE._ft); STATE._ft = setTimeout(() => { if(el) el.style.display='none'; }, 1800);
}
async function fetchMethods() {
  if (!DB || !SESSION) return [];
  try { const { data } = await DB.from('trading_methods').select('id,name').eq('user_id', SESSION.user.id); return data||[]; }
  catch { return []; }
}
async function fetchSessions() {
  if (!DB || !SESSION) return [];
  try {
    const { data } = await DB.from('backtest_sessions')
      .select('id,name,pair,method_name,initial_balance,current_balance,risk_pct,trades,rr,rr_mode,source,created_at')
      .eq('user_id', SESSION.user.id)
      .order('created_at', { ascending: false })
      .limit(8);
    return data || [];
  } catch { return []; }
}
function resumeSession(id, sessions) {
  const raw = sessions.find(s => s.id === id);
  if (!raw) return;
  STATE.session = {
    id: raw.id, name: raw.name, pair: raw.pair,
    methodId: raw.method_id || null, methodName: raw.method_name || '—',
    initialBalance: raw.initial_balance, currentBalance: raw.current_balance,
    riskPct: raw.risk_pct, rr: raw.rr || 2,
    trades: raw.trades || [],
    createdAt: raw.created_at, source: 'extension',
  };
  STATE.rr   = raw.rr || 2;
  STATE.step = 'active';
  chrome.storage.local.set({ ft_active_session: STATE.session });
  render();
}
function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

/* ── CSS ── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',sans-serif;}

#ft-wr{position:fixed;bottom:18px;left:14px;z-index:2147483646;}

/* Base card */
.card{
  background:rgba(8,11,20,0.78);
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid rgba(255,255,255,0.1);
  border-radius:14px;
  box-shadow:0 6px 28px rgba(0,0,0,0.4);
  color:#c9cdd8;overflow:hidden;
}

/* ─ Setup card ─ */
.setup-card{width:220px;}
.s-head{display:flex;align-items:center;gap:7px;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.07);}
.s-icon{font-size:13px;}
.s-title{font-size:12px;font-weight:700;color:#e0e3eb;flex:1;}
.s-body{padding:10px;display:flex;flex-direction:column;gap:7px;}
.inp{width:100%;padding:7px 8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);border-radius:7px;color:#e0e3eb;font-size:12px;outline:none;}
.inp:focus{border-color:#6366f1;}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.inp-pct{display:flex;align-items:center;gap:4px;}
.inp-pct span{color:#64748b;font-size:11px;flex-shrink:0;}
.inp-pct .inp{width:100%;}
.btn-go{width:100%;padding:9px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;}
.btn-go:hover{opacity:.9;}

/* ─ Resume sessions ─ */
.resume-section{border-top:1px solid rgba(255,255,255,.07);padding:8px 10px;}
.resume-title{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;}
.resume-item{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:5px;gap:6px;}
.resume-item:last-child{margin-bottom:0;}
.ri-left{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.ri-name{font-size:11px;font-weight:700;color:#e0e3eb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ri-meta{font-size:10px;color:#64748b;}
.ri-right{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.ri-pnl{font-size:11px;font-weight:700;}
.btn-resume{background:rgba(99,102,241,.25);border:1px solid rgba(99,102,241,.4);color:#a5b4fc;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:background .12s;flex-shrink:0;}
.btn-resume:hover{background:rgba(99,102,241,.45);color:#fff;}

/* ─ Micro bar ─ */
.micro-card{width:210px;transition:transform .3s ease .15s,box-shadow .3s ease .15s;transform-origin:bottom left;}
.micro-card:not(:hover){transform:scale(0.96);box-shadow:0 2px 10px rgba(0,0,0,.25);}
.micro-card:hover{transform:scale(1);box-shadow:0 8px 30px rgba(0,0,0,.45);transition:transform .18s ease 0s,box-shadow .18s ease 0s;}

/* AUTO-COLLAPSE: header & controls hidden when not hovered */
.m-head,.m-ctrl{
  overflow:hidden;
  max-height:0;opacity:0;
  transform:scaleY(0.6);transform-origin:bottom center;
  pointer-events:none;
  /* leave: slow + delay so cursor moving between elements doesn't flicker */
  transition:max-height .3s ease .2s,opacity .25s ease .15s,transform .28s ease .15s;
}
.micro-card:hover .m-head,
.micro-card:hover .m-ctrl{
  max-height:50px;opacity:1;
  transform:scaleY(1);
  pointer-events:auto;
  /* enter: fast, no delay */
  transition:max-height .22s ease 0s,opacity .18s ease 0s,transform .2s ease 0s;
}

.m-head{display:flex;align-items:center;gap:5px;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.06);}
.m-name{font-size:11px;font-weight:700;color:#e0e3eb;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;}
.m-pair{font-size:10px;color:#6366f1;font-weight:600;flex:1;}

.m-ctrl{display:flex;align-items:center;gap:5px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06);}
.rr-lbl{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;flex-shrink:0;}
.rr-inp{width:44px;padding:4px 6px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#e0e3eb;font-size:13px;font-weight:700;text-align:center;outline:none;}
.rr-inp:focus{border-color:#6366f1;}
.sess-grp{display:flex;gap:3px;margin-left:4px;}
.sc{padding:3px 6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:5px;color:#64748b;font-size:10px;font-weight:600;cursor:pointer;transition:all .12s;line-height:1;}
.sc.sa{background:rgba(99,102,241,.28);border-color:rgba(99,102,241,.5);color:#a5b4fc;}
.sc:hover:not(.sa){background:rgba(255,255,255,.1);color:#c9cdd8;}

/* BUY/SELL always visible */
.m-act{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:7px 8px;}
.btn-b,.btn-s{padding:10px 6px;border:none;border-radius:9px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;transition:transform .08s,opacity .12s;}
.btn-b{background:linear-gradient(135deg,rgba(38,166,154,.92),rgba(0,137,123,.92));box-shadow:0 2px 10px rgba(38,166,154,.3);}
.btn-s{background:linear-gradient(135deg,rgba(239,83,80,.92),rgba(198,40,40,.92));box-shadow:0 2px 10px rgba(239,83,80,.3);}
.btn-b:hover,.btn-s:hover{opacity:.88;}
.btn-b:active,.btn-s:active{transform:scale(.92);}
.btn-b,.btn-s{font-size:12px;font-weight:800;color:#fff;}
.btn-b small,.btn-s small{font-size:10px;font-weight:400;opacity:.85;display:block;}

.flash{text-align:center;font-size:11px;font-weight:600;padding:4px 8px 6px;animation:fi .2s ease;}
@keyframes fi{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}

.icon-btn{background:rgba(255,255,255,.07);border:none;color:#6b7280;width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s;}
.icon-btn:hover{background:rgba(255,255,255,.14);color:#e0e3eb;}
`;
