// ═══════════════════════════════════════════════════════════
//  Quantario  —  app.js  v3.0
//  Features: Dashboard, Trades, Analytics (equity curve,
//  day-of-week, session), Calendar, Structured Journal,
//  Rules Engine, Onboarding, Goals, Quick-Add, Brokers,
//  Import, Profile, AI, Weekly Email Summary
// ═══════════════════════════════════════════════════════════

// ── XSS GUARD ─────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── TINY HELPERS ──────────────────────────────────────────
const $pnl  = (n, sign=false) => `${sign&&n>=0?'+':''}$${Math.abs(Number(n)).toFixed(2)}`;
const $pct  = n => `${Number(n).toFixed(1)}%`;
const $date = () => new Date().toISOString().split('T')[0];
const $dt   = dt => dt ? new Date(dt).toISOString().slice(0,16) : '';

// ── STATE ─────────────────────────────────────────────────
let S = {
  view: 'dashboard',
  trades: [], journal: [], brokers: [],
  loading: true, syncing: false,
  filterAsset: 'all', filterDir: 'all',
  calDate: new Date(),
  tradeModal: false, selectedTrade: null, editTrade: null,
  profileModal: false, upgradeModal: false, quickAdd: false,
  csv: null, csvImporting: false, csvPct: 0,
  jTab: localStorage.getItem('q-jtab') || 'structured',
  aiDebrief: { loading:false, text:'', tradeId:null },
  aiPatterns: { loading:false, text:'', ran:false },
  theme: localStorage.getItem('q-theme') || 'dark',
  goals: JSON.parse(localStorage.getItem('q-goals') || 'null') || {},
  rules: JSON.parse(localStorage.getItem('q-rules') || '[]'),
  violations: JSON.parse(localStorage.getItem('q-violations') || '{}'),
  onboarded: localStorage.getItem('q-onboarded') === '1',
};

// ── THEME ─────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  S.theme = t; localStorage.setItem('q-theme', t);
}
function toggleTheme() { applyTheme(S.theme==='dark'?'light':'dark'); render(); }
applyTheme(S.theme);

// ── TOAST ─────────────────────────────────────────────────
function toast(msg, type='info', ms=3500) {
  const c = document.getElementById('toast-container');
  while (c.children.length >= 4) c.firstChild.remove();
  const ico = {success:'✅',error:'❌',info:'ℹ️',warn:'⚠️'};
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span style="flex-shrink:0">${ico[type]||'ℹ️'}</span><span>${esc(msg)}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ── CONFIRM / PROMPT ──────────────────────────────────────
function showConfirm(msg, onYes, opts={}) {
  const { label='Confirm', cls='btn-danger', mustType=null, ph='' } = opts;
  const o = document.createElement('div');
  o.className = 'confirm-overlay';
  o.innerHTML = `<div class="confirm-box">
    <div class="confirm-msg">${esc(msg)}</div>
    ${mustType?`<input class="form-input confirm-input" placeholder="${esc(ph)}" autocomplete="off">`:''}
    <div class="confirm-actions">
      <button class="btn btn-secondary btn-sm confirm-cancel">Cancel</button>
      <button class="btn ${cls} btn-sm confirm-ok">${esc(label)}</button>
    </div></div>`;
  document.body.appendChild(o);
  const ok=o.querySelector('.confirm-ok'), cancel=o.querySelector('.confirm-cancel'), inp=o.querySelector('.confirm-input');
  const close=()=>o.remove();
  cancel.onclick=close; o.onclick=e=>{if(e.target===o)close();};
  ok.onclick=()=>{
    if(mustType){const v=(inp?.value||'').trim();if(v!==mustType){inp.style.borderColor='var(--red)';inp.value='';return;}close();onYes(v);}
    else{close();onYes();}
  };
  if(inp){inp.focus();inp.onkeydown=e=>{if(e.key==='Enter')ok.click();};}
  else{o.onkeydown=e=>{if(e.key==='Enter')ok.click();if(e.key==='Escape')close();};setTimeout(()=>ok.focus(),50);}
}
function showPrompt(msg, onYes, ph='') {
  const o = document.createElement('div');
  o.className = 'confirm-overlay';
  o.innerHTML = `<div class="confirm-box">
    <div class="confirm-msg">${esc(msg)}</div>
    <input type="password" class="form-input confirm-input" placeholder="${esc(ph)}" autocomplete="current-password">
    <div class="confirm-actions">
      <button class="btn btn-secondary btn-sm confirm-cancel">Cancel</button>
      <button class="btn btn-danger btn-sm confirm-ok">Confirm</button>
    </div></div>`;
  document.body.appendChild(o);
  const ok=o.querySelector('.confirm-ok'), cancel=o.querySelector('.confirm-cancel'), inp=o.querySelector('.confirm-input');
  const close=()=>o.remove();
  cancel.onclick=close; o.onclick=e=>{if(e.target===o)close();};
  ok.onclick=()=>{close();onYes(inp.value);};
  inp.focus(); inp.onkeydown=e=>{if(e.key==='Enter')ok.click();};
}

// ── PREMIUM ───────────────────────────────────────────────
const isPremium = () => getUser()?.plan==='premium';
function closeUpgradeModal(){ S.upgradeModal=false; render(); }
function renderUpgradeModal() {
  return `<div class="modal" onclick="closeUpgradeModal()"><div class="modal-content upgrade-modal-content" onclick="event.stopPropagation()">
    <div class="upgrade-modal-header"><div class="upgrade-crown">👑</div>
      <h2 class="modal-title" style="margin-top:.75rem">Quantario Premium</h2>
      <p style="color:var(--text-secondary);font-size:.85rem;margin-top:.35rem">Unlock AI-powered coaching for your trading</p></div>
    <div class="upgrade-features">
      <div class="upgrade-feature"><span class="upgrade-feature-icon">✨</span><div><div class="upgrade-feature-title">AI Trade Debrief</div><div class="upgrade-feature-desc">Personalised coaching note after every trade</div></div></div>
      <div class="upgrade-feature"><span class="upgrade-feature-icon">📊</span><div><div class="upgrade-feature-title">Pattern Recognition</div><div class="upgrade-feature-desc">AI surfaces hidden strengths and weaknesses</div></div></div>
      <div class="upgrade-feature"><span class="upgrade-feature-icon">📝</span><div><div class="upgrade-feature-title">AI Journal Assistant</div><div class="upgrade-feature-desc">Draft your daily journal from your trades</div></div></div>
    </div>
    <div class="upgrade-price"><span class="upgrade-price-amount">$9.99</span><span class="upgrade-price-period">/month</span></div>
    <p style="text-align:center;color:var(--text-secondary);font-size:.78rem;margin-bottom:1.25rem">Payments coming soon — join the waitlist to be notified</p>
    <button class="btn btn-primary btn-block" onclick="toast('You\\'re on the waitlist! We\\'ll notify you when Premium launches.','success',5000);closeUpgradeModal()">Join Waitlist</button>
    <button class="btn btn-secondary btn-block" style="margin-top:.6rem" onclick="closeUpgradeModal()">Maybe Later</button>
  </div></div>`;
}
function aiLocked(label) {
  return `<button class="btn btn-ai-locked btn-sm" onclick="S.upgradeModal=true;render()"><span class="crown-icon">👑</span> ${label}</button>`;
}

// ── PERSIST HELPERS ───────────────────────────────────────
const saveGoals     = g  => { S.goals=g; localStorage.setItem('q-goals', JSON.stringify(g)); };
const saveRules     = rs => { S.rules=rs; localStorage.setItem('q-rules', JSON.stringify(rs)); };
const saveViolations= v  => { S.violations=v; localStorage.setItem('q-violations', JSON.stringify(v)); };

// ── RULES ENGINE ──────────────────────────────────────────
function autoCheck(trade) {
  return S.rules.filter(r => {
    if (!r.active) return false;
    if (r.auto === 'no_stop_loss')      return !trade.stop_loss;
    if (r.auto === 'max_daily_trades')  {
      const same = S.trades.filter(t =>
        t.exit_date && trade.exit_date &&
        new Date(t.exit_date).toDateString() === new Date(trade.exit_date).toDateString() &&
        t.id !== trade.id
      ).length;
      return same >= (r.val || 3);
    }
    return false;
  }).map(r => r.id);
}
const tradeViols   = id => S.violations[id] || [];
const violCount    = (period='all') => {
  let trades = S.trades;
  if (period==='month') {
    const n=new Date();
    trades=trades.filter(t=>t.exit_date&&new Date(t.exit_date).getMonth()===n.getMonth()&&new Date(t.exit_date).getFullYear()===n.getFullYear());
  }
  return trades.reduce((s,t)=>s+(S.violations[t.id]?.length||0),0);
};

// ── STREAK ────────────────────────────────────────────────
function calcStreak(trades) {
  const s=[...trades].filter(t=>t.exit_date).sort((a,b)=>new Date(b.exit_date)-new Date(a.exit_date));
  if(!s.length) return {n:0,type:'win'};
  const type=s[0].pnl>=0?'win':'loss';
  let n=0;
  for(const t of s){if((type==='win')===(t.pnl>=0))n++;else break;}
  return {n,type};
}

// ── EQUITY CURVE SVG ──────────────────────────────────────
function equitySVG(trades, W=640, H=150) {
  const sorted=[...trades].filter(t=>t.exit_date).sort((a,b)=>new Date(a.exit_date)-new Date(b.exit_date));
  if(sorted.length<2) return `<div class="chart-empty">Add more trades to see your equity curve</div>`;
  let run=0;
  const pts=sorted.map((t,i)=>{run+=Number(t.pnl);return{x:i,y:run};});
  const ys=pts.map(p=>p.y);
  const minY=Math.min(0,...ys), maxY=Math.max(0,...ys), rY=maxY-minY||1;
  const px=10, py=14, w=W-px*2, h=H-py*2;
  const cx=i=>px+(i/(pts.length-1))*w;
  const cy=y=>py+h-((y-minY)/rY)*h;
  const d=pts.map((p,i)=>`${i?'L':'M'}${cx(p.x).toFixed(1)},${cy(p.y).toFixed(1)}`).join(' ');
  const z0=cy(0);
  const area=`${d} L${cx(pts.length-1).toFixed(1)},${z0.toFixed(1)} L${cx(0).toFixed(1)},${z0.toFixed(1)} Z`;
  const pos=run>=0;
  const fid=`ec${Date.now()%99999}`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <defs><linearGradient id="${fid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pos?'#00d4ff':'#ef4444'}" stop-opacity=".15"/>
      <stop offset="100%" stop-color="${pos?'#00d4ff':'#ef4444'}" stop-opacity=".01"/>
    </linearGradient></defs>
    <line x1="${px}" y1="${z0.toFixed(1)}" x2="${W-px}" y2="${z0.toFixed(1)}" stroke="rgba(255,255,255,.07)" stroke-width="1" stroke-dasharray="4,4"/>
    <path d="${area}" fill="url(#${fid})"/>
    <path d="${d}" fill="none" stroke="${pos?'var(--cyan)':'var(--red)'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${cx(0).toFixed(1)}" cy="${cy(pts[0].y).toFixed(1)}" r="3.5" fill="${pts[0].y>=0?'var(--cyan)':'var(--red)'}"/>
    <circle cx="${cx(pts.length-1).toFixed(1)}" cy="${cy(run).toFixed(1)}" r="4.5" fill="${pos?'var(--cyan)':'var(--red)'}"/>
  </svg>`;
}

// ── DAY OF WEEK ───────────────────────────────────────────
function dowData(trades) {
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const d=days.map(day=>({day,pnl:0,count:0,wins:0}));
  trades.filter(t=>t.exit_date).forEach(t=>{
    const i=new Date(t.exit_date).getDay();
    d[i].pnl+=Number(t.pnl); d[i].count++; if(t.pnl>0)d[i].wins++;
  });
  return d;
}

// ── SESSION ANALYSIS ─────────────────────────────────────
function sessionData(trades) {
  const sess=[
    {label:'Pre-Market', h:[0,9],  emoji:'🌅'},
    {label:'Open',       h:[9,11], emoji:'🔔'},
    {label:'Midday',     h:[11,14],emoji:'☀️'},
    {label:'Power Hour', h:[14,16],emoji:'⚡'},
    {label:'After-Hours',h:[16,24],emoji:'🌙'},
  ].map(s=>({...s,pnl:0,count:0,wins:0}));
  trades.filter(t=>t.exit_date).forEach(t=>{
    const h=new Date(t.exit_date).getHours();
    const s=sess.find(s=>h>=s.h[0]&&h<s.h[1]);
    if(s){s.pnl+=Number(t.pnl);s.count++;if(t.pnl>0)s.wins++;}
  });
  return sess;
}

// ── STATS ─────────────────────────────────────────────────
function calcStats(trades) {
  const w=trades.filter(t=>t.pnl>0), l=trades.filter(t=>t.pnl<0);
  const tp=trades.reduce((s,t)=>s+Number(t.pnl),0);
  const tw=w.reduce((s,t)=>s+Number(t.pnl),0);
  const tl=Math.abs(l.reduce((s,t)=>s+Number(t.pnl),0));
  const aw=w.length?tw/w.length:0, al=l.length?tl/l.length:0;
  return {
    total:trades.length, pnl:tp,
    wins:w.length, losses:l.length,
    wr:trades.length?((w.length/trades.length)*100).toFixed(1):'0.0',
    aw, al,
    pf:tl>0?(tw/tl).toFixed(2):'—',
    rm:al>0?(aw/al).toFixed(2):'—'
  };
}

// ── ICONS ─────────────────────────────────────────────────
const ICO = {
  dashboard:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  trades:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  analytics:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  calendar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  journal:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  import:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  brokers:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  rules:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  profile:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
};
const LOGO34=`<svg width="34" height="34" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="qg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00d4ff"/><stop offset="100%" stop-color="#a3e635"/></linearGradient></defs><circle cx="16" cy="16" r="14" stroke="url(#qg1)" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="10" stroke="url(#qg1)" stroke-width="1.2" fill="rgba(0,212,255,0.06)"/><line x1="2" y1="16" x2="6" y2="16" stroke="url(#qg1)" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="5" r="1.5" fill="url(#qg1)"/><circle cx="16" cy="27" r="1.5" fill="url(#qg1)"/><circle cx="5" cy="16" r="1.5" fill="url(#qg1)"/><circle cx="27" cy="16" r="1.5" fill="url(#qg1)"/><rect x="9" y="19" width="2" height="4" rx="0.5" fill="#00d4ff"/><line x1="10" y1="18" x2="10" y2="19" stroke="#00d4ff" stroke-width="1"/><rect x="13" y="14" width="2" height="7" rx="0.5" fill="#a3e635"/><line x1="14" y1="12" x2="14" y2="14" stroke="#a3e635" stroke-width="1"/><rect x="17" y="16" width="2" height="5" rx="0.5" fill="#00d4ff"/><line x1="18" y1="14" x2="18" y2="16" stroke="#00d4ff" stroke-width="1"/><rect x="21" y="12" width="2" height="9" rx="0.5" fill="#a3e635"/><line x1="22" y1="10" x2="22" y2="12" stroke="#a3e635" stroke-width="1"/><polyline points="9,20 13,16 17,18 22,11" stroke="#a3e635" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
const LOGO28=`<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="qg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00d4ff"/><stop offset="100%" stop-color="#a3e635"/></linearGradient></defs><circle cx="16" cy="16" r="14" stroke="url(#qg2)" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="10" stroke="url(#qg2)" stroke-width="1.2" fill="rgba(0,212,255,0.06)"/><line x1="2" y1="16" x2="6" y2="16" stroke="url(#qg2)" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="5" r="1.5" fill="url(#qg2)"/><circle cx="16" cy="27" r="1.5" fill="url(#qg2)"/><circle cx="5" cy="16" r="1.5" fill="url(#qg2)"/><circle cx="27" cy="16" r="1.5" fill="url(#qg2)"/><rect x="9" y="19" width="2" height="4" rx="0.5" fill="#00d4ff"/><rect x="13" y="14" width="2" height="7" rx="0.5" fill="#a3e635"/><rect x="17" y="16" width="2" height="5" rx="0.5" fill="#00d4ff"/><rect x="21" y="12" width="2" height="9" rx="0.5" fill="#a3e635"/><polyline points="9,20 13,16 17,18 22,11" stroke="#a3e635" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

// ── SHARED UI PRIMITIVES ──────────────────────────────────
function statCard(label, value, sub, pos=null) {
  const cc=pos===true?'positive':pos===false?'negative':'';
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value ${cc}">${value}</div><div class="stat-change">${sub}</div></div>`;
}
function empty(ico, title, sub) {
  return `<div class="empty-state"><div class="empty-state-icon">${ico}</div><h3>${title}</h3><p>${sub}</p></div>`;
}
function skeleton() {
  return `<div class="page-header"><h1 class="header">Loading…</h1></div>
    <div class="stats-grid">${[1,2,3,4].map(()=>'<div class="stat-card skeleton" style="height:110px"></div>').join('')}</div>
    <div class="card">${[1,2,3].map(()=>'<div class="skeleton" style="height:72px;margin-bottom:.875rem;border-radius:8px"></div>').join('')}</div>`;
}

// ── MAIN RENDER ───────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  const stats = calcStats(S.trades);
  const user = getUser() || {};
  const vc = violCount('month');
  const initials = (user.name||'U').charAt(0).toUpperCase();
  const sunIcon=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const moonIcon=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  app.innerHTML = `<div class="app-container">

    <!-- SIDEBAR -->
    <div class="sidebar">
      <div class="logo">
        <div class="logo-icon">${LOGO34}</div>
        <div class="logo-text">Quan<span>tario</span></div>
      </div>
      <nav style="flex:1">
        <div class="nav-section-label">OVERVIEW</div>
        ${navBtn('dashboard','Dashboard')} 
        <div class="nav-section-label">TRADING</div>
        ${navBtn('trades','Trades')}
        ${navBtn('analytics','Analytics')}
        ${navBtn('calendar','Calendar')}
        <div class="nav-section-label">TOOLS</div>
        ${navBtn('journal','Journal')}
        <button class="nav-item ${S.view==='rules'?'active':''}" onclick="go('rules')">
          <span class="nav-icon">${ICO.rules}</span>Rules
          ${vc>0?`<span class="nav-badge">${vc}</span>`:''}
        </button>
        ${navBtn('import','Import')}
        ${navBtn('brokers','Brokers')}
      </nav>
      <div class="sidebar-footer">
        <button class="sidebar-profile-btn" onclick="openProfileModal()">
          <div class="sidebar-avatar">${esc(initials)}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${esc(user.name||'User')}</div>
            <div class="sidebar-user-label">${esc(user.email||'')}</div>
          </div>
          <span class="sidebar-profile-icon">${ICO.profile}</span>
        </button>
        <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:.5rem" onclick="handleLogout()">Logout</button>
        <button class="theme-toggle" onclick="toggleTheme()">
          <span class="theme-toggle-label">
            <span>${S.theme==='light'?'☀️':'🌙'}</span>
            <span>${S.theme==='light'?'Light mode':'Dark mode'}</span>
          </span>
          <span class="theme-toggle-track"><span class="theme-toggle-thumb"></span></span>
        </button>
        <div class="sync-status">
          <div class="sync-dot ${S.syncing?'syncing':''}"></div>
          <span>${S.syncing?'Syncing…':'Online'}</span>
        </div>
      </div>
    </div>

    <!-- MAIN -->
    <div class="main-content">
      <div class="mobile-topbar">
        <div class="logo" style="margin-bottom:0">
          <div class="logo-icon" style="width:22px;height:22px">${LOGO28}</div>
          <div class="logo-text" style="font-size:.9rem">Quan<span>tario</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          <div class="sync-dot ${S.syncing?'syncing':''}" style="width:8px;height:8px"></div>
          <button class="mobile-theme-btn" onclick="toggleTheme()" title="Toggle theme">${S.theme==='light'?sunIcon:moonIcon}</button>
          <button class="mobile-avatar" onclick="openProfileModal()">${esc(initials)}</button>
        </div>
      </div>
      ${S.loading ? skeleton() : renderView(stats)}
    </div>

    <!-- BOTTOM NAV -->
    <nav class="bottom-nav">
      <button class="bottom-nav-item ${S.view==='dashboard'?'active':''}" onclick="go('dashboard')">${ICO.dashboard}<span>Home</span></button>
      <button class="bottom-nav-item ${S.view==='trades'?'active':''}" onclick="go('trades')">${ICO.trades}<span>Trades</span></button>
      <button class="bottom-nav-fab" onclick="openQuickAdd()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button class="bottom-nav-item ${S.view==='analytics'?'active':''}" onclick="go('analytics')">${ICO.analytics}<span>Stats</span></button>
      <button class="bottom-nav-item ${['journal','calendar','import','brokers','rules'].includes(S.view)?'active':''}" onclick="toggleMore()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
        <span>More</span>
      </button>
    </nav>

    ${S.tradeModal   ? renderTradeModal()   : ''}
    ${S.profileModal ? renderProfileModal() : ''}
    ${S.upgradeModal ? renderUpgradeModal() : ''}
    ${S.quickAdd     ? renderQuickAdd()     : ''}
    ${!S.onboarded && !S.trades.length && !S.loading ? renderOnboarding() : ''}
  </div>`;
}

