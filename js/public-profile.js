/* public-profile.js — Mirror Journal Page */
const PublicProfile = {
    _profile:null, _journal:[], _methods:[], _chart:null,

    init() {
        this._bindTabs();
        window.addEventListener('hashchange', ()=>{
            const m=location.hash.match(/^#\/u\/([a-z0-9_]+)$/i);
            if(m){App.navigateTo('profile');this.load(m[1]);}
        });
        document.getElementById('pub-modal-close')?.addEventListener('click',()=>this._closeModal());
        document.getElementById('pub-detail-modal')?.addEventListener('click',e=>{
            if(e.target===document.getElementById('pub-detail-modal'))this._closeModal();
        });
        document.addEventListener('keydown',e=>{if(e.key==='Escape'){this._closeModal();this._closeLb();}});
        this._initLb();
    },

    _bindTabs(){
        document.addEventListener('click',e=>{
            const btn=e.target.closest('[data-pubtab]');
            if(!btn)return;
            document.querySelectorAll('[data-pubtab]').forEach(b=>b.classList.remove('journal-tab-btn--active'));
            btn.classList.add('journal-tab-btn--active');
            document.querySelectorAll('.pub-tab-panel').forEach(p=>p.style.display='none');
            const p=document.getElementById(btn.dataset.pubtab);
            if(p)p.style.display='';
            if(btn.dataset.pubtab==='pub-tab-stats')this._renderStats();
        });
    },

    async load(username){
        this._show('loading');
        if(this._chart){this._chart.destroy();this._chart=null;}
        const profile=await Storage.getPublicProfile(username);
        if(!profile||(!profile.is_journal_public&&!profile.is_methods_public))return this._show('notfound');
        this._profile=profile;
        const[j,m]=await Promise.all([
            profile.is_journal_public?Storage.getPublicJournal(profile.id):Promise.resolve([]),
            profile.is_methods_public?Storage.getPublicMethods(profile.id):Promise.resolve([]),
        ]);
        this._journal=j;this._methods=m;
        document.querySelectorAll('[data-pubtab]').forEach((b,i)=>b.classList.toggle('journal-tab-btn--active',i===0));
        document.querySelectorAll('.pub-tab-panel').forEach((p,i)=>p.style.display=i===0?'':'none');
        this._renderHeader();
        this._renderStatsBar();
        this._renderJournal();
        this._renderGallery();
        this._renderMethods();
        const h=`#/u/${username}`;
        if(location.hash!==h)history.replaceState(null,'',h);
        this._show('content');
    },

    _show(s){
        document.getElementById('pub-profile-loading').style.display=s==='loading'?'flex':'none';
        document.getElementById('pub-profile-notfound').style.display=s==='notfound'?'flex':'none';
        document.getElementById('pub-profile-content').style.display=s==='content'?'':'none';
    },

    _renderHeader(){
        const p=this._profile,el=document.getElementById('pub-profile-header');
        if(!el||!p)return;
        const init=(p.full_name||p.username||'??').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
        const tp=this._journal.filter(e=>e.status==='tp').length,sl=this._journal.filter(e=>e.status==='sl').length;
        const tot=this._journal.length,wr=tot>0?((tp/tot)*100).toFixed(1):'—';
        const net=this._journal.reduce((s,e)=>s+(e.status==='tp'?(e.potentialProfit||0):-(e.potentialLoss||0)),0);
        const clr=net>=0?'var(--clr-tp)':'var(--clr-sl)',sign=net>=0?'+':'';
        const joined=new Date(p.created_at).toLocaleDateString('id-ID',{year:'numeric',month:'long'});
        const url=`${location.origin}${location.pathname}#/u/${p.username}`;
        el.innerHTML=`
        <div class="pub-header-avatar">${init}</div>
        <div class="pub-header-info">
          <div class="pub-header-name">${this._e(p.full_name||p.username)}</div>
          <div class="pub-header-username">@${this._e(p.username)}</div>
          ${p.bio?`<div class="pub-header-bio">${this._e(p.bio)}</div>`:''}
          <div class="pub-header-meta">Bergabung ${joined}</div>
        </div>
        <div class="pub-header-stats">
          ${p.is_journal_public?`
          <div class="pub-stat-pill"><div class="pub-stat-pill__val" style="color:${clr}">${sign}$${Math.abs(net).toFixed(2)}</div><div class="pub-stat-pill__lbl">Net P&amp;L</div></div>
          <div class="pub-stat-pill"><div class="pub-stat-pill__val">${wr}%</div><div class="pub-stat-pill__lbl">Win Rate</div></div>
          <div class="pub-stat-pill"><div class="pub-stat-pill__val">${tot}</div><div class="pub-stat-pill__lbl">Total Trade</div></div>`:''}
          <button class="pub-share-btn" onclick="navigator.clipboard.writeText('${url}').then(()=>App.showToast('Link disalin!','success'))">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Bagikan
          </button>
        </div>`;
    },

    _renderStatsBar(){
        const bar=document.getElementById('pub-stats-bar');if(!bar)return;
        const j=this._journal;
        const open=j.filter(e=>e.status==='open').length,tp=j.filter(e=>e.status==='tp').length,sl=j.filter(e=>e.status==='sl').length;
        const wr=(tp+sl)>0?Math.round(tp/(tp+sl)*100):0;
        bar.innerHTML=`<div class="journal-top-stats">
          <div class="journal-top-stat"><span class="journal-top-stat__label">Terbuka</span><span class="journal-top-stat__value">${open}</span></div>
          <div class="journal-top-stat"><span class="journal-top-stat__label">Hit TP</span><span class="journal-top-stat__value" style="color:var(--clr-tp)">${tp}</span></div>
          <div class="journal-top-stat"><span class="journal-top-stat__label">Hit SL</span><span class="journal-top-stat__value" style="color:var(--clr-sl)">${sl}</span></div>
          <div class="journal-top-stat"><span class="journal-top-stat__label">Win Rate</span><span class="journal-top-stat__value">${wr}%</span></div>
        </div>`;
    },

    _renderJournal(){
        const panel=document.getElementById('pub-tab-journal');if(!panel)return;
        if(!this._profile?.is_journal_public){panel.innerHTML='<div class="pub-private-notice">🔒 Jurnal bersifat privat</div>';return;}
        panel.innerHTML=`<div style="margin-bottom:var(--space-sm)">
          <select class="form-group__select" id="pub-jfilter" style="font-size:12px;padding:6px 12px;height:auto;width:auto">
            <option value="all">Semua Trade</option><option value="tp">Win (TP)</option><option value="sl">Loss (SL)</option>
          </select></div><div id="pub-jlist"></div>`;
        panel.querySelector('#pub-jfilter').addEventListener('change',()=>this._filterJ());
        this._filterJ();
    },

    _filterJ(){
        const f=document.getElementById('pub-jfilter')?.value||'all';
        const list=document.getElementById('pub-jlist');if(!list)return;
        let entries=this._journal;
        if(f==='tp')entries=entries.filter(e=>e.status==='tp');
        if(f==='sl')entries=entries.filter(e=>e.status==='sl');
        if(!entries.length){list.innerHTML='<div class="empty-state" style="margin-top:var(--space-xl)"><div class="empty-state__icon">📓</div><div class="empty-state__text">Belum ada trade</div></div>';return;}
        list.innerHTML='';
        entries.forEach(en=>list.appendChild(this._card(en)));
    },

    _card(e){
        const sc={open:'open',tp:'closed-tp',sl:'closed-sl'}[e.status]||'open';
        const sl2={open:'Open',tp:'Hit TP ✅',sl:'Hit SL ❌'}[e.status]||'';
        const bc={open:'badge--open',tp:'badge--tp',sl:'badge--sl'}[e.status]||'badge--open';
        const bi=(e.beforeImages||[])[0],ai=(e.afterImages||[])[0];
        const card=document.createElement('div');
        card.className=`journal-entry ${sc}`;
        card.innerHTML=`
        <div class="journal-entry__header">
          <div class="journal-entry__title-row">
            <span class="journal-entry__pair">${this._e(e.pair)}</span>
            ${e.methodName?`<span class="journal-entry__strategy">${this._e(e.methodName)}</span>`:''}
            ${e.emotion&&e.emotion!=='—'?`<span class="emotion-chip">${this._e(e.emotion)}</span>`:''}
            ${(e.newsTags||[]).length?`<span class="journal-entry__strategy" style="background:rgba(239,68,68,.15);color:var(--clr-sl);border:1px solid rgba(239,68,68,.3)">🔥 ${this._e(e.newsTags.join(', '))}</span>`:''}
          </div>
          <span class="journal-entry__status-badge ${bc}">${sl2}</span>
        </div>
        <div class="journal-entry__content">
          <div class="journal-entry__body">
            <div class="journal-entry__field"><span class="journal-entry__field-label">LOT</span><span class="journal-entry__field-value lot-value">${e.lotSize??'—'}</span></div>
            <div class="journal-entry__field"><span class="journal-entry__field-label">Saldo</span><span class="journal-entry__field-value">$${e.balance?.toLocaleString()??'—'}</span></div>
            <div class="journal-entry__field"><span class="journal-entry__field-label">Risk</span><span class="journal-entry__field-value">${e.risk??'—'}%</span></div>
            <div class="journal-entry__field"><span class="journal-entry__field-label">SL</span><span class="journal-entry__field-value">${e.slPips??'—'}</span></div>
            <div class="journal-entry__field"><span class="journal-entry__field-label">TP</span><span class="journal-entry__field-value">${e.tpPips??'—'}</span></div>
            <div class="journal-entry__field"><span class="journal-entry__field-label">Loss</span><span class="journal-entry__field-value loss-value">$${e.potentialLoss?.toFixed(2)??'—'}</span></div>
            <div class="journal-entry__field"><span class="journal-entry__field-label">Profit</span><span class="journal-entry__field-value profit-value">+$${e.potentialProfit?.toFixed(2)??'—'}</span></div>
          </div>
          <div class="journal-entry__img-row" style="cursor:pointer">
            <div class="journal-entry__img-thumb ${bi?'':'journal-entry__img-thumb--empty'}">
              <span class="journal-entry__img-label">Before</span>
              ${bi?`<img src="${this._e(bi.url)}" alt="Before" loading="lazy">`:'<div class="journal-entry__img-placeholder">📷</div>'}
            </div>
            <div class="journal-entry__img-thumb ${ai?'':'journal-entry__img-thumb--empty'}">
              <span class="journal-entry__img-label">After</span>
              ${ai?`<img src="${this._e(ai.url)}" alt="After" loading="lazy">`:'<div class="journal-entry__img-placeholder">📷</div>'}
            </div>
          </div>
        </div>
        ${e.notes?`<div class="journal-entry__notes">📝 ${this._e(e.notes)}</div>`:''}
        <div class="journal-entry__actions">
          <div class="journal-entry__time-row">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Open: ${e.openTime||'—'}
          </div>
          <span class="journal-entry__close-time">Exit: ${e.closeTime||'—'}</span>
        </div>`;
        card.querySelector('.journal-entry__img-row').addEventListener('click',()=>this._openModal(e));
        return card;
    },

    _renderGallery(){
        const panel=document.getElementById('pub-tab-gallery');if(!panel)return;
        if(!this._profile?.is_journal_public){panel.innerHTML='<div class="pub-private-notice">🔒 Galeri bersifat privat</div>';return;}
        const wi=this._journal.filter(e=>(e.beforeImages||[]).length||(e.afterImages||[]).length);
        if(!wi.length){panel.innerHTML='<div class="pub-private-notice">🖼️ Belum ada foto</div>';return;}
        panel.innerHTML='<div class="journal-gallery__grid" id="pub-gallery-grid"></div>';
        const grid=panel.querySelector('#pub-gallery-grid');
        wi.forEach(e=>{
            const bi=(e.beforeImages||[])[0],ai=(e.afterImages||[])[0];
            const sc={open:'#6366f1',tp:'#26a69a',sl:'#ef5350'}[e.status]||'#6366f1';
            const sl2={open:'Open',tp:'✅ TP',sl:'❌ SL'}[e.status]||'';
            const card=document.createElement('div');
            card.className='journal-gallery__card';card.style.cursor='pointer';
            card.innerHTML=`
            <div class="journal-gallery__images">
              <div class="journal-gallery__img-half">${bi?`<img src="${this._e(bi.url)}" alt="Before" loading="lazy">`:'<div class="journal-gallery__img-empty"><span>Before</span></div>'}<span class="journal-gallery__img-label">Before</span></div>
              <div class="journal-gallery__img-half">${ai?`<img src="${this._e(ai.url)}" alt="After" loading="lazy">`:'<div class="journal-gallery__img-empty"><span>After</span></div>'}<span class="journal-gallery__img-label">After</span></div>
            </div>
            <div class="journal-gallery__info">
              <div class="journal-gallery__pair">${this._e(e.pair)}</div>
              <div class="journal-gallery__meta"><span style="color:${sc};font-weight:600">${sl2}</span><span>${e.openTime||'—'}</span></div>
              ${e.methodName?`<div class="journal-gallery__method">${this._e(e.methodName)}</div>`:''}
            </div>`;
            card.addEventListener('click',()=>this._openModal(e));
            grid.appendChild(card);
        });
    },

    _renderStats(){
        const panel=document.getElementById('pub-tab-stats');
        if(!panel||panel.dataset.rendered==='1')return;
        if(!this._profile?.is_journal_public){panel.innerHTML='<div class="pub-private-notice">🔒 Statistik privat</div>';return;}
        const closed=this._journal.filter(e=>e.status==='tp'||e.status==='sl');
        if(!closed.length){panel.innerHTML='<div class="pub-private-notice">📊 Belum ada data</div>';return;}
        const tp=closed.filter(e=>e.status==='tp'),sl=closed.filter(e=>e.status==='sl');
        const wr=(tp.length/closed.length*100).toFixed(1);
        const gp=tp.reduce((s,e)=>s+(e.potentialProfit||0),0),gl=sl.reduce((s,e)=>s+(e.potentialLoss||0),0);
        const net=gp-gl,pf=gl>0?(gp/gl).toFixed(2):'∞';
        const pnlClr=net>=0?'var(--clr-tp)':'var(--clr-sl)',pnlSign=net>=0?'+':'';
        let mxWin=0,mxLoss=0,cW=0,cL=0;
        closed.forEach(e=>{if(e.status==='tp'){cW++;cL=0;mxWin=Math.max(mxWin,cW);}else{cL++;cW=0;mxLoss=Math.max(mxLoss,cL);}});
        const pMap={};
        closed.forEach(e=>{if(!pMap[e.pair])pMap[e.pair]={tp:0,sl:0};pMap[e.pair][e.status]++;});
        let bP='—',wP='—',bWR=-1,wWR=101;
        Object.entries(pMap).forEach(([pair,d])=>{const t=d.tp+d.sl,r=t>0?d.tp/t*100:0;if(r>bWR&&t>=2){bWR=r;bP=pair;}if(r<wWR&&t>=2){wWR=r;wP=pair;}});
        panel.innerHTML=`
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-sm);margin-bottom:var(--space-md)">
          ${[['WIN RATE',`${wr}%`,''],['TOTAL TRADE',closed.length,''],['PROFIT FACTOR',pf,''],['NET P&L',`${pnlSign}$${Math.abs(net).toFixed(2)}`,pnlClr],
            ['BEST STREAK',`${mxWin} 🔥`,'var(--clr-tp)'],['WORST STREAK',`${mxLoss} 💔`,'var(--clr-sl)'],
            ['BEST PAIR',`${bP} (${bWR>=0?Math.round(bWR):'—'}% WR)`,''],['WORST PAIR',`${wP} (${wWR<=100?Math.round(wWR):'—'}% WR)`,'']]
            .map(([l,v,c])=>`<div style="background:var(--clr-bg-card);border:1px solid var(--clr-border);border-radius:var(--radius-sm);padding:var(--space-md);text-align:center"><div style="font-size:10px;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:4px">${l}</div><div style="font-size:var(--fs-lg);font-weight:800;color:${c||'var(--clr-text)'}">${v}</div></div>`).join('')}
        </div>
        <div style="background:var(--clr-bg-card);border:1px solid var(--clr-border);border-radius:var(--radius-md);padding:var(--space-md)">
          <div style="font-size:var(--fs-xs);font-weight:700;color:var(--clr-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--space-sm)">Kumulatif P&L ($)</div>
          <canvas id="pub-pnl-chart" height="100"></canvas>
        </div>`;
        const sorted=[...closed].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
        let cumul=0;
        const ctx=document.getElementById('pub-pnl-chart')?.getContext('2d');
        if(!ctx)return;
        this._chart=new Chart(ctx,{type:'line',data:{labels:sorted.map((_,i)=>`#${i+1}`),datasets:[{
            label:'P&L',data:sorted.map(e=>{cumul+=e.status==='tp'?(e.potentialProfit||0):-(e.potentialLoss||0);return+cumul.toFixed(2);}),
            borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,.08)',borderWidth:2,pointRadius:3,tension:.3,fill:true,
            pointBackgroundColor:sorted.map(e=>e.status==='tp'?'#26a69a':'#ef5350'),
        }]},options:{responsive:true,plugins:{legend:{display:false}},scales:{
            x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'rgba(255,255,255,.4)',font:{size:10}}},
            y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'rgba(255,255,255,.4)',font:{size:10},callback:v=>`$${v}`}},
        }}});
        panel.dataset.rendered='1';
    },

    _renderMethods(){
        const panel=document.getElementById('pub-tab-methods');if(!panel)return;
        if(!this._profile?.is_methods_public){panel.innerHTML='<div class="pub-private-notice">🔒 Metode bersifat privat</div>';return;}
        if(!this._methods.length){panel.innerHTML='<div class="pub-private-notice">Belum ada metode</div>';return;}
        panel.innerHTML=`<div class="pub-methods-grid">${this._methods.map(m=>`
        <div class="pub-method-card">
          <div class="pub-method-card__name">${this._e(m.name)}</div>
          ${m.sopEntry?`<div class="pub-method-card__section"><div class="pub-method-card__label">📌 Entry</div><div class="pub-method-card__text">${this._e(m.sopEntry)}</div></div>`:''}
          ${m.sopExit?`<div class="pub-method-card__section"><div class="pub-method-card__label">🚪 Exit</div><div class="pub-method-card__text">${this._e(m.sopExit)}</div></div>`:''}
        </div>`).join('')}</div>`;
    },

    _openModal(e){
        const modal=document.getElementById('pub-detail-modal'),content=document.getElementById('pub-modal-content');
        if(!modal||!content)return;
        const st={open:`<span style="color:#6366f1">⬤ Open</span>`,tp:`<span style="color:#26a69a">✅ Hit TP</span>`,sl:`<span style="color:#ef5350">❌ Hit SL</span>`}[e.status]||'';
        const bi=e.beforeImages||[],ai=e.afterImages||[];
        const imgGrid=(imgs,lbl)=>`<div class="modal-img-section">
          <div class="modal-img-section__title">${lbl}</div>
          <div class="modal-img-grid">${imgs.length
            ?imgs.map(img=>`<div class="modal-img-item" onclick="PublicProfile._openLb('${img.url}')"><img src="${this._e(img.url)}" loading="lazy"></div>`).join('')
            :'<div style="border:1px dashed var(--clr-border);border-radius:8px;padding:24px;text-align:center;color:var(--clr-text-muted);font-size:12px">Tidak ada foto</div>'}
          </div></div>`;
        content.innerHTML=`
        <div class="journal-modal__header">
          <div class="journal-modal__pair">${this._e(e.pair)} — ${this._e(e.methodName||'No Method')}</div>
          <div class="journal-modal__status">${st}</div>
        </div>
        <div class="journal-modal__images">${imgGrid(bi,'Before (Setup)')}${imgGrid(ai,'After (Hasil)')}</div>
        <div class="journal-modal__details">
          ${[['Open Time',e.openTime||'—'],['Close Time',e.closeTime||'—'],['Balance',`$${e.balance?.toLocaleString()??'—'}`],
             ['Risk',`${e.risk??'—'}%`],['Lot Size',e.lotSize??'—'],['SL (pips)',e.slPips??'—'],
             ['TP (pips)',e.tpPips??'—'],['Pot. Loss',`<span class="loss-value">$${e.potentialLoss?.toFixed(2)??'—'}</span>`],
             ['Pot. Profit',`<span class="profit-value">+$${e.potentialProfit?.toFixed(2)??'—'}</span>`],
             ['Emosi',e.emotion?this._e(e.emotion):'—']]
            .map(([k,v])=>`<div class="journal-modal__row"><span>${k}</span><strong>${v}</strong></div>`).join('')}
        </div>
        ${e.notes?`<div class="journal-modal__notes">📝 ${this._e(e.notes)}</div>`:''}`;
        modal.classList.add('active');
        document.body.style.overflow='hidden';
    },

    _closeModal(){
        document.getElementById('pub-detail-modal')?.classList.remove('active');
        document.body.style.overflow='';
    },

    _initLb(){
        if(document.getElementById('pub-lightbox'))return;
        const lb=document.createElement('div');
        lb.id='pub-lightbox';lb.className='pub-lightbox';
        lb.innerHTML='<div class="pub-lightbox__backdrop"></div><img class="pub-lightbox__img"><button class="pub-lightbox__close">✕</button>';
        document.body.appendChild(lb);
        lb.querySelector('.pub-lightbox__backdrop').onclick=()=>this._closeLb();
        lb.querySelector('.pub-lightbox__close').onclick=()=>this._closeLb();
    },
    _openLb(src){
        const lb=document.getElementById('pub-lightbox');
        if(!lb)return;lb.querySelector('img').src=src;lb.classList.add('pub-lightbox--open');document.body.style.overflow='hidden';
    },
    _closeLb(){
        const lb=document.getElementById('pub-lightbox');
        if(lb){lb.classList.remove('pub-lightbox--open');document.body.style.overflow='';}
    },

    _e(str=''){const d=document.createElement('div');d.textContent=str;return d.innerHTML;},
};
