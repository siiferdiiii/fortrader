/* ForTrader Backtest Extension — content.js */
const FT_URL  = 'https://orbbjgjzaissjbovbcbc.supabase.co';
const FT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yYmJqZ2p6YWlzc2pib3ZiY2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzA3NTMsImV4cCI6MjA5NDM0Njc1M30.ZTHyM5PMcFiOlL7Ji6d6Tcx9aC001S3PpA_D9FkKefM';

let DB = null, SESSION = null, STATE = { step: 'setup', session: null };

/* ── Init ── */
chrome.storage.local.get(['ft_session'], ({ ft_session }) => {
  if (ft_session) initWithSession(ft_session);
  else injectTriggerBtn(false);
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'FT_SESSION_UPDATED') return;
  if (msg.session) initWithSession(msg.session);
  else { SESSION = null; DB = null; STATE = { step: 'setup', session: null }; renderPanel(); }
});

function initWithSession(s) {
  SESSION = s;
  DB = window.supabase.createClient(FT_URL, FT_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  DB.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token }).catch(() => {});
  injectPanel();
}

/* ── Trigger button ── */
function injectTriggerBtn(loggedIn) {
  if (document.getElementById('ft-trigger')) return;
  const btn = document.createElement('button');
  btn.id = 'ft-trigger';
  btn.title = loggedIn ? 'ForTrader Backtest' : 'ForTrader — Login dulu';
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>';
  Object.assign(btn.style, {
    position:'fixed', bottom:'80px', right:'16px', zIndex:'2147483647',
    width:'46px', height:'46px', borderRadius:'50%', border:'none', cursor:'pointer',
    background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
    boxShadow:'0 4px 18px rgba(99,102,241,.5)', color:'#fff',
    display:'flex', alignItems:'center', justifyContent:'center',
  });
  btn.addEventListener('click', () => {
    const panel = document.getElementById('ft-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });
  document.body.appendChild(btn);
}

/* ── Panel injection ── */
function injectPanel() {
  if (!document.getElementById('ft-panel')) {
    const host = document.createElement('div');
    host.id = 'ft-panel-host';
    const shadow = host.attachShadow({ mode: 'open' });
    const panel = document.createElement('div');
    panel.id = 'ft-panel';
    const style = document.createElement('style');
    style.textContent = getPanelCSS();
    shadow.appendChild(style);
    shadow.appendChild(panel);
    document.body.appendChild(host);
    STATE._shadow = shadow;
    STATE._panel  = panel;
  }
  injectTriggerBtn(true);
  renderPanel();
}

function getPanel() { return STATE._panel; }

/* ── Render router ── */
function renderPanel() {
  const p = getPanel(); if (!p) return;
  if (!SESSION) { p.innerHTML = '<div class="empty">Login via ikon ForTrader di toolbar.</div>'; return; }
  if (STATE.step === 'setup') renderSetup();
  else renderExecution();
}

/* ── Setup Form ── */
async function renderSetup() {
  const p = getPanel();
  const methods = await fetchMethods();
  const methodOpts = methods.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  p.innerHTML = `
<div class="header"><span class="logo">📊</span><span class="title">ForTrader Backtest</span><span class="user">${SESSION.user.name||'User'}</span></div>
<div class="body">
  <div class="form-row"><label>Nama Sesi</label><input id="ft-name" placeholder="Contoh: ICT OB H4 Gold"></div>
  <div class="form-row"><label>Modal Awal ($)</label><input id="ft-bal" type="number" value="10000"></div>
  <div class="form-2col">
    <div class="form-row"><label>Risk/Trade</label>
      <div class="input-suffix"><input id="ft-risk" type="number" step="0.25" min="0.25" max="3" value="1"><span>%</span></div>
    </div>
    <div class="form-row"><label>Pair / Aset</label><input id="ft-pair" placeholder="XAUUSD"></div>
  </div>
  <div class="form-row"><label>Metode Teknikal</label>
    <select id="ft-method"><option value="">— Pilih Metode —</option>${methodOpts}</select>
  </div>
  <div class="form-row"><label>Risk:Reward</label>
    <div class="rr-toggle">
      <label><input type="radio" name="ft-rrmode" value="fixed" checked> Fix</label>
      <label><input type="radio" name="ft-rrmode" value="dynamic"> Dinamis</label>
    </div>
  </div>
  <div class="form-row" id="ft-rr-row"><label>Nilai R:R</label><input id="ft-rr" type="number" step="0.1" min="0.5" value="2"></div>
  <div class="form-row"><label>Sesi Trading (opsional)</label>
    <div class="session-checks">
      <label><input type="checkbox" value="asia"> Asia</label>
      <label><input type="checkbox" value="london"> London</label>
      <label><input type="checkbox" value="newyork"> New York</label>
    </div>
  </div>
  <button id="ft-start" class="btn-primary">🚀 Mulai Sesi Backtest</button>
</div>`;

  getPanel().querySelectorAll('[name=ft-rrmode]').forEach(r => {
    r.addEventListener('change', () => {
      const row = getPanel().querySelector('#ft-rr-row');
      row.style.display = r.value === 'fixed' ? '' : 'none';
    });
  });

  getPanel().querySelector('#ft-start').addEventListener('click', startSession);
}

/* ── Start Session ── */
async function startSession() {
  const p = getPanel();
  const name    = p.querySelector('#ft-name').value.trim();
  const balance = parseFloat(p.querySelector('#ft-bal').value) || 10000;
  const risk    = parseFloat(p.querySelector('#ft-risk').value) || 1;
  const pair    = p.querySelector('#ft-pair').value.trim() || 'XAUUSD';
  const methodId= p.querySelector('#ft-method').value;
  const rrMode  = p.querySelector('[name=ft-rrmode]:checked').value;
  const rr      = rrMode === 'fixed' ? (parseFloat(p.querySelector('#ft-rr').value) || 2) : null;
  const sessions= [...p.querySelectorAll('.session-checks input:checked')].map(c => c.value);
  const methods = await fetchMethods();
  const method  = methods.find(m => m.id === methodId);

  if (!name) { alert('Nama sesi wajib diisi!'); return; }

  const id = 'ext_' + Date.now();
  STATE.session = {
    id, name, pair, balance, riskPct: risk, rr, rrMode,
    sessions, methodId, methodName: method?.name || '—',
    trades: [], currentBalance: balance, initialBalance: balance,
    createdAt: new Date().toISOString(), source: 'extension',
  };

  STATE.step = 'execution';
  renderPanel();
}

/* ── Execution Panel ── */
function renderExecution() {
  const p = getPanel();
  const s = STATE.session;
  const pnl = s.currentBalance - s.initialBalance;
  const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
  const pnlColor = pnl >= 0 ? '#26a69a' : '#ef5350';
  const wins  = s.trades.filter(t => t.type === 'tp').length;
  const total = s.trades.length;
  const wr    = total > 0 ? ((wins/total)*100).toFixed(1) : '—';
  const risk  = s.currentBalance * (s.riskPct/100);
  const rrVal = s.rr || 2;
  const isDynamic = s.rrMode === 'dynamic';

  const sessionBadges = s.sessions?.length
    ? s.sessions.map(ss => `<span class="badge">${ss}</span>`).join('') : '';

  const tradeLog = s.trades.length ? [...s.trades].reverse().slice(0, 8).map((t, i) => `
<div class="log-item log-${t.type}">
  <span class="log-badge">${t.type === 'tp' ? '✅ TP' : '❌ SL'}</span>
  <span class="log-time">${t.time||'—'}</span>
  <span class="log-rr" style="color:#6366f1">1:${t.rr||rrVal}</span>
  <span class="log-pnl" style="color:${t.type==='tp'?'#26a69a':'#ef5350'}">${t.pnl>=0?'+':''}$${Math.abs(t.pnl).toFixed(2)}</span>
</div>`).join('') : '<div class="log-empty">Klik TP atau SL untuk mulai.</div>';

  p.innerHTML = `
<div class="header">
  <span class="logo">📊</span>
  <div><div class="title">${esc(s.name)}</div><div class="sub">${esc(s.pair)} · ${esc(s.methodName)} ${sessionBadges}</div></div>
  <button class="btn-icon" id="ft-end" title="Akhiri sesi">⏹</button>
</div>
<div class="body">
  <div class="balance-card">
    <div class="balance-label">Saldo Saat Ini</div>
    <div class="balance-val">$${s.currentBalance.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
    <div class="balance-pnl" style="color:${pnlColor}">${pnlStr}</div>
  </div>
  <div class="info-row">
    <div class="info-item"><div class="info-label">Risk</div><div class="info-val">$${risk.toFixed(2)}</div></div>
    <div class="info-item"><div class="info-label">Win Rate</div><div class="info-val">${wr}%</div></div>
    <div class="info-item"><div class="info-label">Trades</div><div class="info-val">${total}</div></div>
  </div>
  ${isDynamic ? `
  <div class="form-row"><label>R:R untuk TP ini</label>
    <div class="input-suffix"><input id="ft-dyn-rr" type="number" step="0.1" min="0.5" value="${rrVal}" style="font-size:15px;font-weight:700"><span>R</span></div>
  </div>` : `<div class="rr-display">Risk:Reward — 1:${rrVal} <span style="color:#26a69a">+$${(risk*rrVal).toFixed(2)}</span></div>`}
  <div class="btn-pair">
    <button id="ft-tp" class="btn-tp">✅ TP<br><small>+$${(risk*(isDynamic?rrVal:rrVal)).toFixed(2)}</small></button>
    <button id="ft-sl" class="btn-sl">❌ SL<br><small>-$${risk.toFixed(2)}</small></button>
  </div>
  <div class="trade-log">${tradeLog}</div>
  <button id="ft-save-web" class="btn-secondary">💾 Simpan & Lihat di Web</button>
</div>`;

  /* events */
  p.querySelector('#ft-tp').addEventListener('click', () => execTrade('tp'));
  p.querySelector('#ft-sl').addEventListener('click', () => execTrade('sl'));
  p.querySelector('#ft-end').addEventListener('click', endSession);
  p.querySelector('#ft-save-web').addEventListener('click', saveToSupabase);
  if (isDynamic) {
    p.querySelector('#ft-dyn-rr').addEventListener('input', e => { STATE.session.rr = parseFloat(e.target.value)||2; });
  }
}

/* ── Execute Trade ── */
function execTrade(type) {
  const s = STATE.session;
  const risk = s.currentBalance * (s.riskPct / 100);
  const rr   = s.rr || 2;
  const pnl  = type === 'tp' ? risk * rr : -risk;
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  s.trades.push({ id: 'tr_'+Date.now(), type, time, rr, pnl, balanceBefore: s.currentBalance, balanceAfter: s.currentBalance + pnl, timestamp: now.toISOString() });
  s.currentBalance += pnl;
  chrome.storage.local.set({ ft_active_session: s });
  renderPanel();
}

/* ── End Session ── */
function endSession() {
  if (!confirm('Akhiri sesi ini? Data bisa disimpan ke web setelah ini.')) return;
  STATE.step = 'setup';
  STATE.session = null;
  chrome.storage.local.remove('ft_active_session');
  renderPanel();
}

/* ── Save to Supabase ── */
async function saveToSupabase() {
  if (!DB || !SESSION) return;
  const s = STATE.session;
  const btn = getPanel().querySelector('#ft-save-web');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  const row = {
    id: s.id, user_id: SESSION.user.id,
    name: s.name, pair: s.pair,
    method_id: s.methodId || null, method_name: s.methodName,
    initial_balance: s.initialBalance, current_balance: s.currentBalance,
    risk_pct: s.riskPct, rr: s.rr || 2,
    trades: s.trades, is_active: false,
    rr_mode: s.rrMode, source: 'extension',
  };

  const { error } = await DB.from('backtest_sessions').upsert(row);
  if (error) { btn.disabled = false; btn.textContent = '❌ Gagal — Coba Lagi'; return; }

  btn.textContent = '✅ Tersimpan!';
  setTimeout(() => {
    STATE.step = 'setup'; STATE.session = null;
    chrome.storage.local.remove('ft_active_session');
    renderPanel();
  }, 1500);
}

/* ── Fetch Methods from Supabase ── */
async function fetchMethods() {
  if (!DB || !SESSION) return [];
  try {
    const { data } = await DB.from('trading_methods').select('id,name').eq('user_id', SESSION.user.id).order('created_at');
    return data || [];
  } catch { return []; }
}

/* ── Restore active session on page load ── */
chrome.storage.local.get(['ft_active_session'], ({ ft_active_session }) => {
  if (ft_active_session && SESSION) {
    STATE.session = ft_active_session;
    STATE.step = 'execution';
  }
});

function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

/* ── Panel CSS ── */
function getPanelCSS() {
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',sans-serif;}
#ft-panel{
  position:fixed;top:60px;right:0;width:320px;height:calc(100vh - 70px);
  background:linear-gradient(180deg,#0f1117 0%,#131722 100%);
  border-left:1px solid rgba(255,255,255,.1);
  display:flex;flex-direction:column;z-index:2147483646;
  box-shadow:-4px 0 24px rgba(0,0,0,.5);color:#d1d4dc;
  border-radius:12px 0 0 12px;overflow:hidden;
}
.header{display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;}
.logo{font-size:18px;}
.title{font-size:13px;font-weight:700;color:#e0e3eb;}
.sub{font-size:10px;color:#64748b;margin-top:2px;}
.user{margin-left:auto;font-size:11px;color:#6366f1;font-weight:600;}
.btn-icon{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:4px;margin-left:auto;border-radius:6px;transition:background .15s;}
.btn-icon:hover{background:rgba(255,255,255,.08);}
.body{flex:1;overflow-y:auto;padding:14px;}
.form-row{margin-bottom:10px;}
.form-row label{display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;}
.form-2col{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
input,select{width:100%;padding:8px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#e0e3eb;font-size:13px;outline:none;}
input:focus,select:focus{border-color:#6366f1;}
.input-suffix{display:flex;align-items:center;gap:6px;}
.input-suffix span{color:#64748b;font-size:13px;white-space:nowrap;}
.rr-toggle{display:flex;gap:14px;}
.rr-toggle label{display:flex;align-items:center;gap:5px;font-size:12px;color:#d1d4dc;cursor:pointer;}
.session-checks{display:flex;gap:12px;}
.session-checks label{display:flex;align-items:center;gap:5px;font-size:12px;color:#d1d4dc;cursor:pointer;}
.btn-primary{width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:9px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px;transition:opacity .15s;}
.btn-primary:hover{opacity:.9;}
.btn-secondary{width:100%;padding:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#94a3b8;font-size:12px;font-weight:600;cursor:pointer;margin-top:8px;transition:background .15s;}
.btn-secondary:hover{background:rgba(255,255,255,.1);}
.btn-secondary:disabled{opacity:.5;cursor:not-allowed;}
.balance-card{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);border-radius:10px;padding:14px;text-align:center;margin-bottom:10px;}
.balance-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;}
.balance-val{font-size:22px;font-weight:800;color:#e0e3eb;margin:4px 0;}
.balance-pnl{font-size:13px;font-weight:600;}
.info-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;}
.info-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:8px;text-align:center;}
.info-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;}
.info-val{font-size:14px;font-weight:700;color:#e0e3eb;margin-top:3px;}
.rr-display{text-align:center;font-size:13px;color:#94a3b8;padding:8px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:10px;}
.btn-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
.btn-tp,.btn-sl{padding:16px 10px;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;text-align:center;line-height:1.4;transition:transform .1s,opacity .15s;}
.btn-tp{background:linear-gradient(135deg,#26a69a,#00897b);color:#fff;box-shadow:0 4px 14px rgba(38,166,154,.3);}
.btn-sl{background:linear-gradient(135deg,#ef5350,#c62828);color:#fff;box-shadow:0 4px 14px rgba(239,83,80,.3);}
.btn-tp:hover,.btn-sl:hover{opacity:.9;}
.btn-tp:active,.btn-sl:active{transform:scale(.95);}
.btn-tp small,.btn-sl small{font-size:11px;font-weight:400;opacity:.85;}
.trade-log{max-height:200px;overflow-y:auto;border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:6px;}
.log-item{display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px solid rgba(255,255,255,.05);font-size:11px;}
.log-item:last-child{border-bottom:none;}
.log-badge{font-size:10px;font-weight:700;white-space:nowrap;}
.log-time{color:#64748b;min-width:36px;}
.log-rr{min-width:28px;}
.log-pnl{margin-left:auto;font-weight:600;}
.log-empty{color:#64748b;font-size:12px;text-align:center;padding:12px 0;}
.badge{background:rgba(99,102,241,.2);color:#818cf8;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:600;margin-left:4px;}
.empty{color:#64748b;font-size:13px;text-align:center;padding:40px 20px;line-height:1.6;}
`;
}