function navBtn(id, label) {
  return `<button class="nav-item ${S.view===id?'active':''}" onclick="go('${id}')"><span class="nav-icon">${ICO[id]}</span>${label}</button>`;
}

function renderView(stats) {
  switch(S.view) {
    case 'dashboard': return viewDashboard(stats);
    case 'trades':    return viewTrades();
    case 'analytics': return viewAnalytics(stats);
    case 'calendar':  return viewCalendar();
    case 'journal':   return viewJournal();
    case 'import':    return viewImport();
    case 'brokers':   return viewBrokers();
    case 'rules':     return viewRules();
    default:          return viewDashboard(stats);
  }
}

// ── ONBOARDING ────────────────────────────────────────────
function renderOnboarding() {
  const step = parseInt(localStorage.getItem('q-ob-step')||'1');
  const steps = [
    {ico:'👋', title:'Welcome to Quantario', body:'Your professional trading journal. Track every trade, spot your patterns, and build the discipline that compounds.'},
    {ico:'📊', title:'Log your first trade',  body:'Hit the + button to add a trade. Include your strategy, stop loss, and notes — the more context you add, the smarter your insights become.'},
    {ico:'🔗', title:'Connect or import',     body:'Connect a broker for automatic sync, or drag and drop a CSV of past trades. Either way, your history is immediately at work.'},
  ];
  const s=steps[step-1], last=step===3;
  return `<div class="onboarding-overlay"><div class="onboarding-box">
    <div class="onboarding-icon">${s.ico}</div>
    <div class="onboarding-dots">${[1,2,3].map(i=>`<div class="ob-dot ${i===step?'active':i<step?'done':''}"></div>`).join('')}</div>
    <h2 class="onboarding-title">${s.title}</h2>
    <p class="onboarding-body">${s.body}</p>
    <div class="onboarding-actions">
      ${last
        ? `<button class="btn btn-primary" onclick="finishOnboarding()">Get Started →</button>`
        : `<button class="btn btn-primary" onclick="localStorage.setItem('q-ob-step',${step+1});render()">Next →</button>
           <button class="btn btn-secondary btn-sm" onclick="finishOnboarding()">Skip</button>`}
    </div>
  </div></div>`;
}
function finishOnboarding() { localStorage.setItem('q-onboarded','1'); S.onboarded=true; render(); }

// ── DASHBOARD ─────────────────────────────────────────────
function viewDashboard(s) {
  const now = new Date();
  const monthTrades = S.trades.filter(t => {
    if(!t.exit_date) return false;
    const d=new Date(t.exit_date);
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  });
  const mPnL   = monthTrades.reduce((a,t)=>a+Number(t.pnl),0);
  const mWins  = monthTrades.filter(t=>t.pnl>0).length;
  const mWR    = monthTrades.length ? ((mWins/monthTrades.length)*100).toFixed(1) : '0.0';
  const todayT = S.trades.filter(t=>t.exit_date&&new Date(t.exit_date).toDateString()===now.toDateString());
  const todayP = todayT.reduce((a,t)=>a+Number(t.pnl),0);
  const streak = calcStreak(S.trades);
  const best   = S.trades.reduce((b,t)=>(!b||Number(t.pnl)>Number(b.pnl)?t:b),null);
  const worst  = S.trades.reduce((b,t)=>(!b||Number(t.pnl)<Number(b.pnl)?t:b),null);
  const mViols = violCount('month');
  const g = S.goals;

  // Goal progress
  const mPnLPct  = g.monthlyPnL  ? Math.min(100, (mPnL/g.monthlyPnL)*100)              : null;
  const wrPct    = g.winRate      ? Math.min(100, (parseFloat(mWR)/g.winRate)*100)       : null;
  const dLossOk  = g.dailyMaxLoss ? todayP >= g.dailyMaxLoss                             : null;
  const dTradeOk = g.maxDayTrades ? todayT.length <= g.maxDayTrades                      : null;
  const hasGoals = g.monthlyPnL||g.winRate||g.dailyMaxLoss||g.maxDayTrades;

  return `
  <div class="page-header">
    <h1 class="header">Dashboard</h1>
    <div style="display:flex;gap:.5rem">
      <button class="btn btn-secondary btn-sm hide-mobile" onclick="openGoalsModal()">🎯 Goals</button>
      <button class="btn btn-primary hide-mobile" onclick="openAddTrade()">+ Add Trade</button>
    </div>
  </div>

  <div class="stats-grid">
    ${statCard('Total P&L',    $pnl(s.pnl,true), `${s.wins}W / ${s.losses}L`, s.pnl>=0)}
    ${statCard('Win Rate',     $pct(s.wr),        `${s.total} total trades`)}
    ${statCard('This Month',   $pnl(mPnL,true),   `${monthTrades.length} trades · ${mWR}% WR`, mPnL>=0)}
    ${statCard('Today',        $pnl(todayP,true),  `${todayT.length} trade${todayT.length!==1?'s':''} today`, todayP>=0)}
    ${statCard('Profit Factor',s.pf,              'Gross wins ÷ losses')}
    ${statCard('R-Multiple',   s.rm,              'Avg win ÷ avg loss')}
  </div>

  <!-- STREAK + BEST/WORST -->
  <div class="dashboard-row">
    <div class="card dashboard-streak-card">
      <div class="card-title">Current Streak</div>
      ${streak.n===0 ? `<div style="color:var(--text-muted);font-size:.875rem;padding:.5rem 0">No trades yet</div>` : `
      <div class="streak-body">
        <div class="streak-number ${streak.type}">${streak.n}</div>
        <div class="streak-label">${streak.type==='win'?'🟢':'🔴'} ${streak.type} trade${streak.n!==1?'s':''} in a row</div>
      </div>`}
    </div>
    <div class="card">
      <div class="card-title">Best &amp; Worst Trade</div>
      ${!best ? empty('📊','No trades yet','') : `
      <div class="best-worst-grid">
        <div class="best-worst-item"><div class="best-worst-label">🏆 Best</div><div class="best-worst-symbol">${esc(best.symbol)}</div><div class="best-worst-pnl positive">${$pnl(best.pnl,true)}</div></div>
        <div class="best-worst-divider"></div>
        <div class="best-worst-item"><div class="best-worst-label">💸 Worst</div><div class="best-worst-symbol">${esc(worst.symbol)}</div><div class="best-worst-pnl negative">${$pnl(worst.pnl)}</div></div>
      </div>`}
    </div>
  </div>

  <!-- GOALS -->
  ${hasGoals ? `
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>🎯 Monthly Goals</span>
      <button class="btn btn-secondary btn-sm" onclick="openGoalsModal()">Edit</button>
    </div>
    <div class="goals-grid">
      ${g.monthlyPnL!=null?`
      <div class="goal-item ${mPnL>=g.monthlyPnL?'achieved':''}">
        <div class="goal-header"><span class="goal-label">P&L Target</span><span class="goal-value ${mPnL>=0?'positive':'negative'}">${$pnl(mPnL,true)} / ${$pnl(g.monthlyPnL)}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.max(0,mPnLPct).toFixed(0)}%"></div></div>
        <div class="goal-sub">${mPnLPct!=null?mPnLPct.toFixed(0):0}% of target</div>
      </div>`:''}
      ${g.winRate!=null?`
      <div class="goal-item ${parseFloat(mWR)>=g.winRate?'achieved':''}">
        <div class="goal-header"><span class="goal-label">Win Rate Target</span><span class="goal-value">${mWR}% / ${g.winRate}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.max(0,wrPct).toFixed(0)}%"></div></div>
        <div class="goal-sub">${wrPct!=null?wrPct.toFixed(0):0}% of target</div>
      </div>`:''}
      ${g.dailyMaxLoss!=null?`
      <div class="goal-item ${dLossOk?'achieved':todayT.length>0?'breached':''}">
        <div class="goal-header"><span class="goal-label">Daily Loss Limit</span><span class="goal-value ${todayP>=0?'positive':'negative'}">${$pnl(todayP,true)} / ${$pnl(g.dailyMaxLoss)}</span></div>
        <div class="goal-status">${dLossOk===null?'No trades today':dLossOk?'✅ Within limit':'⛔ Limit breached — stop trading'}</div>
      </div>`:''}
      ${g.maxDayTrades!=null?`
      <div class="goal-item ${dTradeOk?'achieved':todayT.length>g.maxDayTrades?'breached':''}">
        <div class="goal-header"><span class="goal-label">Max Trades/Day</span><span class="goal-value">${todayT.length} / ${g.maxDayTrades}</span></div>
        <div class="goal-status">${todayT.length>g.maxDayTrades?'⛔ Limit exceeded':todayT.length===g.maxDayTrades?'⚠️ At the limit':`✅ ${g.maxDayTrades-todayT.length} remaining`}</div>
      </div>`:''}
    </div>
  </div>` : `
  <div class="card goals-empty-card" onclick="openGoalsModal()" style="cursor:pointer">
    <div style="display:flex;align-items:center;gap:1rem">
      <div style="font-size:2rem">🎯</div>
      <div><div style="font-weight:700;margin-bottom:.25rem">Set Trading Goals</div><div style="color:var(--text-secondary);font-size:.82rem">Monthly P&L target, daily loss limit, win rate goal</div></div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" style="margin-left:auto;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  </div>`}

  <!-- EQUITY CURVE -->
  ${S.trades.length>=2?`
  <div class="card">
    <div class="card-title">Equity Curve</div>
    <div class="equity-chart-wrap">${equitySVG(S.trades)}</div>
    <div class="equity-chart-meta"><span>${s.total} trades</span><span class="${s.pnl>=0?'positive':'negative'}" style="font-weight:700">${$pnl(s.pnl,true)} all time</span></div>
  </div>`:''}

  <!-- RULE VIOLATIONS BANNER -->
  ${mViols>0?`
  <div class="card violations-card" onclick="go('rules')" style="cursor:pointer">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:.75rem">
        <span style="font-size:1.5rem">⚠️</span>
        <div><div style="font-weight:700">${mViols} rule violation${mViols!==1?'s':''} this month</div><div style="color:var(--text-secondary);font-size:.82rem">Tap to review your rules dashboard</div></div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  </div>`:''}

  <!-- RECENT TRADES -->
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>Recent Trades</span>
      ${S.trades.length>5?`<button class="btn btn-secondary btn-sm" onclick="go('trades')">View all →</button>`:''}
    </div>
    ${!S.trades.length ? empty('📊','No trades yet','Tap + to log your first trade') : S.trades.slice(0,5).map(t=>tradeRow(t,false)).join('')}
  </div>`;
}

// ── QUICK ADD MODAL ───────────────────────────────────────
function openQuickAdd()  { S.quickAdd=true;  render(); requestAnimationFrame(initQA); }
function closeQuickAdd() { S.quickAdd=false; render(); }
function renderQuickAdd() {
  const now=new Date().toISOString().slice(0,16);
  return `<div class="modal" onclick="closeQuickAdd()"><div class="modal-content quick-add-modal" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h2 class="modal-title">⚡ Quick Add Trade</h2>
      <button class="btn btn-secondary btn-sm" onclick="closeQuickAdd()">✕</button>
    </div>
    <p style="color:var(--text-secondary);font-size:.78rem;margin-bottom:1.25rem">4 fields — add notes anytime from Trade History</p>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Symbol *</label>
        <input class="form-input" id="qa-sym" placeholder="AAPL, EUR/USD…" autocomplete="off" autocapitalize="characters" style="font-size:16px">
      </div>
      <div class="form-group">
        <label class="form-label">Direction</label>
        <select class="form-select" id="qa-dir" oninput="qaPreview()" style="font-size:16px">
          <option value="long">Long (Buy)</option>
          <option value="short">Short (Sell)</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Entry *</label><input type="number" step="any" class="form-input" id="qa-ep" placeholder="0.00" oninput="qaPreview()" style="font-size:16px"></div>
      <div class="form-group"><label class="form-label">Exit *</label><input type="number" step="any" class="form-input" id="qa-xp" placeholder="0.00" oninput="qaPreview()" style="font-size:16px"></div>
      <div class="form-group"><label class="form-label">Qty *</label><input type="number" step="any" class="form-input" id="qa-qty" placeholder="0" oninput="qaPreview()" style="font-size:16px"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Exit Date / Time</label>
      <input type="datetime-local" class="form-input" id="qa-xd" value="${now}" style="font-size:16px">
    </div>
    <div class="qa-pnl-preview" id="qa-preview">P&L preview: fill in the fields above</div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="qa-save" onclick="doQuickSave()">Save Trade</button>
      <button class="btn btn-secondary" onclick="closeQuickAdd()">Cancel</button>
    </div>
  </div></div>`;
}
function initQA() { document.getElementById('qa-sym')?.focus(); }
function qaPreview() {
  const ep=parseFloat(document.getElementById('qa-ep')?.value);
  const xp=parseFloat(document.getElementById('qa-xp')?.value);
  const qty=parseFloat(document.getElementById('qa-qty')?.value);
  const dir=document.getElementById('qa-dir')?.value||'long';
  const el=document.getElementById('qa-preview'); if(!el) return;
  if(isNaN(ep)||isNaN(xp)||isNaN(qty)||qty<=0){el.textContent='P&L preview: fill in the fields above';el.className='qa-pnl-preview';return;}
  const pnl=(xp-ep)*qty*(dir==='short'?-1:1);
  el.textContent=`P&L: ${pnl>=0?'+':''}$${pnl.toFixed(2)}`;
  el.className=`qa-pnl-preview ${pnl>=0?'positive':'negative'}`;
}
async function doQuickSave() {
  const sym=(document.getElementById('qa-sym')?.value||'').trim().toUpperCase();
  const ep=parseFloat(document.getElementById('qa-ep')?.value);
  const xp=parseFloat(document.getElementById('qa-xp')?.value);
  const qty=parseFloat(document.getElementById('qa-qty')?.value);
  if(!sym||isNaN(ep)||isNaN(xp)||isNaN(qty)||qty<=0){toast('Symbol, entry, exit and quantity are required','error');return;}
  const btn=document.getElementById('qa-save');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Saving…';}
  try {
    S.syncing=true;
    const res=await api.createTrade({symbol:sym,entry_price:ep,exit_price:xp,quantity:qty,
      direction:document.getElementById('qa-dir').value,
      exit_date:document.getElementById('qa-xd').value||null,asset_type:'stock'});
    S.trades.unshift(res.data);
    const pnl=Number(res.data.pnl);
    const av=autoCheck(res.data);
    if(av.length){const v={...S.violations,[res.data.id]:av};saveViolations(v);}
    S.syncing=false;
    toast(`${sym} saved — ${pnl>=0?'+':''}$${pnl.toFixed(2)}${av.length?` · ⚠️ ${av.length} rule violation${av.length>1?'s':''}`:''}`,'success');
    closeQuickAdd();
  } catch(err){S.syncing=false;toast(`Save failed: ${err.message}`,'error');if(btn){btn.disabled=false;btn.textContent='Save Trade';}}
}

// ── TRADES ────────────────────────────────────────────────
function viewTrades() {
  const filtered=S.trades.filter(t=>
    (S.filterAsset==='all'||t.asset_type===S.filterAsset)&&
    (S.filterDir==='all'||t.direction===S.filterDir)
  );
  const assets=['stock','forex','crypto','futures','options'];
  return `
  <div class="page-header">
    <h1 class="header">Trade History</h1>
    <button class="btn btn-primary hide-mobile" onclick="openAddTrade()">+ Add Trade</button>
  </div>
  <div class="filter-bar">
    <div class="filter-chips">
      <button class="filter-chip ${S.filterAsset==='all'?'active':''}" onclick="S.filterAsset='all';render()">All</button>
      ${assets.map(v=>`<button class="filter-chip ${S.filterAsset===v?'active':''}" onclick="S.filterAsset='${v}';render()">${v.charAt(0).toUpperCase()+v.slice(1)}</button>`).join('')}
    </div>
    <div class="filter-chips">
      ${['all','long','short'].map(v=>`<button class="filter-chip ${S.filterDir===v?'active':''}" onclick="S.filterDir='${v}';render()">${v==='all'?'Both':v.charAt(0).toUpperCase()+v.slice(1)}</button>`).join('')}
    </div>
    <span class="filter-count">${filtered.length} trade${filtered.length!==1?'s':''}</span>
  </div>
  <div class="card">${filtered.length?filtered.map(t=>tradeRow(t,true)).join(''):empty('🔍','No trades found','Try adjusting your filters')}</div>`;
}

function tradeRow(t, showDel=false) {
  const pnl=Number(t.pnl), ep=Number(t.entry_price), xp=Number(t.exit_price);
  const dec=ep<10?4:2;
  const viols=tradeViols(t.id);
  return `<div class="trade-item" onclick="viewTrade('${esc(t.id)}')">
    <div class="trade-header">
      <div class="trade-left">
        <span class="trade-symbol">${esc(t.symbol)}</span>
        <span class="trade-badges">
          <span class="badge badge-${t.direction}">${t.direction}</span>
          <span class="badge badge-${t.asset_type}">${t.asset_type}</span>
          ${t.broker&&t.broker!=='manual'?`<span class="badge badge-broker">${esc(t.broker)}</span>`:''}
          ${viols.length>0?`<span class="badge badge-violation">⚠️ ${viols.length}</span>`:''}
        </span>
      </div>
      <div class="trade-right">
        <span class="trade-pnl ${pnl>=0?'positive':'negative'}">${pnl>=0?'+':''}$${pnl.toFixed(2)}</span>
        ${showDel?`<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();doDeleteTrade('${esc(t.id)}')">✕</button>`:''}
      </div>
    </div>
    <div class="trade-meta">
      <span class="trade-meta-item">📅 ${t.exit_date?new Date(t.exit_date).toLocaleDateString():'—'}</span>
      ${t.strategy?`<span class="trade-meta-item">📋 ${esc(t.strategy)}</span>`:''}
      <span class="trade-meta-item">💰 $${ep.toFixed(dec)} → $${xp.toFixed(dec)}</span>
      <span class="trade-meta-item">📦 ${t.quantity}</span>
    </div>
    ${t.notes?`<div class="trade-notes">${esc(t.notes)}</div>`:''}
  </div>`;
}

// ── ANALYTICS ─────────────────────────────────────────────
function viewAnalytics(s) {
  const byStrat=S.trades.reduce((a,t)=>{const k=t.strategy||'No Strategy';if(!a[k])a[k]={pnl:0,count:0,wins:0};a[k].pnl+=Number(t.pnl);a[k].count++;if(t.pnl>0)a[k].wins++;return a;},{});
  const byAsset=S.trades.reduce((a,t)=>{a[t.asset_type]=(a[t.asset_type]||0)+1;return a;},{});
  const dow=dowData(S.trades);
  const sess=sessionData(S.trades);
  const tradingDow=dow.filter(d=>d.count>0);
  const maxAbs=Math.max(1,...tradingDow.map(d=>Math.abs(d.pnl)));

  return `
  <div class="page-header"><h1 class="header">Analytics</h1></div>
  <div class="stats-grid">
    ${statCard('Total Trades',s.total,'')}
    ${statCard('Win Rate',$pct(s.wr),'')}
    ${statCard('Profit Factor',s.pf,'')}
    ${statCard('Total P&L',$pnl(s.pnl,true),'',s.pnl>=0)}
  </div>

  <!-- EQUITY CURVE -->
  ${S.trades.length>=2?`
  <div class="card">
    <div class="card-title">Equity Curve</div>
    <div class="equity-chart-wrap">${equitySVG(S.trades,700,180)}</div>
  </div>`:''}

  <!-- DAY OF WEEK -->
  <div class="card">
    <div class="card-title">Performance by Day of Week</div>
    ${!S.trades.length?empty('📅','No data yet','Add trades to see day breakdown'):`
    <div class="dow-grid">
      ${dow.filter(d=>d.day!=='Sun'&&d.day!=='Sat').map(d=>{
        const barH=d.count>0?Math.max(8,Math.abs(d.pnl/maxAbs)*100):4;
        const wr=d.count>0?((d.wins/d.count)*100).toFixed(0):null;
        return `<div class="dow-col">
          <div class="dow-bar-wrap">
            <div class="dow-bar ${d.pnl>=0?'positive':'negative'} ${!d.count?'empty':''}" style="height:${barH.toFixed(0)}px" title="${d.day}: ${d.count}t, ${$pnl(d.pnl,true)}"></div>
          </div>
          <div class="dow-day">${d.day}</div>
          <div class="dow-pnl ${d.pnl>=0?'positive':'negative'}">${d.count?$pnl(d.pnl,true):'—'}</div>
          <div class="dow-wr">${wr?wr+'% WR':'—'}</div>
          <div class="dow-count">${d.count}t</div>
        </div>`;
      }).join('')}
    </div>`}
  </div>

  <!-- SESSION -->
  <div class="card">
    <div class="card-title">Performance by Session</div>
    ${!S.trades.filter(t=>t.exit_date).length?empty('🕐','No data yet','Add trades with exit times'):`
    <div class="session-list">
      ${sess.filter(s=>s.count>0).map(s=>`
      <div class="session-item">
        <div class="session-left">
          <span class="session-emoji">${s.emoji}</span>
          <div><div class="session-name">${s.label}</div><div class="session-meta">${s.count} trade${s.count!==1?'s':''} · ${((s.wins/s.count)*100).toFixed(0)}% WR</div></div>
        </div>
        <div class="session-pnl ${s.pnl>=0?'positive':'negative'}">${$pnl(s.pnl,true)}</div>
      </div>`).join('')}
      ${sess.every(s=>!s.count)?`<div style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:1rem">No exit time data — add exit times to trades</div>`:''}
    </div>`}
  </div>

  <!-- AI PATTERNS -->
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>✨ AI Pattern Insights</span>
      ${isPremium()
        ?`<button class="btn btn-ai btn-sm" id="ai-patterns-btn" onclick="doAIPatterns()">${S.aiPatterns.loading?'<span class="spinner"></span> Analysing…':S.aiPatterns.ran?'↺ Re-analyse':'Analyse My Trades'}</button>`
        :aiLocked('Analyse My Trades')}
    </div>
    ${S.aiPatterns.text
      ?`<div class="ai-patterns-output" id="ai-patterns-text">${esc(S.aiPatterns.text).replace(/\n/g,'<br>')}</div>`
      :S.aiPatterns.loading
        ?`<div class="ai-patterns-output" id="ai-patterns-text"><span class="ai-cursor"></span></div>`
        :`<div style="text-align:center;padding:2rem 1rem;color:var(--text-secondary)">
            <div style="font-size:2rem;margin-bottom:.75rem;opacity:.4">${isPremium()?'📊':'👑'}</div>
            <div style="font-size:.85rem">${isPremium()?'Click "Analyse My Trades" to surface hidden patterns':'Upgrade to Premium to unlock AI pattern recognition'}</div>
          </div>`}
  </div>

  <!-- BY STRATEGY -->
  <div class="card">
    <div class="card-title">Performance by Strategy</div>
    ${!Object.keys(byStrat).length?empty('📈','No data yet','Add trades with strategy names'):
      Object.entries(byStrat).sort((a,b)=>b[1].pnl-a[1].pnl).map(([k,d])=>`
      <div class="trade-item" style="cursor:default">
        <div class="trade-header"><span class="trade-symbol">${esc(k)}</span><span class="trade-pnl ${d.pnl>=0?'positive':'negative'}">${d.pnl>=0?'+':''}$${d.pnl.toFixed(2)}</span></div>
        <div class="trade-meta">
          <span class="trade-meta-item">📊 ${d.count} trades</span>
          <span class="trade-meta-item">✅ ${d.wins} wins</span>
          <span class="trade-meta-item">📈 ${((d.wins/d.count)*100).toFixed(1)}% WR</span>
        </div>
      </div>`).join('')}
  </div>

  <!-- BY ASSET -->
  <div class="card">
    <div class="card-title">Asset Distribution</div>
    ${!Object.keys(byAsset).length?empty('📊','No data yet','Add trades to see breakdown'):
      Object.entries(byAsset).map(([asset,count])=>{
        const pct=((count/S.trades.length)*100).toFixed(1);
        return `<div class="trade-item" style="cursor:default;margin-bottom:.875rem">
          <div class="trade-header" style="margin-bottom:.5rem">
            <span class="badge badge-${asset}">${asset}</span>
            <span style="color:var(--text-secondary);font-size:.82rem">${count} trades · ${pct}%</span>
          </div>
          <div class="progress-bar" style="margin-top:0"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join('')}
  </div>`;
}

// ── CALENDAR ──────────────────────────────────────────────
function viewCalendar() {
  const yr=S.calDate.getFullYear(), mo=S.calDate.getMonth();
  const mn=S.calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const dim=new Date(yr,mo+1,0).getDate(), sdow=new Date(yr,mo,1).getDay();
  const tbd={}, pbd={}, hj={};
  S.trades.filter(t=>t.exit_date&&new Date(t.exit_date).getMonth()===mo&&new Date(t.exit_date).getFullYear()===yr)
    .forEach(t=>{const d=new Date(t.exit_date).getDate();if(!tbd[d])tbd[d]=[];tbd[d].push(t);pbd[d]=(pbd[d]||0)+Number(t.pnl);});
  S.journal.forEach(e=>{const d=new Date(e.entry_date+'T12:00:00');if(d.getMonth()===mo&&d.getFullYear()===yr)hj[d.getDate()]=true;});
  const td=Object.keys(tbd).length, wd=Object.values(pbd).filter(p=>p>0).length, ld=Object.values(pbd).filter(p=>p<0).length;
  const mP=Object.values(pbd).reduce((s,p)=>s+p,0), avg=td?mP/td:0;
  const cells=[];
  for(let i=0;i<sdow;i++) cells.push('<div class="calendar-day empty"></div>');
  for(let day=1;day<=dim;day++){
    const pnl=pbd[day]??null, ts=tbd[day]||[];
    let cls='calendar-day';
    if(ts.length) cls+=pnl>0?' profit':pnl<0?' loss':' breakeven';
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    cells.push(`<div class="${cls}" onclick="calDay('${ds}')">
      ${hj[day]?'<div class="calendar-day-journal">📝</div>':''}
      <div class="calendar-day-number">${day}</div>
      ${ts.length?`<div class="calendar-day-pnl ${pnl>=0?'positive':'negative'}">${pnl>=0?'+':''}$${Math.abs(pnl).toFixed(0)}</div><div class="calendar-day-trades">${ts.length}t</div>`:''}
    </div>`);
  }
  return `
  <div class="page-header"><h1 class="header">Calendar</h1></div>
  <div class="card">
    <div class="calendar-stats">
      <div class="calendar-stat-item"><div class="calendar-stat-label">Monthly P&L</div><div class="calendar-stat-value" style="color:${mP>=0?'var(--cyan)':'var(--red)'}">${mP>=0?'+':''}$${mP.toFixed(2)}</div></div>
      <div class="calendar-stat-item"><div class="calendar-stat-label">Trading Days</div><div class="calendar-stat-value">${td}</div></div>
      <div class="calendar-stat-item"><div class="calendar-stat-label">Green Days</div><div class="calendar-stat-value positive">${wd}</div></div>
      <div class="calendar-stat-item"><div class="calendar-stat-label">Red Days</div><div class="calendar-stat-value negative">${ld}</div></div>
      <div class="calendar-stat-item"><div class="calendar-stat-label">Avg Daily</div><div class="calendar-stat-value" style="color:${avg>=0?'var(--cyan)':'var(--red)'}">${avg>=0?'+':''}$${Math.abs(avg).toFixed(2)}</div></div>
      <div class="calendar-stat-item"><div class="calendar-stat-label">Day Win Rate</div><div class="calendar-stat-value">${td?((wd/td)*100).toFixed(1):0}%</div></div>
    </div>
  </div>
  <div class="calendar-container">
    <div class="calendar-header">
      <button class="calendar-nav-btn" onclick="S.calDate.setMonth(S.calDate.getMonth()-1);render()">‹</button>
      <div class="calendar-month-title">${mn}</div>
      <button class="calendar-nav-btn" onclick="S.calDate.setMonth(S.calDate.getMonth()+1);render()">›</button>
    </div>
    <div class="calendar-grid">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="calendar-day-header">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
  </div>`;
}
function calDay(ds) {
  const date=new Date(ds+'T12:00:00');
  const dt=S.trades.filter(t=>t.exit_date&&new Date(t.exit_date).toDateString()===date.toDateString());
  if(!dt.length) return;
  const tP=dt.reduce((s,t)=>s+Number(t.pnl),0);
  const lbl=date.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  const o=document.createElement('div'); o.className='confirm-overlay';
  o.innerHTML=`<div class="confirm-box" style="max-width:440px;width:92vw">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <div><div style="font-weight:700;font-size:1rem">${lbl}</div><div style="font-size:.82rem;color:var(--text-secondary)">${dt.length} trade${dt.length!==1?'s':''}</div></div>
      <span class="${tP>=0?'positive':'negative'}" style="font-size:1.15rem;font-weight:800">${tP>=0?'+':''}$${tP.toFixed(2)}</span>
    </div>
    <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem">
      ${dt.map(t=>{const p=Number(t.pnl);return `<div style="background:var(--bg-surface);border-radius:8px;padding:.6rem .75rem;cursor:pointer" onclick="this.closest('.confirm-overlay').remove();viewTrade('${esc(t.id)}')">
        <div style="display:flex;justify-content:space-between"><span style="font-weight:700">${esc(t.symbol)}</span><span class="${p>=0?'positive':'negative'}">${p>=0?'+':''}$${p.toFixed(2)}</span></div>
        <div style="font-size:.75rem;color:var(--text-secondary);margin-top:2px">${t.direction} · ${t.asset_type}${t.strategy?' · '+esc(t.strategy):''}</div>
      </div>`;}).join('')}
    </div>
    <div class="confirm-actions" style="margin-top:1rem"><button class="btn btn-secondary btn-sm" onclick="this.closest('.confirm-overlay').remove()">Close</button></div>
  </div>`;
  document.body.appendChild(o);
  o.onclick=e=>{if(e.target===o)o.remove();};
  o.addEventListener('keydown',e=>{if(e.key==='Escape')o.remove();});
}

// ── JOURNAL ───────────────────────────────────────────────
function viewJournal() {
  const structured = S.jTab==='structured';
  return `
  <div class="page-header"><h1 class="header">Journal</h1></div>

  <div class="journal-tabs">
    <button class="journal-tab ${structured?'active':''}" onclick="S.jTab='structured';localStorage.setItem('q-jtab','structured');render()">📋 Structured</button>
    <button class="journal-tab ${!structured?'active':''}" onclick="S.jTab='quick';localStorage.setItem('q-jtab','quick');render()">✏️ Quick</button>
  </div>

  <div class="card">
    <div class="card-title">New Entry — ${structured?'Structured Template':'Quick Note'}</div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input type="date" class="form-input" id="j-date" value="${$date()}" style="max-width:220px">
    </div>
    ${structured ? `
    <div class="structured-journal">
      <div class="struct-section">
        <label class="struct-label">📐 Setup</label>
        <div class="struct-hint">What was the chart pattern, signal, or catalyst?</div>
        <textarea class="form-textarea struct-textarea" id="j-setup" placeholder="E.g. Bull flag on 15m, RSI pulling back from overbought, above 20 EMA…" style="min-height:90px"></textarea>
      </div>
      <div class="struct-section">
        <label class="struct-label">📝 Plan</label>
        <div class="struct-hint">Entry thesis, target, and risk management plan?</div>
        <textarea class="form-textarea struct-textarea" id="j-plan" placeholder="E.g. Enter on break of $180, target $185, stop at $178, risk/reward 2.5:1…" style="min-height:90px"></textarea>
      </div>
      <div class="struct-section">
        <label class="struct-label">⚡ Execution</label>
        <div class="struct-hint">What actually happened? Did you stick to the plan?</div>
        <textarea class="form-textarea struct-textarea" id="j-exec" placeholder="E.g. Entered at $180.20, moved stop too early, closed at $182.50…" style="min-height:90px"></textarea>
      </div>
      <div class="struct-section">
        <label class="struct-label">💡 Lesson</label>
        <div class="struct-hint">The one thing you're taking away from today.</div>
        <textarea class="form-textarea struct-textarea" id="j-lesson" placeholder="E.g. Let winners run. Trust the original plan when nothing has changed…" style="min-height:80px"></textarea>
      </div>
    </div>` : `
    <div class="form-group">
      <label class="form-label">Entry</label>
      <textarea class="form-textarea" id="j-content" placeholder="What did you learn today? How did you execute? How did you feel?" style="min-height:140px"></textarea>
    </div>`}
    <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;margin-top:1rem">
      <button class="btn btn-primary" id="j-save" onclick="doSaveJournal()">Save Entry</button>
      ${isPremium()?`<button class="btn btn-ai btn-sm" id="ai-draft-btn" onclick="doAIDraft()">✨ Draft from Today's Trades</button>`:aiLocked("Draft from Today's Trades")}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Past Entries <span class="card-title-count">${S.journal.length}</span></div>
    ${!S.journal.length?empty('📝','No entries yet','Start documenting your trading journey above'):
      S.journal.map(e=>`<div class="journal-entry">
        <button class="journal-delete" onclick="doDeleteJournal('${esc(e.id)}')">✕</button>
        <div class="journal-date">${new Date(e.entry_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        <div class="journal-text">${renderJournalText(esc(e.content))}</div>
      </div>`).join('')}
  </div>

  <div class="card">
    <div class="card-title">Trade Notes</div>
    ${!S.trades.filter(t=>t.notes).length?empty('💭','No trade notes','Add notes when logging trades'):
      S.trades.filter(t=>t.notes).map(t=>{const p=Number(t.pnl);return `<div class="journal-entry" style="border-left-color:${p>=0?'var(--cyan)':'var(--red)'}">
        <div class="journal-date ${p>=0?'positive':'negative'}">${esc(t.symbol)} · ${t.exit_date?new Date(t.exit_date).toLocaleDateString():'—'}<span style="margin-left:1rem">${p>=0?'+':''}$${p.toFixed(2)}</span></div>
        <div class="journal-text">${esc(t.notes)}</div>
      </div>`;}).join('')}
  </div>`;
}

function renderJournalText(content) {
  return content
    .replace(/## Setup\n/g,      '<strong class="j-section-hdr">📐 Setup</strong><br>')
    .replace(/## Plan\n/g,       '<strong class="j-section-hdr">📝 Plan</strong><br>')
    .replace(/## Execution\n/g,  '<strong class="j-section-hdr">⚡ Execution</strong><br>')
    .replace(/## Lesson\n/g,     '<strong class="j-section-hdr">💡 Lesson</strong><br>')
    .replace(/\n/g, '<br>');
}

// ── RULES ─────────────────────────────────────────────────
function viewRules() {
  const tV=violCount(), mV=violCount('month');
  const rvc={};
  Object.values(S.violations).forEach(ids=>ids.forEach(id=>{rvc[id]=(rvc[id]||0)+1;}));
  const compliance=S.trades.length?Math.max(0,100-((tV/S.trades.length)*100)).toFixed(0):'—';

  return `
  <div class="page-header">
    <h1 class="header">Rules Engine</h1>
    <button class="btn btn-primary hide-mobile" onclick="openAddRule()">+ Add Rule</button>
  </div>
  <div class="stats-grid">
    ${statCard('Active Rules', S.rules.filter(r=>r.active).length, 'Currently enforced')}
    ${statCard('This Month',   mV,   'Rule violations')}
    ${statCard('All Time',     tV,   'Total violations')}
    ${statCard('Compliance',   compliance==='—'?'—':compliance+'%', 'Trades with no violations')}
  </div>

  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>My Rules</span>
      <button class="btn btn-primary btn-sm" onclick="openAddRule()">+ Add Rule</button>
    </div>
    ${!S.rules.length ? `
    <div class="rules-empty">
      <div style="font-size:2rem;margin-bottom:.75rem">📋</div>
      <div style="font-weight:700;margin-bottom:.5rem">No rules defined yet</div>
      <div style="color:var(--text-secondary);font-size:.85rem;margin-bottom:1.25rem">Rules hold you accountable to your trading plan — every trade is checked against them.</div>
      <div class="rules-suggestions">
        ${[
          {text:'Always use a stop loss',         auto:'no_stop_loss'},
          {text:'Max 3 trades per day',            auto:'max_daily_trades', val:3},
          {text:'Never trade FOMO setups',         auto:null},
          {text:"Don't revenge trade after a loss",auto:null},
          {text:'Only trade A+ setups',            auto:null},
          {text:'No trading the first 15 minutes', auto:null},
        ].map(r=>`<button class="rule-suggestion" onclick="addSuggestedRule(${JSON.stringify(r.text)},${JSON.stringify(r.auto||'')},${r.val||0})">+ ${esc(r.text)}</button>`).join('')}
      </div>
    </div>` :
    S.rules.map(r=>{const vc=rvc[r.id]||0;return `
    <div class="rule-item ${!r.active?'inactive':''}">
      <div class="rule-left">
        <button class="rule-toggle ${r.active?'on':'off'}" onclick="toggleRule('${esc(r.id)}')"><span class="rule-toggle-thumb"></span></button>
        <div class="rule-info">
          <div class="rule-text">${esc(r.text)}</div>
          <div class="rule-meta">
            ${r.auto?`<span class="rule-badge auto">Auto-checked</span>`:`<span class="rule-badge manual">Manual</span>`}
            ${vc>0?`<span class="rule-badge violation">${vc} violation${vc!==1?'s':''}</span>`:`<span class="rule-badge ok">✓ Clean</span>`}
          </div>
        </div>
      </div>
      <button class="rule-delete" onclick="deleteRule('${esc(r.id)}')">✕</button>
    </div>`;}).join('')}
  </div>

  ${Object.keys(S.violations).length?`
  <div class="card">
    <div class="card-title">Recent Violations</div>
    ${S.trades.filter(t=>(S.violations[t.id]||[]).length>0).slice(0,8).map(t=>{
      const vs=tradeViols(t.id), p=Number(t.pnl);
      const names=vs.map(id=>(S.rules.find(r=>r.id===id)||{text:id}).text);
      return `<div class="trade-item" onclick="viewTrade('${esc(t.id)}')">
        <div class="trade-header">
          <div class="trade-left"><span class="trade-symbol">${esc(t.symbol)}</span><span class="badge badge-violation">⚠️ ${vs.length}</span></div>
          <span class="trade-pnl ${p>=0?'positive':'negative'}">${p>=0?'+':''}$${p.toFixed(2)}</span>
        </div>
        <div class="trade-meta">${names.map(n=>`<span class="trade-meta-item" style="color:var(--amber)">⚠️ ${esc(n)}</span>`).join('')}</div>
      </div>`;
    }).join('')}
  </div>`:''}

  <!-- WEEKLY EMAIL -->
  <div class="card">
    <div class="card-title">📧 Weekly Email Summary</div>
    <p style="color:var(--text-secondary);font-size:.875rem;line-height:1.75;margin-bottom:1.25rem">
      Get a formatted weekly performance report emailed to you — P&L, win rate, best/worst trade, and strategy breakdown.
    </p>
    <button class="btn btn-primary" id="email-btn" onclick="doWeeklySummary()">Send This Week's Summary</button>
  </div>`;
}

// ── IMPORT ────────────────────────────────────────────────
function viewImport() {
  const p=S.csv;
  return `
  <div class="page-header"><h1 class="header">Import Trades</h1></div>
  <div class="card">
    <div class="card-title">Upload CSV</div>
    <div class="drop-zone" id="drop-zone" onclick="document.getElementById('csv-file').click()"
      ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleDrop(event)">
      <div style="font-size:2.5rem;margin-bottom:.75rem">📁</div>
      <h3>Drop CSV here or click to browse</h3>
      <p>Preview shown before any data is imported</p>
      <input type="file" accept=".csv" id="csv-file" style="display:none" onchange="handleCSVFile(event)">
      <button class="btn btn-primary" style="margin-top:1.25rem" onclick="event.stopPropagation();document.getElementById('csv-file').click()">Choose File</button>
    </div>
    ${p?csvPreview(p):''}
  </div>
  <div class="card">
    <div class="card-title">Expected Format</div>
    <div class="csv-table-wrap">
      <table class="csv-table">
        <thead><tr>${['symbol','asset_type','direction','entry_price','exit_price','quantity','entry_date','exit_date','strategy','commission'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody><tr>${['AAPL','stock','long','178.50','182.30','100','2025-01-10','2025-01-10','Breakout','2.00'].map(v=>`<td>${v}</td>`).join('')}</tr></tbody>
      </table>
    </div>
    <div style="margin-top:1rem"><a href="${api.getSampleCSVUrl()}" class="btn btn-secondary btn-sm" download>⬇ Download Sample CSV</a></div>
  </div>`;
}

function csvPreview(p) {
  const valid=p.rows.filter(r=>!r._error).length, errs=p.rows.filter(r=>r._error).length;
  return `<div class="csv-preview">
    <div class="csv-preview-header">
      <span>📋 <strong>${p.rows.length}</strong> rows — <span class="positive">${valid} valid</span>${errs?` · <span class="negative">${errs} errors</span>`:''}</span>
      <div style="display:flex;gap:.75rem">
        <button class="btn btn-secondary btn-sm" onclick="S.csv=null;render()">Clear</button>
        <button class="btn btn-primary btn-sm" onclick="doConfirmImport()" ${!valid?'disabled':''}>Import ${valid} Trade${valid!==1?'s':''}</button>
      </div>
    </div>
    <div class="csv-table-wrap"><table class="csv-table">
      <thead><tr><th>#</th><th>Symbol</th><th>Type</th><th>Dir</th><th>Entry</th><th>Exit</th><th>Qty</th><th>P&L</th><th>Status</th></tr></thead>
      <tbody>${p.rows.slice(0,20).map((r,i)=>`<tr>
        <td style="color:var(--text-secondary)">${i+1}</td>
        <td>${esc(r.symbol||'—')}</td><td>${esc(r.asset_type||'—')}</td>
        <td class="${r.direction==='long'?'positive':'negative'}">${esc(r.direction||'—')}</td>
        <td>${r.entry_price||'—'}</td><td>${r.exit_price||'—'}</td><td>${r.quantity||'—'}</td>
        <td class="${r.pnl>=0?'positive':'negative'}">${r.pnl!=null?(r.pnl>=0?'+':'')+'$'+r.pnl.toFixed(2):'—'}</td>
        <td class="${r._error?'row-error':'row-valid'}">${r._error?esc(r._error):'✓'}</td>
      </tr>`).join('')}</tbody>
    </table>${p.rows.length>20?`<p class="csv-more">Showing first 20 of ${p.rows.length} rows</p>`:''}</div>
    ${S.csvImporting?`<div style="margin-top:1rem"><div class="progress-bar"><div class="progress-fill" style="width:${S.csvPct}%"></div></div><div class="progress-text">Importing… ${S.csvPct}%</div></div>`:''}
  </div>`;
}

// ── BROKERS ───────────────────────────────────────────────
const BROKER_INFO = {
  alpaca:     {name:'Alpaca',              icon:'🦙', desc:'US Stocks & Crypto. Free paper + live trading API.'},
  binance:    {name:'Binance',             icon:'🟡', desc:'Crypto. Requires API key + secret from your Binance account.'},
  metatrader: {name:'MetaTrader 5',        icon:'📉', desc:'Forex & CFDs. Requires MT5 API token from your broker.'},
  ibkr:       {name:'Interactive Brokers', icon:'🏦', desc:'Coming soon — requires TWS Gateway setup.', disabled:true},
};
function viewBrokers() {
  return `
  <div class="page-header"><h1 class="header">Broker Connections</h1></div>
  ${S.brokers.length?`<div class="card"><div class="card-title">Connected Brokers</div>
    ${S.brokers.map(b=>`<div class="trade-item" style="cursor:default">
      <div class="trade-header">
        <div><span class="trade-symbol">${esc(b.broker_name)}</span>${b.account_id?`<span class="broker-account">${esc(b.account_id)}</span>`:''}</div>
        <div style="display:flex;gap:.75rem;align-items:center">
          ${b.last_sync?`<span class="broker-sync-time">Synced ${new Date(b.last_sync).toLocaleString()}</span>`:''}
          <button class="btn btn-primary btn-sm" onclick="doSyncBroker('${esc(b.id)}','${esc(b.broker_name)}')">🔄 Sync</button>
          <button class="btn btn-danger btn-sm" onclick="doDeleteBroker('${esc(b.id)}')">✕</button>
        </div>
      </div>
    </div>`).join('')}
  </div>`:''}
  <div class="card">
    <div class="card-title">Add Broker</div>
    <div class="broker-grid">
      ${Object.entries(BROKER_INFO).map(([k,b])=>`<div class="trade-item ${b.disabled?'':'broker-card'}"
        style="cursor:${b.disabled?'not-allowed':'pointer'};opacity:${b.disabled?.5:1}"
        ${!b.disabled?`onclick="showBrokerForm('${k}')"`:''}}>
        <div class="broker-icon">${b.icon}</div><div class="broker-name">${b.name}</div>
        <div class="broker-desc">${b.desc}</div>
        ${b.disabled?'<div class="broker-soon">Coming Soon</div>':''}
      </div>`).join('')}
    </div>
    <div id="broker-form"></div>
  </div>
  <div class="card"><div class="card-title">How It Works</div>
    <p style="color:var(--text-secondary);font-size:.875rem;line-height:1.75">Connect a broker, click Sync, and Quantario fetches your completed trades automatically. Duplicates are skipped. Your API keys are stored securely on the server, never in the browser.</p>
  </div>`;
}
function showBrokerForm(key) {
  const forms={
    alpaca:`<div class="form-row"><div class="form-group"><label class="form-label">API Key ID</label><input class="form-input" id="bk-key" placeholder="PKXXXXXXXXXXXXXXXX" autocomplete="off"></div><div class="form-group"><label class="form-label">API Secret</label><input type="password" class="form-input" id="bk-secret"></div></div><div class="form-group"><label class="form-label">Mode</label><select class="form-select" id="bk-paper" style="max-width:220px"><option value="true">Paper Trading</option><option value="false">Live Trading</option></select></div>`,
    binance:`<div class="form-row"><div class="form-group"><label class="form-label">API Key</label><input class="form-input" id="bk-key" autocomplete="off"></div><div class="form-group"><label class="form-label">API Secret</label><input type="password" class="form-input" id="bk-secret"></div></div>`,
    metatrader:`<div class="form-row"><div class="form-group"><label class="form-label">API Token</label><input class="form-input" id="bk-key" autocomplete="off"></div><div class="form-group"><label class="form-label">Account ID</label><input class="form-input" id="bk-account"></div></div><div class="form-group"><label class="form-label">Server URL</label><input class="form-input" id="bk-server" placeholder="https://mt5.yourbroker.com"></div>`,
  };
  const icons={alpaca:'🦙',binance:'🟡',metatrader:'📉'};
  document.getElementById('broker-form').innerHTML=`<div class="broker-form-inner">
    <h3 class="broker-form-title">${icons[key]||''} Connect ${key.charAt(0).toUpperCase()+key.slice(1)}</h3>
    ${forms[key]||''}
    <div style="display:flex;gap:.75rem;margin-top:1.25rem">
      <button class="btn btn-primary" onclick="doAddBroker('${key}')">Save Connection</button>
      <button class="btn btn-secondary" onclick="document.getElementById('broker-form').innerHTML=''">Cancel</button>
    </div>
  </div>`;
}

// ── TRADE MODAL ───────────────────────────────────────────
function openAddTrade()    { S.selectedTrade=null; S.editTrade=null; S.tradeModal=true; render(); }
function closeTradeModal() { S.tradeModal=false; S.selectedTrade=null; S.editTrade=null; render(); }
function viewTrade(id)     { S.selectedTrade=S.trades.find(t=>String(t.id)===String(id))||null; S.tradeModal=true; render(); }

function renderTradeModal() {
  const t=S.selectedTrade, isView=!!t, d=t||{};
  const pnl=Number(d.pnl);
  const assets=['stock','forex','crypto','futures','options'];
  const viols=t?tradeViols(t.id):[];
  const activeRules=S.rules.filter(r=>r.active);

  return `<div class="modal" onclick="closeTradeModal()"><div class="modal-content" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h2 class="modal-title">${isView?'Trade Details':'New Trade'}</h2>
      <div style="display:flex;gap:.5rem">
        ${isView?`<button class="btn btn-secondary btn-sm" onclick="editCurrentTrade()">✏ Edit</button>`:''}
        <button class="btn btn-secondary btn-sm" onclick="closeTradeModal()">✕ Close</button>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group"><label class="form-label">Symbol *</label><input class="form-input" id="t-sym" placeholder="AAPL, EUR/USD…" value="${esc(d.symbol||'')}" ${isView?'disabled':''} autocomplete="off"></div>
      <div class="form-group"><label class="form-label">Asset Type</label>
        <select class="form-select" id="t-at" ${isView?'disabled':''}>
          ${assets.map(v=>`<option value="${v}" ${d.asset_type===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Direction</label>
        <select class="form-select" id="t-dir" ${isView?'disabled':''}>
          <option value="long" ${d.direction==='long'?'selected':''}>Long (Buy)</option>
          <option value="short" ${d.direction==='short'?'selected':''}>Short (Sell)</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group"><label class="form-label">Entry Price *</label><input type="number" step="any" class="form-input" id="t-ep" value="${d.entry_price||''}" ${isView?'disabled':''} placeholder="0.00"></div>
      <div class="form-group"><label class="form-label">Exit Price *</label><input type="number" step="any" class="form-input" id="t-xp" value="${d.exit_price||''}" ${isView?'disabled':''} placeholder="0.00"></div>
      <div class="form-group"><label class="form-label">Quantity *</label><input type="number" step="any" class="form-input" id="t-qty" value="${d.quantity||''}" ${isView?'disabled':''} placeholder="0"></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label class="form-label">Stop Loss</label><input type="number" step="any" class="form-input" id="t-sl" value="${d.stop_loss||''}" ${isView?'disabled':''} placeholder="Optional"></div>
      <div class="form-group"><label class="form-label">Take Profit</label><input type="number" step="any" class="form-input" id="t-tp" value="${d.take_profit||''}" ${isView?'disabled':''} placeholder="Optional"></div>
      <div class="form-group"><label class="form-label">Commission</label><input type="number" step="any" class="form-input" id="t-com" value="${d.commission||0}" ${isView?'disabled':''} placeholder="0.00"></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label class="form-label">Entry Date / Time</label><input type="datetime-local" class="form-input" id="t-ed" value="${$dt(d.entry_date)}" ${isView?'disabled':''}></div>
      <div class="form-group"><label class="form-label">Exit Date / Time</label><input type="datetime-local" class="form-input" id="t-xd" value="${$dt(d.exit_date)}" ${isView?'disabled':''}></div>
    </div>

    <div class="form-row">
      <div class="form-group"><label class="form-label">Strategy</label><input class="form-input" id="t-strat" placeholder="Breakout, Trend, Scalp…" value="${esc(d.strategy||'')}" ${isView?'disabled':''}></div>
      <div class="form-group"><label class="form-label">Market Conditions</label><input class="form-input" id="t-cond" placeholder="Bullish, Ranging, News…" value="${esc(d.market_conditions||'')}" ${isView?'disabled':''}></div>
    </div>

    <div class="form-group"><label class="form-label">Notes</label>
      <textarea class="form-textarea" id="t-notes" placeholder="Reasoning, emotions, lessons learned…" ${isView?'disabled':''}>${esc(d.notes||'')}</textarea>
    </div>

    ${!isView && activeRules.length>0?`
    <div class="rule-checklist">
      <div class="rule-checklist-title">⚠️ Did you break any rules on this trade?</div>
      <div class="rule-checklist-items">
        ${activeRules.map(r=>`<label class="rule-check-item">
          <input type="checkbox" class="rule-check-input" id="rc-${esc(r.id)}" value="${esc(r.id)}">
          <span>${esc(r.text)}</span>
          ${r.auto?`<span class="rule-badge auto" style="margin-left:auto">Auto</span>`:''}
        </label>`).join('')}
      </div>
    </div>`:''}

    ${isView?`
      ${viols.length>0?`<div class="rule-violations-display">
        <div class="rule-violations-title">⚠️ Rules violated on this trade</div>
        ${viols.map(id=>{const r=S.rules.find(r=>r.id===id);return r?`<div class="rule-violation-item">${esc(r.text)}</div>`:''}).join('')}
      </div>`:''}

      <div class="pnl-result" style="border-color:${pnl>=0?'var(--cyan)':'var(--red)'}">
        <div class="stat-label">Final P&L</div>
        <div class="stat-value" style="color:${pnl>=0?'var(--cyan)':'var(--red)'}">${pnl>=0?'+':''}$${pnl.toFixed(2)}</div>
      </div>

      <div class="ai-debrief-section">
        <div class="ai-debrief-label">✨ AI Trade Debrief</div>
        ${isPremium()?`
          <button class="btn btn-ai btn-sm" id="ai-debrief-btn" onclick="doAIDebrief('${esc(d.id)}')">
            ${S.aiDebrief.tradeId===d.id&&S.aiDebrief.loading?'<span class="spinner"></span> Analysing…':S.aiDebrief.tradeId===d.id&&S.aiDebrief.text?'↺ New Debrief':'✨ Get AI Debrief'}
          </button>
          ${S.aiDebrief.tradeId===d.id&&(S.aiDebrief.text||S.aiDebrief.loading)
            ?`<div class="ai-debrief-card" id="ai-debrief-container"><div class="ai-debrief-text" id="ai-debrief-text">${esc(S.aiDebrief.text)}</div>${S.aiDebrief.loading?'<span class="ai-cursor"></span>':''}</div>`
            :'<div class="ai-debrief-card" id="ai-debrief-container" style="display:none"><div class="ai-debrief-text" id="ai-debrief-text"></div></div>'}
        `:aiLocked('Get AI Debrief')}
      </div>

      <div class="modal-actions">
        <button class="btn btn-danger" onclick="doDeleteTrade('${esc(d.id)}')">Delete Trade</button>
        <button class="btn btn-secondary" onclick="closeTradeModal()">Close</button>
      </div>`:`
      <div class="modal-actions">
        <button class="btn btn-primary" id="save-btn" onclick="doSaveTrade()">Save Trade</button>
        <button class="btn btn-secondary" onclick="closeTradeModal()">Cancel</button>
      </div>`}
  </div></div>`;
}

function editCurrentTrade() {
  if(!S.selectedTrade) return;
  const t=S.trades.find(tr=>String(tr.id)===String(S.selectedTrade.id));
  if(!t) return;
  S.selectedTrade=null; S.editTrade=t; S.tradeModal=true; render();
  requestAnimationFrame(()=>{
    const flds={
      't-sym':t.symbol,'t-at':t.asset_type,'t-dir':t.direction,
      't-ep':t.entry_price,'t-xp':t.exit_price,'t-qty':t.quantity,
      't-sl':t.stop_loss,'t-tp':t.take_profit,'t-com':t.commission,
      't-strat':t.strategy,'t-cond':t.market_conditions,'t-notes':t.notes,
      't-ed':$dt(t.entry_date),'t-xd':$dt(t.exit_date),
    };
    Object.entries(flds).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val||'';});
    const btn=document.getElementById('save-btn');
    if(btn){btn.textContent='Update Trade';btn.onclick=()=>doUpdateTrade(t.id);}
    const ttl=document.querySelector('.modal-title');
    if(ttl)ttl.textContent='Edit Trade';
  });
}

// ── GOALS MODAL ───────────────────────────────────────────
function openGoalsModal() {
  const g=S.goals;
  const o=document.createElement('div'); o.className='confirm-overlay';
  o.innerHTML=`<div class="confirm-box" style="max-width:460px;width:92vw">
    <div style="font-size:1.1rem;font-weight:800;margin-bottom:.25rem">🎯 Trading Goals</div>
    <div style="color:var(--text-secondary);font-size:.8rem;margin-bottom:1.5rem">Set targets to keep yourself accountable each month</div>
    <div class="form-group"><label class="form-label">Monthly P&L Target ($)</label><input type="number" class="form-input" id="g-mpnl" value="${g.monthlyPnL||''}" placeholder="e.g. 5000"></div>
    <div class="form-group"><label class="form-label">Daily Max Loss ($, enter negative e.g. -500)</label><input type="number" class="form-input" id="g-dml" value="${g.dailyMaxLoss||''}" placeholder="e.g. -500"></div>
    <div class="form-group"><label class="form-label">Win Rate Target (%)</label><input type="number" class="form-input" id="g-wr" value="${g.winRate||''}" placeholder="e.g. 60"></div>
    <div class="form-group"><label class="form-label">Max Trades Per Day</label><input type="number" class="form-input" id="g-mtd" value="${g.maxDayTrades||''}" placeholder="e.g. 5"></div>
    <div class="confirm-actions" style="margin-top:1.5rem">
      <button class="btn btn-secondary btn-sm" id="g-cancel">Cancel</button>
      <button class="btn btn-primary btn-sm" id="g-save">Save Goals</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  o.querySelector('#g-cancel').onclick=()=>o.remove();
  o.onclick=e=>{if(e.target===o)o.remove();};
  o.querySelector('#g-save').onclick=()=>{
    saveGoals({
      monthlyPnL:  parseFloat(document.getElementById('g-mpnl').value)||null,
      dailyMaxLoss:parseFloat(document.getElementById('g-dml').value)||null,
      winRate:     parseFloat(document.getElementById('g-wr').value)||null,
      maxDayTrades:parseInt(document.getElementById('g-mtd').value)||null,
    });
    o.remove(); toast('Goals saved!','success'); render();
  };
  setTimeout(()=>document.getElementById('g-mpnl')?.focus(),50);
}

// ── RULES MANAGEMENT ──────────────────────────────────────
function openAddRule() {
  const o=document.createElement('div'); o.className='confirm-overlay';
  o.innerHTML=`<div class="confirm-box" style="max-width:460px;width:92vw">
    <div style="font-size:1.1rem;font-weight:800;margin-bottom:.25rem">📋 Add Rule</div>
    <div style="color:var(--text-secondary);font-size:.8rem;margin-bottom:1.5rem">Define a rule you commit to following on every trade</div>
    <div class="form-group"><label class="form-label">Rule Text *</label><input class="form-input" id="r-text" placeholder="e.g. Always use a stop loss" autocomplete="off"></div>
    <div class="form-group"><label class="form-label">Auto-check (optional)</label>
      <select class="form-select" id="r-auto">
        <option value="">Manual only</option>
        <option value="no_stop_loss">Auto: flag trades with no stop loss</option>
        <option value="max_daily_trades">Auto: flag if max daily trades exceeded</option>
      </select>
    </div>
    <div class="form-group" id="r-val-group" style="display:none"><label class="form-label">Max trades per day</label><input type="number" class="form-input" id="r-val" placeholder="e.g. 3" min="1"></div>
    <div class="confirm-actions" style="margin-top:1.5rem">
      <button class="btn btn-secondary btn-sm" id="r-cancel">Cancel</button>
      <button class="btn btn-primary btn-sm" id="r-add">Add Rule</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  const sel=o.querySelector('#r-auto');
  sel.onchange=()=>{o.querySelector('#r-val-group').style.display=sel.value==='max_daily_trades'?'block':'none';};
  o.querySelector('#r-cancel').onclick=()=>o.remove();
  o.onclick=e=>{if(e.target===o)o.remove();};
  o.querySelector('#r-add').onclick=()=>{
    const text=(document.getElementById('r-text').value||'').trim();
    if(!text){toast('Rule text is required','error');return;}
    const auto=document.getElementById('r-auto').value||null;
    const val=auto==='max_daily_trades'?parseInt(document.getElementById('r-val').value)||3:null;
    saveRules([...S.rules,{id:`r${Date.now()}`,text,auto,val,active:true}]);
    o.remove(); toast('Rule added!','success'); render();
  };
  setTimeout(()=>document.getElementById('r-text')?.focus(),50);
}

function addSuggestedRule(text, auto, val) {
  if(S.rules.find(r=>r.text===text)){toast('That rule already exists','warn');return;}
  saveRules([...S.rules,{id:`r${Date.now()}`,text,auto:auto||null,val:val||null,active:true}]);
  toast('Rule added!','success'); render();
}
function toggleRule(id) { saveRules(S.rules.map(r=>r.id===id?{...r,active:!r.active}:r)); render(); }
function deleteRule(id) {
  showConfirm('Delete this rule?',()=>{
    saveRules(S.rules.filter(r=>r.id!==id));
    const v={...S.violations};
    Object.keys(v).forEach(tid=>{v[tid]=v[tid].filter(rid=>rid!==id);});
    saveViolations(v); toast('Rule deleted','info'); render();
  },{label:'Delete',cls:'btn-danger'});
}

function collectManualViols() {
  return S.rules.filter(r=>{const cb=document.getElementById(`rc-${r.id}`);return cb&&cb.checked;}).map(r=>r.id);
}

// ── EMAIL ─────────────────────────────────────────────────
async function doWeeklySummary() {
  const btn=document.getElementById('email-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Sending…';}
  try {
    const res=await api.sendWeeklySummary();
    toast(res.message||'Weekly summary sent!','success',5000);
  } catch(err) {
    if(err.message.includes('not configured')) {
      toast('Email not configured on server. Set SMTP_USER and SMTP_PASS in Render env vars.','warn',7000);
    } else {
      toast(`Failed: ${err.message}`,'error');
    }
  } finally {
    if(btn){btn.disabled=false;btn.textContent="Send This Week's Summary";}
  }
}

// ── JOURNAL ACTIONS ───────────────────────────────────────
async function doSaveJournal() {
  const btn=document.getElementById('j-save');
  const date=document.getElementById('j-date').value;
  if(!date){toast('Date is required','error');return;}
  let content='';
  if(S.jTab==='structured'){
    const setup =(document.getElementById('j-setup')?.value||'').trim();
    const plan  =(document.getElementById('j-plan')?.value||'').trim();
    const exec  =(document.getElementById('j-exec')?.value||'').trim();
    const lesson=(document.getElementById('j-lesson')?.value||'').trim();
    if(!setup&&!plan&&!exec&&!lesson){toast('Fill in at least one section','error');return;}
    if(setup)  content+=`## Setup\n${setup}\n\n`;
    if(plan)   content+=`## Plan\n${plan}\n\n`;
    if(exec)   content+=`## Execution\n${exec}\n\n`;
    if(lesson) content+=`## Lesson\n${lesson}`;
    content=content.trim();
  } else {
    content=(document.getElementById('j-content')?.value||'').trim();
    if(!content){toast('Entry content is required','error');return;}
  }
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Saving…';}
  try {
    S.syncing=true;
    const res=await api.createJournal({entry_date:date,content});
    S.journal.unshift(res.data); S.syncing=false;
    toast('Journal entry saved!','success'); render();
  } catch(err){S.syncing=false;toast(`Save failed: ${err.message}`,'error');if(btn){btn.disabled=false;btn.textContent='Save Entry';}}
}
async function doDeleteJournal(id) {
  showConfirm('Delete this journal entry?',async()=>{
    try{await api.deleteJournal(id);S.journal=S.journal.filter(e=>String(e.id)!==String(id));toast('Entry deleted','info');render();}
    catch(err){toast(`Delete failed: ${err.message}`,'error');}
  });
}

// ── TRADE CRUD ────────────────────────────────────────────
function getTradeFields() {
  return {
    symbol:(document.getElementById('t-sym')?.value||'').trim().toUpperCase(),
    ep:parseFloat(document.getElementById('t-ep')?.value),
    xp:parseFloat(document.getElementById('t-xp')?.value),
    qty:parseFloat(document.getElementById('t-qty')?.value),
    asset_type:document.getElementById('t-at')?.value,
    direction:document.getElementById('t-dir')?.value,
    commission:parseFloat(document.getElementById('t-com')?.value)||0,
    entry_date:document.getElementById('t-ed')?.value||null,
    exit_date:document.getElementById('t-xd')?.value||null,
    stop_loss:parseFloat(document.getElementById('t-sl')?.value)||null,
    take_profit:parseFloat(document.getElementById('t-tp')?.value)||null,
    strategy:document.getElementById('t-strat')?.value||null,
    notes:document.getElementById('t-notes')?.value||null,
    market_conditions:document.getElementById('t-cond')?.value||null,
  };
}
function validateFields(f) {
  if(!f.symbol||isNaN(f.ep)||isNaN(f.xp)||isNaN(f.qty)){toast('Symbol, entry price, exit price and quantity are required','error');return false;}
  if(f.qty<=0){toast('Quantity must be greater than zero','error');return false;}
  return true;
}
async function doSaveTrade() {
  const f=getTradeFields(); if(!validateFields(f)) return;
  const manualV=collectManualViols();
  const btn=document.getElementById('save-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Saving…';}
  try {
    S.syncing=true;
    const res=await api.createTrade({symbol:f.symbol,entry_price:f.ep,exit_price:f.xp,quantity:f.qty,asset_type:f.asset_type,direction:f.direction,commission:f.commission,entry_date:f.entry_date,exit_date:f.exit_date,stop_loss:f.stop_loss,take_profit:f.take_profit,strategy:f.strategy,notes:f.notes,market_conditions:f.market_conditions});
    S.trades.unshift(res.data);
    const autoV=autoCheck(res.data);
    const allV=[...new Set([...manualV,...autoV])];
    if(allV.length){saveViolations({...S.violations,[res.data.id]:allV});}
    S.syncing=false;
    const pnl=Number(res.data.pnl);
    toast(`${f.symbol} saved — ${pnl>=0?'+':''}$${pnl.toFixed(2)}${allV.length?` · ⚠️ ${allV.length} rule violation${allV.length>1?'s':''}`:''}`,'success');
    closeTradeModal();
  } catch(err){S.syncing=false;toast(`Save failed: ${err.message}`,'error');if(btn){btn.disabled=false;btn.textContent='Save Trade';}}
}
async function doUpdateTrade(id) {
  const f=getTradeFields(); if(!validateFields(f)) return;
  const btn=document.getElementById('save-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Saving…';}
  try {
    S.syncing=true;
    const res=await api.updateTrade(id,{symbol:f.symbol,entry_price:f.ep,exit_price:f.xp,quantity:f.qty,asset_type:f.asset_type,direction:f.direction,commission:f.commission,entry_date:f.entry_date,exit_date:f.exit_date,stop_loss:f.stop_loss,take_profit:f.take_profit,strategy:f.strategy,notes:f.notes,market_conditions:f.market_conditions});
    const idx=S.trades.findIndex(t=>String(t.id)===String(id));
    if(idx>=0)S.trades[idx]=res.data;
    S.syncing=false; toast(`${f.symbol} updated!`,'success'); closeTradeModal();
  } catch(err){S.syncing=false;toast(`Update failed: ${err.message}`,'error');if(btn){btn.disabled=false;btn.textContent='Update Trade';}}
}
async function doDeleteTrade(id) {
  showConfirm('Delete this trade? This cannot be undone.',async()=>{
    try{
      S.syncing=true; await api.deleteTrade(id);
      S.trades=S.trades.filter(t=>String(t.id)!==String(id));
      const v={...S.violations}; delete v[id]; saveViolations(v);
      S.syncing=false; S.tradeModal=false; S.selectedTrade=null;
      toast('Trade deleted','info'); render();
    }catch(err){S.syncing=false;toast(`Delete failed: ${err.message}`,'error');}
  });
}

// ── CSV IMPORT ────────────────────────────────────────────
function handleDrop(e){e.preventDefault();document.getElementById('drop-zone').classList.remove('dragover');const f=e.dataTransfer.files[0];if(f?.name.endsWith('.csv')){if(f.size>5242880){toast('CSV must be under 5MB','error');return;}uploadCSV(f);}else toast('Please drop a .csv file','error');}
function handleCSVFile(e){const f=e.target.files[0];if(!f)return;if(f.size>5242880){toast('CSV must be under 5MB','error');e.target.value='';return;}uploadCSV(f);}
async function uploadCSV(file){const fd=new FormData();fd.append('file',file);try{toast('Parsing CSV…','info',2000);const res=await api.previewCSV(fd);S.csv=res.data;render();}catch(err){toast(`Parse error: ${err.message}`,'error');}}
async function doConfirmImport(){
  if(!S.csv)return;const valid=S.csv.rows.filter(r=>!r._error);
  S.csvImporting=true;S.csvPct=10;render();
  try{S.csvPct=50;render();const res=await api.confirmImport(valid);S.csvPct=100;const fresh=await api.getTrades();S.trades=fresh.data;S.csv=null;S.csvImporting=false;toast(`Imported ${res.imported} trade${res.imported!==1?'s':''}!`,'success');render();}
  catch(err){S.csvImporting=false;toast(`Import failed: ${err.message}`,'error');render();}
}

// ── BROKER ACTIONS ────────────────────────────────────────
async function doAddBroker(key){const k=document.getElementById('bk-key')?.value?.trim();if(!k){toast('API key is required','error');return;}try{const res=await api.addBroker({broker_name:key,api_key:k,api_secret:document.getElementById('bk-secret')?.value?.trim(),account_id:document.getElementById('bk-account')?.value?.trim()});S.brokers.push(res.data);toast(`${key} connected!`,'success');render();}catch(err){toast(`Connection failed: ${err.message}`,'error');}}
async function doSyncBroker(id,name){toast(`Syncing ${name}…`,'info',3000);try{const res=await api.syncBroker(id);const cnt=res.imported??res.inserted??0;if(cnt>0){const f=await api.getTrades();S.trades=f.data;}const idx=S.brokers.findIndex(b=>b.id===id);if(idx>=0)S.brokers[idx].last_sync=new Date().toISOString();toast(`Synced ${cnt} new trade${cnt!==1?'s':''} from ${name}`,cnt>0?'success':'info');render();}catch(err){toast(`Sync failed: ${err.message}`,'error');}}
async function doDeleteBroker(id){showConfirm('Remove this broker connection?',async()=>{try{await api.deleteBroker(id);S.brokers=S.brokers.filter(b=>b.id!==id);toast('Broker removed','info');render();}catch(err){toast(`Delete failed: ${err.message}`,'error');}},{label:'Remove',cls:'btn-danger'});}

// ── PROFILE ───────────────────────────────────────────────
function openProfileModal()  { S.profileModal=true;  render(); }
function closeProfileModal() { S.profileModal=false; render(); }
function renderProfileModal() {
  const user=getUser()||{}, ini=(user.name||'U').charAt(0).toUpperCase(), ps=calcStats(S.trades);
  return `<div class="modal" onclick="closeProfileModal()"><div class="modal-content" style="max-width:520px" onclick="event.stopPropagation()">
    <div class="modal-header"><h2 class="modal-title">Profile &amp; Settings</h2><button class="btn btn-secondary btn-sm" onclick="closeProfileModal()">✕ Close</button></div>
    <div class="profile-header">
      <div class="profile-avatar">${esc(ini)}</div>
      <div><div class="profile-name">${esc(user.name||'User')}</div><div class="profile-email">${esc(user.email||'')}</div>
      <div class="profile-joined">Member since ${user.created_at?new Date(user.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'—'}</div></div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><div class="profile-stat-value">${S.trades.length}</div><div class="profile-stat-label">Total Trades</div></div>
      <div class="profile-stat"><div class="profile-stat-value">${S.journal.length}</div><div class="profile-stat-label">Journal Entries</div></div>
      <div class="profile-stat"><div class="profile-stat-value ${ps.pnl>=0?'positive':'negative'}">${ps.pnl>=0?'+':''}$${ps.pnl.toFixed(0)}</div><div class="profile-stat-label">Total P&L</div></div>
      <div class="profile-stat"><div class="profile-stat-value">${ps.wr}%</div><div class="profile-stat-label">Win Rate</div></div>
    </div>
    <div class="profile-section-title">Edit Profile</div>
    <div class="form-group"><label class="form-label">Display Name</label><input class="form-input" id="p-name" value="${esc(user.name||'')}" placeholder="Your name"></div>
    <div style="margin-bottom:1.5rem"><button class="btn btn-primary btn-sm" id="p-name-btn" onclick="doUpdateName()">Update Name</button></div>
    <div class="profile-section-title">Change Password</div>
    <div class="form-group"><label class="form-label">Current Password</label><input type="password" class="form-input" id="p-cur" placeholder="Current password" autocomplete="current-password"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">New Password</label><input type="password" class="form-input" id="p-new" placeholder="Min 6 characters" autocomplete="new-password"></div>
      <div class="form-group"><label class="form-label">Confirm New</label><input type="password" class="form-input" id="p-cfm" placeholder="Repeat" autocomplete="new-password"></div>
    </div>
    <div style="margin-bottom:1.5rem"><button class="btn btn-secondary btn-sm" id="p-pw-btn" onclick="doUpdatePw()">Change Password</button></div>
    <div class="profile-section-title danger">Danger Zone</div>
    <div class="danger-zone"><div><div style="font-weight:600;margin-bottom:.25rem">Export My Data</div><div style="font-size:.8rem;color:var(--text-secondary)">Download all trades as CSV</div></div><button class="btn btn-secondary btn-sm" onclick="doExport()">⬇ Export</button></div>
    <div class="danger-zone" style="margin-top:.75rem"><div><div style="font-weight:600;margin-bottom:.25rem;color:var(--red)">Delete Account</div><div style="font-size:.8rem;color:var(--text-secondary)">Permanently delete account and all data</div></div><button class="btn btn-danger btn-sm" onclick="doDeleteAccount()">Delete</button></div>
  </div></div>`;
}
async function doUpdateName(){const name=document.getElementById('p-name').value.trim();if(!name){toast('Name cannot be empty','error');return;}const btn=document.getElementById('p-name-btn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>';try{const res=await api.updateProfile({name});saveAuth(res.token,res.user);toast('Name updated!','success');btn.disabled=false;btn.textContent='Update Name';render();}catch(err){toast(err.message,'error');btn.disabled=false;btn.textContent='Update Name';}}
async function doUpdatePw(){const cur=document.getElementById('p-cur').value,nw=document.getElementById('p-new').value,cf=document.getElementById('p-cfm').value;if(!cur||!nw){toast('All fields required','error');return;}if(nw.length<6){toast('Min 6 characters','error');return;}if(nw!==cf){toast('Passwords do not match','error');return;}const btn=document.getElementById('p-pw-btn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>';try{await api.updateProfile({currentPassword:cur,newPassword:nw});toast('Password changed!','success');['p-cur','p-new','p-cfm'].forEach(id=>{document.getElementById(id).value='';});btn.disabled=false;btn.textContent='Change Password';}catch(err){toast(err.message,'error');btn.disabled=false;btn.textContent='Change Password';}}
function doExport(){if(!S.trades.length){toast('No trades to export','warn');return;}const hdrs=['symbol','asset_type','direction','entry_price','exit_price','quantity','pnl','commission','entry_date','exit_date','strategy','market_conditions','notes','broker'];const rows=S.trades.map(t=>hdrs.map(h=>{const v=t[h]==null?'':String(t[h]);return v.includes(',')||v.includes('"')||v.includes('\n')?`"${v.replace(/"/g,'""')}"`:''+v;}).join(','));const csv=[hdrs.join(','),...rows].join('\n');const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`quantario-${$date()}.csv`;a.click();URL.revokeObjectURL(url);toast('Export downloaded!','success');}
async function doDeleteAccount(){showConfirm('Permanently delete your account and all data? This cannot be undone.',()=>{showPrompt('Enter your password to confirm:',async pw=>{if(!pw)return;try{await api.deleteAccount({password:pw,confirmText:'DELETE'});toast('Account deleted. Goodbye!','info',3000);setTimeout(()=>{clearAuth();window.location.href='/login';},2000);}catch(err){toast(err.message,'error');};},'Your password')},{label:'Continue',cls:'btn-danger',mustType:'DELETE',ph:'Type DELETE to confirm'});}

// ── AI ────────────────────────────────────────────────────
function doAIDebrief(tradeId){
  const trade=S.trades.find(t=>String(t.id)===String(tradeId))||S.selectedTrade;
  if(!trade){toast('Trade not found','error');return;}
  if(!isPremium()){S.upgradeModal=true;render();return;}
  S.aiDebrief={loading:true,text:'',tradeId:trade.id};
  const btn=document.getElementById('ai-debrief-btn'),ctr=document.getElementById('ai-debrief-container'),txt=document.getElementById('ai-debrief-text');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Analysing…';}
  if(ctr){ctr.style.display='block';}
  if(txt){txt.textContent='';}
  if(ctr&&!ctr.querySelector('.ai-cursor')){const c=document.createElement('span');c.className='ai-cursor';ctr.appendChild(c);}
  streamAI('/ai/debrief',{trade},
    chunk=>{S.aiDebrief.text+=chunk;if(txt)txt.textContent=S.aiDebrief.text;},
    ()=>{S.aiDebrief.loading=false;ctr?.querySelector('.ai-cursor')?.remove();if(btn){btn.disabled=false;btn.innerHTML='↺ New Debrief';}},
    err=>{S.aiDebrief.loading=false;ctr?.querySelector('.ai-cursor')?.remove();if(err==='upgrade'){S.upgradeModal=true;render();return;}if(txt)txt.textContent='⚠️ '+err;if(btn){btn.disabled=false;btn.innerHTML='✨ Get AI Debrief';}}
  );
}
function doAIPatterns(){
  if(!isPremium()){S.upgradeModal=true;render();return;}
  S.aiPatterns={loading:true,text:'',ran:true};
  const btn=document.getElementById('ai-patterns-btn'),txt=document.getElementById('ai-patterns-text');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Analysing…';}
  if(txt){txt.innerHTML='<span class="ai-cursor"></span>';}
  let acc='';
  streamAI('/ai/patterns',{},
    chunk=>{acc+=chunk;S.aiPatterns.text=acc;if(txt){txt.innerHTML=esc(acc).replace(/\n/g,'<br>')+'<span class="ai-cursor"></span>';}},
    ()=>{S.aiPatterns.loading=false;if(txt)txt.innerHTML=esc(acc).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');if(btn){btn.disabled=false;btn.innerHTML='↺ Re-analyse';}},
    err=>{S.aiPatterns.loading=false;S.aiPatterns.text='';if(err==='upgrade'){S.upgradeModal=true;render();return;}toast(err,'error');if(btn){btn.disabled=false;btn.innerHTML='Analyse My Trades';}}
  );
}
function doAIDraft(){
  if(!isPremium()){S.upgradeModal=true;render();return;}
  const btn=document.getElementById('ai-draft-btn');
  const textarea=S.jTab==='quick'?document.getElementById('j-content'):document.getElementById('j-exec');
  if(!textarea)return;
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Drafting…';}
  const existing=textarea.value.trim();
  textarea.value=''; textarea.placeholder='AI is writing your draft…';
  let acc='';
  streamAI('/ai/journal-draft',{existingText:existing},
    chunk=>{acc+=chunk;textarea.value=acc;textarea.scrollTop=textarea.scrollHeight;},
    ()=>{textarea.placeholder='';if(btn){btn.disabled=false;btn.innerHTML="✨ Draft from Today's Trades";}toast('Draft ready — edit and save!','success');},
    err=>{textarea.value=existing;textarea.placeholder='';if(err==='upgrade'){S.upgradeModal=true;render();return;}toast(err,'error');if(btn){btn.disabled=false;btn.innerHTML="✨ Draft from Today's Trades";}}
  );
}

// ── AUTH + NAV ────────────────────────────────────────────
function handleLogout(){showConfirm('Log out of Quantario?',()=>{clearAuth();window.location.href='/login';},{label:'Log out',cls:'btn-secondary'});}
function go(v){S.view=v;document.getElementById('mobile-more-sheet')?.remove();render();const mc=document.querySelector('.main-content');if(mc)mc.scrollTop=0;window.scrollTo(0,0);}

function toggleMore(){
  const existing=document.getElementById('mobile-more-sheet');
  if(existing){existing.remove();return;}
  const sheet=document.createElement('div');
  sheet.id='mobile-more-sheet'; sheet.className='mobile-more-sheet';
  const items=[
    {id:'journal',label:'Journal',icon:ICO.journal},
    {id:'calendar',label:'Calendar',icon:ICO.calendar},
    {id:'rules',label:'Rules',icon:ICO.rules},
    {id:'import',label:'Import',icon:ICO.import},
    {id:'brokers',label:'Brokers',icon:ICO.brokers},
  ];
  sheet.innerHTML=`<div class="mobile-more-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="mobile-more-content">
      <div class="mobile-more-handle"></div>
      <div class="mobile-more-title">More</div>
      <div class="mobile-more-grid">
        ${items.map(i=>`<button class="mobile-more-item ${S.view===i.id?'active':''}"
          onclick="document.getElementById('mobile-more-sheet')?.remove();go('${i.id}')">
          <span class="mobile-more-icon">${i.icon}</span><span>${i.label}</span>
        </button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(sheet);
}

// ── INIT ──────────────────────────────────────────────────
async function init(){
  S.loading=true; render();
  try{
    const [t,j,b]=await Promise.allSettled([api.getTrades(),api.getJournal(),api.getBrokers()]);
    if(t.status==='fulfilled')S.trades=t.value.data;
    if(j.status==='fulfilled')S.journal=j.value.data;
    if(b.status==='fulfilled')S.brokers=b.value.data;
    if(t.status==='rejected'&&j.status==='rejected'&&b.status==='rejected')
      toast('Could not reach server. Check your connection.','error',7000);
    // Re-run auto-check violations on loaded trades
    if(S.rules.length&&S.trades.length){
      const v={...S.violations};
      S.trades.forEach(trade=>{
        const av=autoCheck(trade);
        if(av.length){const ex=v[trade.id]||[];av.forEach(id=>{if(!ex.includes(id))ex.push(id);});v[trade.id]=ex;}
      });
      saveViolations(v);
    }
  }catch(err){toast('Could not reach server. Check your connection.','error',7000);}
  S.loading=false; render();
}
init();
