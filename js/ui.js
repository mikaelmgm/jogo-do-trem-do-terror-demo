'use strict';
// ============================================================
//  INTERFACE — HUD, painel (mint, paramédicos, pista), modais, toasts
// ============================================================

(() => {
  const $ = s => document.querySelector(s);
  const fmt = (v, d) => Number(v).toFixed(d === undefined ? 4 : d);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = v => +(v * 100).toFixed(2) + '%';
  const perHour = v => v < 10 ? fmt(v, 2) : v < 10000 ? String(Math.round(v)) : Math.round(v / 1000) + 'k';
  const money = v => v >= 100 ? String(Math.round(v)) : fmt(v, 2);
  const days = d => (Math.abs(d - Math.round(d)) < 0.05 ? String(Math.round(d)) : d.toFixed(1)) + (d < 1.05 ? ' dia' : ' dias');
  const plan = key => MEDICS.find(p => p.key === key);
  function duration(ms) {
    const m = Math.ceil(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + (m % 60) + 'min' : m + 'min';
  }

  const MINT_QTYS = [1, 5, 10, 50];
  let mintQty = 1;
  let lastHtml = '';

  // ---------------- sprites em canvas no HTML ----------------
  function hydrate(root) {
    root.querySelectorAll('canvas[data-spr]').forEach(c => {
      let src = getSprite(c.dataset.spr);
      if (c.dataset.sil) { const k = c.dataset.spr + '|sil'; src = _sprCache[k] || (_sprCache[k] = silhouette(src, '#0d0a17')); }
      // sprites mais altos (Slenderman) encolhem um pouco para não esticar as listas
      const sc = Math.max(1, Math.round((+c.dataset.scale || 2) * Math.min(1, 20 / src.height)));
      c.width = src.width * sc; c.height = src.height * sc;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(src, 0, 0, c.width, c.height);
    });
  }
  const spr = (name, scale) => `<canvas class="spr" data-spr="${name}" data-scale="${scale || 2}"></canvas>`;
  const sil = (name, scale) => `<canvas class="spr" data-spr="${name}" data-sil="1" data-scale="${scale || 2}"></canvas>`;
  const badge = rar => `<span class="badge" style="--c:${rar.color}">${rar.label}</span>`;

  // ---------------- toasts ----------------
  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.textContent = text;
    const box = $('#toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4300);
  }
  Game.on('toast', t => toast(t.text, t.kind));

  // mortes podem vir em rajada (vários lendários na pista): junta num aviso só
  let kills = { dead: 0, fee: 0 };
  Game.on('kill', k => { kills.dead++; kills.fee += k.fee; });
  setInterval(() => {
    if (!kills.dead) return;
    toast((kills.dead === 1 ? 'Um cliente morreu: indenização de ' : kills.dead + ' clientes morreram: indenizações de ') + fmt(kills.fee, 3) + ' $MEDO para a família.', 'bad');
    kills = { dead: 0, fee: 0 };
  }, 2500);

  // ---------------- modal ----------------
  function openModal(html, cls) {
    const box = $('#modalBox');
    box.className = 'modal-box px ' + (cls || '');
    box.innerHTML = '<button class="modal-x" data-close>✕</button>' + html;
    hydrate(box);
    $('#modal').classList.remove('hidden');
    return box;
  }
  function closeModal() { $('#modal').classList.add('hidden'); $('#modalBox').innerHTML = ''; }
  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal();
  });

  // ---------------- painel em abas ----------------
  // MINT · INVENTÁRIO · EVOLUÇÃO E FORJA · COLEÇÃO. Missões e paramédicos abrem em janela pelo topo.
  const TAB_KEY = 'casaAssombrada.tab';
  let tab = 'mint', invFilter = 'all', albumPage = 'comum';
  try { tab = localStorage.getItem(TAB_KEY) || 'mint'; } catch (e) { }

  function renderMintTab() {
    const s = Game.s, n = mintQty, cost = Game.mintCost(n), qty = n > 1 ? ' x' + n : '';
    // kit de entrada: o primeiro mint sai de graça (um boneco só)
    if (s.kit.mint > 0) return `
      <div class="mint-machine px">
        <div class="coffin-wrap">${spr('coffin', 4)}</div>
        <h3>CRIPTA DE INVOCAÇÃO</h3>
        <p class="hint">Seu kit de entrada traz um mint de graça. Sai primeiro a raridade, depois o personagem.</p>
        <div class="mint-btns"><button class="btn big" data-act="mint">MINTAR · GRÁTIS (KIT)</button></div>
      </div>`;
    return `
      <div class="mint-machine px">
        <div class="coffin-wrap">${spr('coffin', 4)}</div>
        <h3>CRIPTA DE INVOCAÇÃO</h3>
        <p class="hint">Sai primeiro a raridade, depois o personagem. Quanto mais raro, mais $MEDO por susto e mais chance de matar o cliente.</p>
        <div class="mint-qty"><span class="muted">QUANTIDADE</span>${MINT_QTYS.map(q => `<button class="btn sm${q === n ? '' : ' ghost'}" data-act="qty" data-n="${q}">x${q}</button>`).join('')}</div>
        <div class="mint-btns">
          <button class="btn big" data-act="mint" ${Game.canAfford(cost) ? '' : 'disabled'}>MINTAR${qty} · ${s.infinite ? 'GRÁTIS' : money(cost) + ' $MEDO'}</button>
          <button class="btn big sol" data-act="mintSol">◎ MINTAR${qty} · ${Game.mintCostSol(n)} SOL</button>
        </div>
      </div>`;
  }

  function renderTrack() {
    return `
      <div class="sec-head"><h4>NA PISTA <span class="muted">(ordem do trilho)</span></h4></div>
      <div class="slot-list">${Game.slotOrder.map((i, n) => {
        const m = Game.monsterAt(i);
        if (!m) return `<button class="slot-row empty" data-act="slot" data-slot="${i}"><span class="sn">${n + 1}</span><span class="si muted">${Game.ownsSlot(i) ? 'Vaga livre' : 'Vaga à venda · ' + slotPrice()}</span></button>`;
        const r = RAR[m.rarity];
        return `<button class="slot-row" data-act="slot" data-slot="${i}" style="--c:${r.color}">
          <span class="sn">${n + 1}</span>${spr(monOf(m).key, 2)}
          <span class="si"><b>${esc(monOf(m).name)}${m.level > 1 ? ' <span class="lvl">NV' + m.level + '</span>' : ''}</b><span>${badge(r)} +${money(Game.farmDayOf(m))}/dia${LabUI.classTag(m)}</span></span>
          <span class="kill">mata<b>${pct(Lab.heartOf(m))}</b></span>
        </button>`;
      }).join('')}</div>`;
  }

  // inventário agrupado por personagem + nível (o mint em lote gera muitos repetidos)
  function invGroups(filter) {
    const groups = {};
    Game.s.monsters.filter(x => x.slot < 0 && (filter === 'all' || x.rarity === filter)).forEach(x => {
      const k = monOf(x).key + '|' + x.level;
      (groups[k] = groups[k] || []).push(x);
    });
    return Object.values(groups).sort((a, b) => RAR[b[0].rarity].index - RAR[a[0].rarity].index || b[0].level - a[0].level || monOf(a[0]).name.localeCompare(monOf(b[0]).name));
  }

  function renderInvTab() {
    const inv = Game.s.monsters.filter(x => x.slot < 0);
    const groups = invGroups(invFilter);
    const chip = (key, label, n, color) => `<button class="chip${invFilter === key ? ' on' : ''}" data-act="invf" data-f="${key}" style="--c:${color}">${label} <span>${n}</span></button>`;
    return renderTrack() + `
      <div class="sec-head"><h4>INVENTÁRIO</h4><span class="muted">${inv.length} monstros</span></div>
      <div class="chips">${chip('all', 'TODOS', inv.length, 'var(--text)')}${RARITIES.map(r => chip(r.key, r.label, inv.filter(x => x.rarity === r.key).length, r.color)).join('')}</div>
      ${groups.length ? `<div class="inv-list">${groups.map(g => {
        const x = g[0], r = RAR[x.rarity];
        return `<div class="inv-row" style="--c:${r.color}">
          ${spr(monOf(x).key, 2)}
          <span class="si"><b>${esc(monOf(x).name)}${x.level > 1 ? ' <span class="lvl">NV' + x.level + '</span>' : ''}${g.length > 1 ? ' <span class="muted">x' + g.length + '</span>' : ''}</b><span>${badge(r)} +${money(Game.farmDayOf(x))}/dia · <span class="risk">mata ${pct(r.heart)}</span>${LabUI.classTag(x)}</span></span>
          <button class="btn sm" data-act="pickslot" data-id="${x.id}">COLOCAR</button>
        </div>`;
      }).join('')}</div>` : '<p class="hint">Nada aqui. Minte mais monstros!</p>'}`;
  }

  // evolução: cada personagem que você tem, com o melhor exemplar (o da pista, se houver)
  function evolveTargets() {
    const best = {};
    Game.s.monsters.forEach(x => {
      const k = monOf(x).key, b = best[k];
      if (!b || (x.slot >= 0) > (b.slot >= 0) || ((x.slot >= 0) === (b.slot >= 0) && x.level > b.level)) best[k] = x;
    });
    return Object.values(best).map(m => {
      const cost = Game.evolveCost(m), have = Game.dupesOf(m).length;
      return { m, cost, have, ready: !!cost && have >= cost };
    }).sort((a, b) => b.ready - a.ready || RAR[b.m.rarity].index - RAR[a.m.rarity].index || (b.m.slot >= 0) - (a.m.slot >= 0) || b.m.level - a.m.level);
  }

  function renderForgeTab() {
    const list = evolveTargets(), ready = list.filter(t => t.ready).length;
    return `
      <h4>FORJA <span class="muted">(${CFG.fuseCount} da mesma raridade → 1 da raridade de cima)</span></h4>
      <div class="fusion">${RARITIES.slice(0, -1).map((r, i) => {
        const n = Game.fusePool(r.key).length, times = Math.floor(n / CFG.fuseCount);
        return `<div class="fuse-row">
          <span class="fuse-info">${badge(r)} <span class="muted">${n}</span> → ${badge(RARITIES[i + 1])}</span>
          <span class="fuse-btns"><button class="btn sm" data-act="fuse" data-r="${r.key}" data-n="1" ${times ? '' : 'disabled'}>FUNDIR</button>${times > 1 ? `<button class="btn sm ghost" data-act="fuse" data-r="${r.key}" data-n="${times}">TUDO (${times}x)</button>` : ''}</span>
        </div>`;
      }).join('')}</div>
      <p class="hint">Só entram monstros de nível 1 que estão fora da pista.</p>
      <div class="sec-head"><h4>EVOLUÇÃO</h4><span class="muted">${ready} pronto${ready === 1 ? '' : 's'} para evoluir</span></div>
      <p class="hint">Nível N → N+1 queima N repetidos de nível 1 (fora da pista). Cada nível dá +25% de farm, até o ${CFG.maxLevel}.</p>
      <div class="inv-list">${list.map(({ m, cost, have, ready }) => {
        const r = RAR[m.rarity];
        const btn = cost
          ? `<button class="btn sm" data-act="evolve" data-id="${m.id}" ${ready ? '' : 'disabled'}>NV ${m.level + 1}</button>`
          : '<span class="tag">MÁX</span>';
        return `<div class="inv-row${ready ? ' ready' : ''}" style="--c:${r.color}">
          ${spr(monOf(m).key, 2)}
          <span class="si"><b>${esc(monOf(m).name)} <span class="lvl">NV${m.level}</span>${m.slot >= 0 ? ' <span class="on-track">NA PISTA</span>' : ''}</b><span>${badge(r)} ${cost ? `repetidos: <b class="${ready ? 'gold' : ''}">${have}/${cost}</b>` : 'nível máximo'}</span></span>
          ${btn}
        </div>`;
      }).join('')}</div>`;
  }

  // álbum: uma página por raridade; quem você ainda não teve aparece preto
  function renderAlbumTab() {
    const a = Game.album(), total = MONSTERS.length, seen = MONSTERS.filter(k => a.seen[k.key]).length;
    const r = RAR[albumPage], have = Game.pageCount(r.key), done = have === r.kinds.length, claimed = a.claimed[r.key];
    const owned = k => Game.s.monsters.filter(x => monOf(x).key === k).length;
    let foot;
    if (claimed) foot = `<span class="tag">PÁGINA COLADA</span> <span class="muted small">+${pct(ALBUM.pageFarm)} de farm nos monstros ${r.label.toLowerCase()}s</span>`;
    else if (done) foot = `<button class="btn" data-act="aclaim" data-r="${r.key}">COLAR PÁGINA · +${money(ALBUM.pageReward[r.key])} $MEDO</button>`;
    else foot = `<span class="muted">Faltam <b>${r.kinds.length - have}</b> figurinha${r.kinds.length - have === 1 ? '' : 's'}. Página completa: <b class="gold">+${money(ALBUM.pageReward[r.key])} $MEDO</b> e <b class="gold">+${pct(ALBUM.pageFarm)} de farm</b> nos monstros ${r.label.toLowerCase()}s.</span>`;
    return `
      <div class="album-head">
        <h3>ÁLBUM DE FIGURINHAS</h3>
        <span class="muted">${seen}/${total}</span>
      </div>
      <div class="meter"><div style="width:${seen / total * 100}%"></div></div>
      <div class="album-tabs">${RARITIES.map(x => {
        const n = Game.pageCount(x.key), c = a.claimed[x.key], ok = n === x.kinds.length;
        return `<button class="${x.key === albumPage ? 'on' : ''}${ok && !c ? ' ready' : ''}" data-act="apage" data-r="${x.key}" style="--c:${x.color}">${x.label}<span>${c ? 'COLADA' : n + '/' + x.kinds.length}</span></button>`;
      }).join('')}</div>
      <div class="album-page px" style="--c:${r.color}">
        <div class="stickers">${r.kinds.map((k, i) => a.seen[k.key]
          ? `<div class="sticker on"><span class="num">${String(MONSTERS.indexOf(k) + 1).padStart(2, '0')}</span>${spr(k.key, 3)}<b>${esc(k.name)}</b><small>x${owned(k.key)}</small></div>`
          : `<div class="sticker off"><span class="num">${String(MONSTERS.indexOf(k) + 1).padStart(2, '0')}</span>${sil(k.key, 3)}<b>???</b><small>&nbsp;</small></div>`).join('')}</div>
        <div class="page-foot">${foot}</div>
      </div>
      <p class="hint">Álbum inteiro colado: <b class="gold">+${pct(ALBUM.fullFarm)} de farm em todos os monstros</b>${Game.albumComplete() ? ' (ativo!)' : ''}. Figurinha nova aparece quando você minta ou funde um personagem pela primeira vez.</p>`;
  }

  const TABS = { mint: renderMintTab, inv: renderInvTab, forge: renderForgeTab, album: renderAlbumTab, lab: () => LabUI.render() };
  function renderPanel() {
    if (!TABS[tab]) tab = 'mint';
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const html = TABS[tab]();
    if (html === lastHtml) return;
    const body = $('#panel'), keepScroll = body.dataset.tab === tab ? body.scrollTop : 0;
    lastHtml = html;
    body.innerHTML = html;
    body.dataset.tab = tab;
    body.scrollTop = keepScroll;
    hydrate(body);
  }
  function setTab(t) {
    tab = t;
    try { localStorage.setItem(TAB_KEY, t); } catch (e) { }
    lastHtml = '';
    renderPanel();
  }
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  Game.on('change', () => { lastHtml = ''; renderPanel(); });

  // ---------------- missões e paramédicos (janelas abertas pelo topo) ----------------
  // missões do dia: as sociais contam quando o jogador abre o link; as outras, pelo progresso
  function renderMissions() {
    const d = Game.daily(), s = Game.s;
    const flow = Game.flowActive()
      ? `<p class="flow on">Fluxo turbinado: <b>+${CFG.flowTrains} carrinhos</b> rodando por mais <b>${duration(s.flowUntil - Date.now())}</b>.</p>`
      : `<p class="flow">Missões dão <b>fluxo turbinado</b>: +${CFG.flowTrains} carrinhos rodando, mais clientes por hora.</p>`;
    return `
      <h3>MISSÕES DE HOJE</h3>
      <p class="hint">Renovam à meia-noite.</p>
      <div class="missions px">
        ${flow}
        ${MISSIONS.map(m => {
          const claimed = d.claimed[m.key], done = Game.missionDone(m);
          const prog = m.social ? '' : ` <span class="muted">${Math.min(d.progress[m.key] || 0, m.goal)}/${m.goal}</span>`;
          const reward = m.reward.flowHours ? '+' + m.reward.flowHours + 'h de fluxo turbinado' : '+' + m.reward.medo + ' $MEDO';
          let btn = '<span class="muted small">em andamento</span>';
          if (claimed) btn = '<span class="tag">FEITO</span>';
          else if (done) btn = `<button class="btn sm" data-act="mclaim" data-key="${m.key}">RESGATAR</button>`;
          else if (m.social) btn = `<button class="btn sm ghost" data-act="mopen" data-key="${m.key}">${m.key === 'invite' ? 'COPIAR LINK' : 'ABRIR O X'}</button>`;
          return `<div class="mission${claimed ? ' claimed' : ''}"><div><b>${m.name}</b>${prog}<br><span class="gold small">${reward}</span></div>${btn}</div>`;
        }).join('')}
        <div class="invite"><span class="muted small">Seu link de convite (quem entrar por ele ganha ${CFG.referralBonus} $MEDO):</span><code>${esc(Game.inviteLink())}</code></div>
      </div>`;
  }
  function openMissions() { openModal(renderMissions(), 'missions-modal'); }

  function renderMedics() {
    const s = Game.s, on = Game.medicActive();
    const alive = Game.survival(), fee = Game.indemnityOf(RAR.lendario);
    let status;
    if (s.medicForever) status = '<p>Paramédicos contratados <b>para sempre</b>. Todo infarto vira choque no carrinho, o cliente segue a volta e ninguém cobra indenização.</p>';
    else if (on) status = `<p>De plantão por mais <b>${duration(s.medicUntil - Date.now())}</b>. Os clientes são salvos no carrinho e você não paga indenização (comprar de novo soma dias).</p>`;
    else status = `<p>Sem paramédicos, cada cliente que morre custa uma <b class="bad">indenização</b> à família (~${fmt(fee, 3)} $MEDO) e não assusta mais ninguém na volta. Hoje <b class="${alive < 0.9 ? 'bad' : ''}">${pct(alive)}</b> dos clientes chegam vivos na casa${alive < 1 ? `: você perde ~<b class="bad">${perHour(Game.lossPerHour())} $MEDO/h</b>` : ''}.</p>`;
    return `
      <h3>PARAMÉDICOS</h3>
      <p class="hint">Pagos em SOL. Lobisomem da Lua Vermelha eles não seguram.</p>
      <div class="medic-box px${on ? ' on' : ''}">
        ${status}
        <p class="muted small">${s.deaths} morte${s.deaths === 1 ? '' : 's'} · ${s.saved} salvo${s.saved === 1 ? '' : 's'} · ${fmt(s.lost, 2)} $MEDO pagos em indenizações</p>
        ${s.medicForever ? '' : `<div class="medic-btns">${MEDICS.map(p => `<button class="btn sm sol" data-act="medic" data-plan="${p.key}">${p.name} · ${p.sol} SOL</button>`).join('')}</div>`}
      </div>`;
  }
  function openMedics() { openModal(renderMedics(), 'medics-modal'); }
  // reabre a janela que estiver aberta para mostrar o estado novo
  function refreshModal() {
    const box = $('#modalBox');
    if ($('#modal').classList.contains('hidden')) return;
    if (box.classList.contains('missions-modal')) openMissions();
    else if (box.classList.contains('medics-modal')) openMedics();
  }

  // colocar um monstro do inventário: escolhe a vaga
  function openPlace(id) {
    const x = Game.monster(id);
    if (!x) return;
    openModal(`<h3>COLOCAR ${esc(monOf(x).name.toUpperCase())}</h3>
      <p class="hint">${Game.s.slots.length ? 'Escolha a vaga. Quem estiver nela volta para o inventário.' : 'Você ainda não tem vaga: compre uma clicando numa plaquinha no mapa.'}</p>
      <div class="pick-list">${Game.slotOrder.filter(i => Game.ownsSlot(i)).map(i => {
        const cur = Game.monsterAt(i), r = cur && RAR[cur.rarity], n = Game.slotOrder.indexOf(i);
        return `<div class="pick px" style="--c:${r ? r.color : 'var(--line)'}"><span class="sn">${n + 1}</span><div>${cur ? `<b>${esc(monOf(cur).name)}</b> ${badge(r)}` : '<span class="muted">Vaga livre</span>'}</div><button class="btn sm" data-act="place" data-id="${id}" data-slot="${i}">AQUI</button></div>`;
      }).join('')}</div>`);
  }

  // ---------------- ações ----------------
  $('#panel').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    act(b.dataset.act, b.dataset);
  });
  $('#modalBox').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    act(b.dataset.act, b.dataset);
  });

  function act(a, d) {
    const id = d.id ? +d.id : null;
    switch (a) {
      case 'qty': mintQty = +d.n; lastHtml = ''; renderPanel(); break;
      case 'mint': doMint(); break;
      case 'mintSol': doMintSol(); break;
      case 'mopen': openMission(d.key); if (d.key !== 'invite') refreshModal(); break;
      case 'mclaim': if (Game.claimMission(d.key)) { toast('Missão concluída!', 'good'); refreshModal(); } break;
      case 'fuse': { const made = Game.fuse(d.r, +d.n); if (made.length) showMinted(made, null, made.length > 1 ? made.length + ' FUSÕES' : 'FUSÃO'); break; }
      case 'evolve':
        if (Game.evolve(id)) {
          toast(monOf(Game.monster(id)).name + ' evoluiu para o nível ' + Game.monster(id).level + '!', 'good');
          if (d.slot !== undefined) openSlot(+d.slot);
        }
        break;
      case 'invf': invFilter = d.f; lastHtml = ''; renderPanel(); break;
      case 'pickslot': openPlace(id); break;
      case 'apage': albumPage = d.r; lastHtml = ''; renderPanel(); break;
      case 'aclaim':
        if (Game.claimPage(d.r)) toast('Página ' + RAR[d.r].label + ' colada! +' + money(ALBUM.pageReward[d.r]) + ' $MEDO e +' + pct(ALBUM.pageFarm) + ' de farm' + (Game.albumComplete() ? '. ÁLBUM COMPLETO: +' + pct(ALBUM.fullFarm) + ' de farm em tudo!' : '.'), 'good');
        break;
      case 'slot': openSlot(+d.slot); break;
      case 'place': Game.place(id, +d.slot); closeModal(); break;
      case 'buyslot': {
        const i = +d.slot;
        if (Game.buySlot(i)) {
          toast('Vaga ' + (Game.slotOrder.indexOf(i) + 1) + ' comprada!', 'good');
          if (Game.s.monsters.some(x => x.slot < 0)) openSlot(i); else closeModal();
        }
        break;
      }
      case 'autoplace': {
        const ids = new Set(d.ids.split(',').map(Number)), n = Game.autoPlace(Game.s.monsters.filter(x => ids.has(x.id)));
        if (n) { toast(n === 1 ? 'Boneco na pista!' : n + ' bonecos na pista!', 'good'); closeModal(); }
        break;
      }
      case 'unplace': Game.unplace(id); closeModal(); break;
      case 'medic': buyMedic(plan(d.plan)); break;
      case 'connect': connectWallet(); break;
      case 'demo': Sol.connectDemo(); toast('Carteira demo conectada (2 SOL de mentirinha).', 'good'); refreshWallet(); openWallet(); break;
      case 'disconnect': Sol.disconnect().then(() => { refreshWallet(); closeModal(); }); break;
      case 'airdrop': doAirdrop(); break;
      case 'reset': Game.reset(); World.reset(); closeModal(); toast('Progresso reiniciado.', 'info'); break;
      default: LabUI.act(a, d);
    }
  }

  // ---------------- mint ----------------
  function doMint() {
    const made = Game.mint(false, mintQty);
    if (made) showMinted(made);
  }
  async function doMintSol() {
    if (!Sol.pubkey) { openWallet('Conecte uma carteira para mintar com SOL.'); return; }
    const n = mintQty, sol = Game.mintCostSol(n);
    const box = openModal(`<div class="center"><h3>MINT COM SOLANA</h3>${spr('coffin', 5)}<p class="pending">Assinando transação de ${sol} SOL…</p></div>`);
    try {
      const r = await Sol.pay(sol);
      const made = Game.mint(true, n);
      refreshWallet();
      if (box.isConnected) showMinted(made, r);
    } catch (err) {
      openModal(`<div class="center"><h3>FALHOU</h3><p class="bad">${esc(err.message || err)}</p><button class="btn" data-close>OK</button></div>`);
    }
  }
  function showMinted(made, tx, title) {
    const fresh = new Set(Game.takeNewStickers());
    if (made.length === 1) reveal(made[0], tx, title, fresh);
    else revealMany(made, tx, title, fresh);
    if (fresh.size) toast((fresh.size === 1 ? 'Figurinha nova no álbum: ' : fresh.size + ' figurinhas novas no álbum: ') + [...fresh].map(k => MON[k].name).join(', ') + '!', 'good');
  }
  const txLine = tx => tx ? `<p class="muted small">tx ${tx.simulated ? '(simulada)' : `<a href="${Sol.explorer(tx.signature)}" target="_blank" rel="noopener">ver no explorer</a>`}: ${tx.signature.slice(0, 16)}…</p>` : '';
  const mintAgainBtn = label => `<button class="btn" data-act="mint" ${Game.canAfford(Game.mintCost(mintQty)) ? '' : 'disabled'}>${label}</button>`;
  const slotPrice = () => Game.s.kit.slot > 0 ? 'grátis pelo kit' : money(CFG.slotCost) + ' $MEDO';
  // depois do mint o boneco fica no inventário: oferece pôr na primeira vaga livre
  function placeLine(list) {
    if (!list.some(m => m.slot < 0)) return '<p class="muted">Já está assombrando a pista!</p>';
    if (Game.freeSlot() >= 0) return `<p class="muted">${list.length > 1 ? 'Foram' : 'Foi'} para o inventário.</p><button class="btn" data-act="autoplace" data-ids="${list.map(m => m.id).join(',')}">${list.length > 1 ? 'COLOCAR OS MELHORES NA PISTA' : 'COLOCAR NA PISTA'}</button>`;
    return `<p class="muted">Foi para o inventário. ${Game.s.slots.length ? 'Suas vagas estão ocupadas: troque pelo mapa ou compre outra vaga.' : 'Compre uma vaga no mapa para colocar na pista.'}</p>`;
  }

  // ---------------- animação do mint ----------------
  // O caixão dá uns pulinhos, estoura num "pop" de estrelinhas e o monstro salta para fora com
  // um efeito de mola. Luzes e estrelas são vetoriais (suaves) por trás do pixel art.
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.min(1, Math.max(0, k));
  const easeOut = k => 1 - Math.pow(1 - clamp01(k), 3);
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
  function softGlow(x, cx, cy, r, color, alpha) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  // estrelinha de 4 pontas
  function sparkle(x, cx, cy, r, color, alpha, rot) {
    x.save(); x.translate(cx, cy); x.rotate(rot || 0); x.globalAlpha = alpha; x.fillStyle = color;
    x.beginPath(); x.moveTo(0, -r);
    x.quadraticCurveTo(0, 0, r, 0); x.quadraticCurveTo(0, 0, 0, r); x.quadraticCurveTo(0, 0, -r, 0); x.quadraticCurveTo(0, 0, 0, -r);
    x.fill(); x.restore();
  }

  // mint em lote: as cartas viram uma a uma, do mais comum para o mais raro (o melhor fica no fim)
  function revealMany(made, tx, title, fresh) {
    const sorted = made.slice().sort((a, b) => RAR[a.rarity].index - RAR[b.rarity].index || a.id - b.id);
    const counts = RARITIES.slice().reverse().map(r => [r, made.filter(m => m.rarity === r.key).length]).filter(c => c[1]);
    openModal(`
      <div class="reveal-many">
        <h3>${title || made.length + ' MONSTROS INVOCADOS'}</h3>
        <div class="rm-grid">${sorted.map((m, i) => `<div class="rm-card back" style="animation-delay:${Math.min(i * 15, 400)}ms">${spr('coffin', 2)}</div>`).join('')}</div>
        <div class="rm-end hidden-txt" id="rmEnd">
          <div class="rm-counts">${counts.map(([r, c]) => `<span class="badge" style="--c:${r.color}">${c}x ${r.label}</span>`).join('')}</div>
          ${placeLine(made)}
          ${txLine(tx)}
          <div class="row-btns">${title ? '' : mintAgainBtn('MINTAR MAIS' + (mintQty > 1 ? ' x' + mintQty : ''))}<button class="btn ghost" data-close>FECHAR</button></div>
        </div>
      </div>`, 'reveal-many-modal');
    const cards = [...document.querySelectorAll('#modalBox .rm-card')], shownNew = new Set();
    const step = Math.max(60, Math.min(200, 2600 / sorted.length));
    let at = 450;
    sorted.forEach((m, i) => {
      const r = RAR[m.rarity];
      if (r.index >= 3) at += 220;                 // pausinha antes dos épicos e lendários
      setTimeout(() => {
        const card = cards[i];
        if (!card || !card.isConnected) return;
        const k = monOf(m).key, isNew = fresh && fresh.has(k) && !shownNew.has(k) && shownNew.add(k);
        card.className = 'rm-card flip' + (r.index >= 3 ? ' hot' : '') + (r.index >= 4 ? ' boom' : '');
        card.style.setProperty('--c', r.color);
        card.style.animationDelay = '0ms';
        card.title = monOf(m).name + ' #' + m.id + ' · ' + r.label + ' · mata ' + pct(r.heart);
        card.innerHTML = `${isNew ? '<em class="new">NOVA</em>' : ''}${spr(k, 2)}<span>${esc(monOf(m).short)}</span>`;
        hydrate(card);
      }, at);
      at += step;
    });
    setTimeout(() => { const end = $('#rmEnd'); if (end) end.classList.remove('hidden-txt'); }, at + 250);
  }

  function reveal(m, tx, title, fresh) {
    const rar = RAR[m.rarity];
    openModal(`
      <div class="reveal">
        <canvas id="revealCv"></canvas>
        <div class="reveal-txt hidden-txt" id="revealTxt">
          ${title ? `<h3>${title}</h3>` : ''}
          ${fresh && fresh.has(monOf(m).key) ? '<p class="gold">FIGURINHA NOVA NO ÁLBUM!</p>' : ''}
          ${badge(rar)}
          <h2 style="color:${rar.color}">${esc(monOf(m).name)} <span class="muted">#${m.id}</span></h2>
          <p>+${money(Game.farmDayOf(m))} $MEDO/dia · ROI ${days(rar.roi)} (${days(rar.roiNoMedic)} sem paramédico) · <span class="risk">mata ${pct(rar.heart)}</span></p>
          ${placeLine([m])}
          ${txLine(tx)}
          <div class="row-btns">${title ? '' : mintAgainBtn('MINTAR OUTRO')}<button class="btn ghost" data-close>FECHAR</button></div>
        </div>
      </div>`, 'reveal-modal');
    // desenha em alta resolução: as luzes ficam lisas e o pixel art continua nítido
    const S = 280, C = S / 2, FLOOR = 214, dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = $('#revealCv'), x = cv.getContext('2d');
    cv.width = S * dpr; cv.height = S * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.imageSmoothingEnabled = false;
    const txt = $('#revealTxt');
    const coffin = getSprite('coffin'), mon = getSprite(monOf(m).key), monS = getSprite(monOf(m).key + '_s');
    const scale = Math.max(3, Math.floor(Math.min(150 / mon.width, 160 / mon.height)));
    const OPEN = 1.25;                                  // segundos até o caixão abrir
    const HOPS = [[0.1, 0.24, 7], [0.45, 0.27, 11], [0.8, 0.32, 18]];  // [início, duração, altura]
    const stars = Array.from({ length: 6 }, (_, i) => ({ a: i / 6 * Math.PI * 2, d: rand(78, 104), f: rand(4, 7), p: rand(0, 6), r: rand(4, 7) }));
    const parts = [];
    let opened = false, shown = false, last = performance.now();
    const showText = () => { if (shown) return; shown = true; txt.classList.remove('hidden-txt'); };
    setTimeout(showText, (OPEN + 0.9) * 1000);          // se o navegador parar de desenhar, o resultado aparece igual
    const t0 = performance.now();
    (function step(now) {
      if (!cv.isConnected) return;
      const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      x.fillStyle = '#0d0a17'; x.fillRect(0, 0, S, S);
      softGlow(x, C, C + 10, 170, '#2a1f47', 0.9);
      if (t < OPEN) {
        const k = t / OPEN;
        // pulinhos: parábola no ar e um amassadinho ao cair
        let lift = 0, sx = 1, sy = 1;
        for (const [s0, d, hgt] of HOPS) {
          const p = (t - s0) / d;
          if (p >= 0 && p <= 1) { lift = hgt * 4 * p * (1 - p); sx = 0.94; sy = 1.08; }
          else if (p > 1 && p < 1 + 0.09 / d) { const q = (p - 1) * d / 0.09; sx = lerp(1.14, 1, q); sy = lerp(0.86, 1, q); }
        }
        softGlow(x, C, FLOOR - 40, 70 + k * 40, '#fff1c2', 0.12 + k * 0.3);
        x.fillStyle = 'rgba(0,0,0,0.35)';
        x.beginPath(); x.ellipse(C, FLOOR + 2, 34 - lift * 0.8, 6 - lift * 0.12, 0, 0, Math.PI * 2); x.fill();
        const w = coffin.width * 5 * sx, h = coffin.height * 5 * sy;
        x.save(); x.translate(C, FLOOR - lift); x.rotate(lift ? 0 : Math.sin(t * 22) * 0.035 * k);
        x.drawImage(coffin, -w / 2, -h + 5 * sy, w, h);
        x.restore();
        for (const s of stars) {
          const a = s.a + t * 1.6, tw = 0.5 + 0.5 * Math.sin(t * s.f + s.p);
          sparkle(x, C + Math.cos(a) * s.d, FLOOR - 50 + Math.sin(a) * s.d * 0.55, s.r * (0.6 + tw * 0.6), '#fff1c2', 0.35 + tw * 0.6 * k, t);
        }
      } else {
        const u = t - OPEN;
        if (!opened) {
          opened = true;
          // "pop": confete de estrelinhas e bolinhas
          const cols = [rar.color, rar.color, '#ffffff', '#fff1c2'];
          for (let i = 0; i < 34; i++) {
            const a = rand(0, Math.PI * 2), v = rand(70, 190);
            parts.push({ x: C, y: FLOOR - 45, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 260, l: rand(0.6, 1.2), r: rand(3, 7), c: pick(cols), rot: rand(0, 6), vr: rand(-6, 6), star: Math.random() < 0.6 });
          }
        }
        // raios girando atrás do monstro
        const rays = clamp01(u / 0.3);
        x.save(); x.translate(C, FLOOR - 70); x.rotate(t * 0.35);
        const g = x.createRadialGradient(0, 0, 10, 0, 0, 150);
        g.addColorStop(0, rgba(rar.color, 0.32 * rays)); g.addColorStop(1, rgba(rar.color, 0));
        x.fillStyle = g;
        for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(150, -16); x.lineTo(150, 16); x.closePath(); x.fill(); }
        x.restore();
        softGlow(x, C, FLOOR - 70, 115, rar.color, 0.4 * rays);
        // anel do pop e clarão
        if (u < 0.5) {
          const q = u / 0.5;
          x.strokeStyle = rgba(rar.color, 1 - q); x.lineWidth = 7 * (1 - q) + 1;
          x.beginPath(); x.arc(C, FLOOR - 45, 20 + easeOut(q) * 120, 0, Math.PI * 2); x.stroke();
        }
        if (u < 0.3) softGlow(x, C, FLOOR - 45, 160, '#ffffff', 0.85 * (1 - u / 0.3));
        // o monstro salta: estica subindo, amassa ao cair e assenta
        let sx = 1, sy = 1, lift = 0;
        if (u < 0.16) { const q = easeOut(u / 0.16); sy = lerp(0.25, 1.22, q); sx = lerp(1.3, 0.86, q); lift = lerp(0, 28, q); }
        else if (u < 0.34) { const q = (u - 0.16) / 0.18; sy = lerp(1.22, 0.88, q); sx = lerp(0.86, 1.1, q); lift = 28 * (1 - q * q); }
        else if (u < 0.52) { const q = easeOut((u - 0.34) / 0.18); sy = lerp(0.88, 1, q); sx = lerp(1.1, 1, q); }
        else lift = (1 - Math.cos((u - 0.52) * 2.6)) * 3;
        x.fillStyle = 'rgba(0,0,0,0.35)';
        x.beginPath(); x.ellipse(C, FLOOR + 2, mon.width * scale * 0.32, 6, 0, 0, Math.PI * 2); x.fill();
        const img = u > 1 && (t % 2.4) < 0.45 ? monS : mon;
        const w = img.width * scale * sx, h = img.height * scale * sy;
        x.drawImage(img, C - w / 2, FLOOR - h - lift, w, h);
        // brilhinhos em volta (mais nos raros) e chuva dourada no lendário
        for (const s of stars) {
          const a = s.a + t * 0.8, tw = 0.5 + 0.5 * Math.sin(t * s.f + s.p);
          sparkle(x, C + Math.cos(a) * (s.d + 14), FLOOR - 75 + Math.sin(a) * s.d * 0.7, s.r * (0.5 + tw * 0.7), Math.sin(s.p) > 0 ? rar.color : '#ffffff', tw * 0.85 * rays, -t);
        }
        if (rar.index >= 4 && Math.random() < 0.45) parts.push({ x: rand(20, S - 20), y: -6, vx: rand(-10, 10), vy: rand(50, 90), g: 20, l: 3, r: rand(2.5, 4.5), c: pick(['#ffd23f', '#fff3a6', '#ffb52e']), rot: rand(0, 6), vr: rand(-3, 3), star: true });
        if (u > 0.45) showText();
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.rot += p.vr * dt; p.l -= dt;
        if (p.l <= 0 || p.y > S + 10) { parts.splice(i, 1); continue; }
        if (p.star) sparkle(x, p.x, p.y, p.r, p.c, Math.min(1, p.l * 2), p.rot);
        else { x.globalAlpha = Math.min(1, p.l * 2); x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; }
      }
      x.globalAlpha = 1;
      requestAnimationFrame(step);
    })(t0);
  }


  // ---------------- missões sociais ----------------
  function openMission(key) {
    const link = Game.inviteLink();
    if (key === 'follow') window.open(SOCIAL.twitter ? 'https://x.com/intent/follow?screen_name=' + encodeURIComponent(SOCIAL.twitter) : 'https://x.com', '_blank', 'noopener');
    else if (key === 'tweet') window.open('https://x.com/intent/tweet?text=' + encodeURIComponent('Montei meu trem fantasma na Casa Assombrada e meus monstros estão matando de susto. Vem assombrar comigo:') + '&url=' + encodeURIComponent(link), '_blank', 'noopener');
    else if (key === 'invite') copyText(link);
    Game.openMission(key);
  }
  function copyText(text) {
    const manual = () => {
      openModal(`<h3>SEU LINK DE CONVITE</h3><p class="hint">Copie e mande para um amigo:</p><input class="copy-box" id="copyBox" readonly value="${esc(text)}">`);
      $('#copyBox').select();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => toast('Link copiado! Mande para um amigo.', 'good'), manual);
    else manual();
  }

  // ---------------- vagas: colocar, trocar e retirar monstros ----------------
  // nível N → N+1 queima N cópias de nível 1 do mesmo personagem (+25% de farm por nível)
  function evolveBtn(m, slot) {
    const cost = Game.evolveCost(m);
    if (!cost) return '<span class="tag">NÍVEL MÁXIMO</span>';
    const have = Game.dupesOf(m).length;
    return `<button class="btn sm" data-act="evolve" data-id="${m.id}" data-slot="${slot}" ${have >= cost ? '' : 'disabled'}>EVOLUIR P/ NV ${m.level + 1} · ${cost} REPETIDO${cost > 1 ? 'S' : ''} (TEM ${have})</button>`;
  }

  function openBuySlot(i) {
    const pos = Game.slotOrder.indexOf(i) + 1, kit = Game.s.kit.slot > 0;
    openModal(`<div class="center"><h3>VAGA ${pos} DO TRILHO · À VENDA</h3>
      <p class="hint">Cada vaga recebe um boneco. Os clientes passam pelas vagas na ordem do trilho.</p>
      <div class="row-btns"><button class="btn" data-act="buyslot" data-slot="${i}" ${kit || Game.canAfford(CFG.slotCost) ? '' : 'disabled'}>${kit ? 'USAR O KIT · GRÁTIS' : 'COMPRAR · ' + money(CFG.slotCost) + ' $MEDO'}</button><button class="btn ghost" data-close>CANCELAR</button></div></div>`);
  }

  function openSlot(i) {
    if (!Game.ownsSlot(i)) { openBuySlot(i); return; }
    const m = Game.monsterAt(i), pos = Game.slotOrder.indexOf(i) + 1;
    // inventário agrupado por personagem (o mint em lote gera muitos repetidos)
    const groups = {};
    Game.s.monsters.filter(x => x.slot < 0).forEach(x => { const k = x.kind + '|' + x.level; (groups[k] = groups[k] || []).push(x); });
    const list = Object.values(groups).sort((a, b) => RAR[b[0].rarity].index - RAR[a[0].rarity].index || b[0].level - a[0].level);
    const head = m
      ? `<div class="mdetail" style="--c:${RAR[m.rarity].color}">
          <div class="big-spr">${spr(monOf(m).key, 5)}</div>
          <div>
            ${badge(RAR[m.rarity])} <span class="muted">vaga ${pos} do trilho</span>
            <h2 style="color:${RAR[m.rarity].color}">${esc(monOf(m).name)} <span class="muted">#${m.id}</span></h2>
            <p>Nível <b>${m.level}</b>/${CFG.maxLevel} · +${money(Game.farmDayOf(m))} $MEDO/dia · <span class="risk">mata ${pct(Lab.heartOf(m))}</span></p>
            <div class="row-btns left">${evolveBtn(m, i)}<button class="btn sm ghost" data-act="unplace" data-id="${m.id}">RETIRAR DA PISTA</button></div>
          </div></div>${LabUI.slotExtra(i, m)}`
      : `<h3>VAGA ${pos} DO TRILHO · LIVRE</h3>`;
    openModal(`${head}
      <h4>${m ? 'TROCAR POR' : 'COLOCAR NA VAGA'}</h4>
      ${list.length ? `<div class="pick-list">${list.map(g => {
        const x = g[0], r = RAR[x.rarity];
        return `<div class="pick px" style="--c:${r.color}">${spr(monOf(x).key, 2)}<div><b>${esc(monOf(x).name)}</b>${g.length > 1 ? ` <span class="muted">x${g.length}</span>` : ''}<br>${badge(r)} <span class="risk">mata ${pct(r.heart)}</span></div><button class="btn sm" data-act="place" data-id="${x.id}" data-slot="${i}">COLOCAR</button></div>`;
      }).join('')}</div>` : '<p class="hint">Inventário vazio. Minte mais monstros!</p>'}`);
  }
  World.onSlot(openSlot);
  World.onLot(i => LabUI.openLot(i));
  LabUI.bind({ openModal, closeModal, toast, spr, money, pct, perHour, esc, openSlot, refresh: () => { lastHtml = ''; renderPanel(); } });

  // tooltip das vagas
  const tip = $('#tooltip');
  World.onHover((i, cx, cy) => {
    if (i < 0) { tip.classList.add('hidden'); return; }
    const m = Game.monsterAt(i);
    let html = Game.ownsSlot(i) ? '<b>Vaga livre</b><br>Clique para colocar um monstro' : '<b>Vaga à venda</b><br>' + slotPrice() + ' · clique para comprar';
    if (m) {
      const r = RAR[m.rarity];
      html = `<b style="color:${r.color}">${esc(monOf(m).name)} #${m.id}</b> · ${r.label}<br>+${money(Game.farmDayOf(m))} $MEDO/dia · mata ${pct(Lab.heartOf(m))}${LabUI.tip(m)}`;
    }
    tip.innerHTML = html;
    const rect = $('#stage').getBoundingClientRect();
    tip.style.left = (cx - rect.left + 14) + 'px';
    tip.style.top = (cy - rect.top + 14) + 'px';
    tip.classList.remove('hidden');
  });

  // ---------------- Solana ----------------
  function refreshWallet() {
    const b = $('#btnWallet');
    b.textContent = Sol.pubkey ? (Sol.demo ? 'DEMO ' : '◎ ') + Sol.short() : 'CONECTAR CARTEIRA';
    b.classList.toggle('connected', !!Sol.pubkey);
  }

  async function connectWallet() {
    try {
      await Sol.connect();
      toast('Carteira conectada: ' + Sol.short(), 'good');
      refreshWallet();
      openWallet();
    } catch (e) {
      toast('Não foi possível conectar: ' + (e.message || e), 'bad');
    }
  }

  function walletSection() {
    if (!Sol.pubkey) {
      const has = Sol.available();
      return `<div class="wallet-box px">
        <p>${has ? 'Carteira Solana detectada.' : 'Nenhuma carteira detectada. Instale a <a href="https://phantom.app" target="_blank" rel="noopener">Phantom</a> e abra o jogo pelo <b>jogar.bat</b> (servidor local), ou use a carteira demo.'}</p>
        <div class="row-btns">
          ${has ? '<button class="btn sol" data-act="connect">CONECTAR CARTEIRA</button>' : ''}
          <button class="btn ghost" data-act="demo">USAR CARTEIRA DEMO</button>
        </div></div>`;
    }
    return `<div class="wallet-box px">
      <div class="w-row"><span class="net">DEVNET</span><b>${Sol.demo ? 'Carteira demo' : 'Carteira'}</b><code>${Sol.short()}</code></div>
      <div class="w-row"><span>Saldo:</span><b>${Sol.balance === null ? '—' : fmt(Sol.balance, 3) + ' SOL'}</b>
        <button class="btn sm ghost" data-act="airdrop">+1 SOL AIRDROP</button>
        <button class="btn sm ghost" data-act="disconnect">SAIR</button></div>
      <p class="muted small">${Sol.isReal() ? 'Pagamentos enviam SOL de verdade (devnet) para a tesouraria configurada.' : 'Pagamentos simulados: configure TREASURY em js/solana.js para transações reais na devnet.'}</p>
    </div>`;
  }
  function openWallet(msg) {
    openModal(`<h3>CARTEIRA</h3>${msg ? `<p class="hint">${msg}</p>` : ''}${walletSection()}<p class="muted small">SOL serve para mintar e contratar paramédicos.</p>`);
  }

  async function buyMedic(p) {
    if (!p) return;
    if (!Sol.pubkey) { openWallet('Conecte uma carteira para contratar paramédicos.'); return; }
    const box = openModal(`<div class="center"><h3>PARAMÉDICOS</h3>${spr('medic', 6)}<p class="pending">Assinando transação de ${p.sol} SOL…</p></div>`);
    try {
      const r = await Sol.pay(p.sol);
      Game.buyMedic(p);
      refreshWallet();
      if (box.isConnected) openModal(`<div class="center"><h3>PLANTÃO CONFIRMADO</h3>${spr('medic', 6)}
        <p>${Game.s.medicForever ? 'Paramédicos contratados <b>para sempre</b>.' : `Paramédicos de plantão por mais <b>${duration(Game.s.medicUntil - Date.now())}</b>.`}</p>
        ${txLine(r)}
        <button class="btn" data-close>OK</button></div>`);
    } catch (err) {
      openModal(`<div class="center"><h3>FALHOU</h3><p class="bad">${esc(err.message || err)}</p><button class="btn" data-close>OK</button></div>`);
    }
  }

  async function doAirdrop() {
    try {
      toast('Pedindo airdrop na devnet…', 'info');
      await Sol.airdrop();
      toast('+1 SOL de teste recebido!', 'good');
    } catch (e) {
      toast('Airdrop falhou (a devnet limita pedidos): ' + (e.message || e), 'bad');
    }
    openWallet();
  }

  $('#btnWallet').addEventListener('click', () => openWallet());
  $('#btnReset').addEventListener('click', () => openModal(`<div class="center"><h3>REINICIAR?</h3><p>Todo o progresso salvo neste navegador será apagado.</p><div class="row-btns"><button class="btn" data-act="reset">APAGAR TUDO</button><button class="btn ghost" data-close>CANCELAR</button></div></div>`));
  $('#btnHelp').addEventListener('click', tutorial);
  $('#medicBadge').addEventListener('click', openMedics);
  $('#btnMissions').addEventListener('click', openMissions);
  $('#btnInfinite').addEventListener('click', () => {
    const on = Game.toggleInfinite();
    toast(on ? '$MEDO infinito ligado: minte à vontade.' : '$MEDO infinito desligado: de volta ao saldo real (' + fmt(Game.s.medo, 2) + ').', 'info');
    hud();
  });

  // ---------------- tutorial ----------------
  // O Sr. Calafrio, dono do parque, apresenta cada parte da tela. Um recorte iluminado mostra do
  // que ele está falando; no mapa, o destaque acompanha o carrinho andando. Passos com `wait`
  // esperam o jogador fazer a ação (comprar a vaga, mintar, posicionar) e passam sozinhos.
  const TUTORIAL = [
    { text: 'Bem-vindo ao Parque dos Horrores! Eu sou o Sr. Calafrio, o dono deste lugar encantador. Vem comigo que eu te mostro tudo.' },
    { spot: 'train', text: 'Esse é o carrinho onde seus clientes vão passar a eternidade... hehehe.' },
    { spot: 'slot', text: 'Ao longo do trilho ficam as vagas dos BONECOS. Cada vez que um cliente passa perto de um boneco, leva um susto. E susto = dinheiro!' },
    { spot: 'slot', wait: () => Game.s.slots.length > 0, text: 'Você ganhou um kit de entrada: 1 vaga + 1 boneco. Primeiro, compre sua vaga: clique numa plaquinha de vaga no mapa e use o kit.' },
    { el: '.mint-btns', tab: 'mint', wait: () => Game.s.monsters.length > 0, text: 'Agora invoque seu boneco: clique em MINTAR, que esse também é por conta do kit. Eles vêm em raridades aleatórias... não vá tomar um susto se pegar um feio demais, hein?' },
    { spot: 'free', wait: () => Game.placed().length > 0, text: 'Seu boneco foi para o inventário. Agora posicione ele: clique em COLOCAR NA PISTA, ou clique na sua vaga no mapa e escolha ele.' },
    { spot: 'monster', text: 'Pronto, ele já está assustando! Cada susto rende $MEDO na hora. Quer mais bonecos na pista? Compre mais vagas clicando nas plaquinhas do mapa.' },
    { el: '.stats', text: 'Aqui embaixo você acompanha seu $MEDO e quanto o parque rende por hora.' },
    { el: '#medicBadge', text: 'Quanto mais raro o boneco, mais ele rende, mas maior a chance do cliente ter um ataque cardíaco. Aí o parque paga indenização para a família. Por isso é bom contratar os paramédicos: com eles de plantão, ninguém morre.' },
    { el: '#tabs', text: 'No inventário ficam os bonecos fora da pista. Na forja, repetidos sobem o nível do boneco e 5 da mesma raridade viram 1 da raridade de cima. E na coleção, cada página completa do álbum dá prêmio.' },
    { el: '#btnMissions', text: 'Faça as missões do dia para turbinar o fluxo de clientes: mais carrinhos, mais sustos.' },
    { el: '#game', text: 'De vez em quando tem evento! Na Lua Vermelha, clique nos lobisomens antes que ataquem os carrinhos. Na Sexta-feira 13 e no Halloween o farm sobe. E clique nas coisinhas que aparecem pelo parque para ganhar $MEDO.' },
    { text: 'E essa é só a primeira de muitas atrações que você verá no Parque dos Horrores. Boa sorte!', last: true },
  ];
  const TYPE_CPS = 45;                                   // letras por segundo

  function tutorial() {
    closeModal();
    document.querySelector('.tut')?.remove();
    const root = document.createElement('div');
    root.className = 'tut';
    root.innerHTML = `
      <div class="tut-hole hidden"></div>
      <div class="tut-box px">
        <canvas class="tut-host" width="16" height="26"></canvas>
        <div class="tut-body">
          <b class="tut-name">SR. CALAFRIO</b>
          <p class="tut-text"></p>
          <div class="tut-btns">
            <span class="tut-step"></span>
            <button class="btn sm ghost" data-tut="skip">PULAR</button>
            <button class="btn sm" data-tut="next">PRÓXIMO</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    const $t = sel => root.querySelector(sel);
    const hole = $t('.tut-hole'), box = $t('.tut-box'), textEl = $t('.tut-text'), next = $t('[data-tut="next"]');
    const hx = $t('.tut-host').getContext('2d');
    let i = -1, typeStart = 0, advancing = false;
    const t0 = performance.now();
    const typed = () => Math.floor((performance.now() - typeStart) / 1000 * TYPE_CPS);

    function finish() {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      root.remove();
      Game.s.welcomed = true;
      Game.save();
    }
    // retângulo na tela do que o passo atual mostra (ou null: fala no meio, tela toda escura)
    function target(st) {
      if (st.spot) {
        const r = World.spot(st.spot);
        if (!r) return null;
        const c = World.canvas.getBoundingClientRect(), k = c.width / World.canvas.width;
        return { left: c.left + r.x * k, top: c.top + r.y * k, width: r.w * k, height: r.h * k };
      }
      const el = st.el && document.querySelector(st.el);
      return el ? el.getBoundingClientRect() : null;
    }
    function place() {
      const r = target(TUTORIAL[i]), pad = 6;
      root.classList.toggle('dim', !r);
      hole.classList.toggle('hidden', !r);
      if (!r) { box.classList.remove('top'); return; }
      Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      // a caixa de fala vai para o lado da tela oposto ao destaque
      box.classList.toggle('top', r.top + r.height / 2 > innerHeight / 2);
    }
    function go(n) {
      i = n;
      if (i >= TUTORIAL.length) { finish(); return; }
      const st = TUTORIAL[i];
      if (st.tab) setTab(st.tab);
      const el = st.el && document.querySelector(st.el);
      if (el) el.scrollIntoView({ block: 'nearest' });
      typeStart = performance.now();
      textEl.textContent = '';
      $t('.tut-step').textContent = (i + 1) + '/' + TUTORIAL.length;
      // passo de ação: a tela fica clicável e o botão espera o jogador (já feito = passo normal)
      const waiting = !!st.wait && !st.wait();
      root.classList.toggle('play', waiting);
      next.disabled = waiting;
      next.textContent = waiting ? 'SUA VEZ!' : st.last ? 'ABRIR O PARQUE' : 'PRÓXIMO';
      place();
    }
    // clicar enquanto ele fala mostra a frase inteira; clicar de novo passa
    next.addEventListener('click', () => { if (typed() < TUTORIAL[i].text.length) typeStart = 0; else go(i + 1); });
    $t('[data-tut="skip"]').addEventListener('click', finish);
    function onKey(e) {
      if (root.classList.contains('hidden') || root.classList.contains('play')) return;
      if (e.key === 'Escape') finish();
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next.click(); }
    }
    document.addEventListener('keydown', onKey);
    // timer em vez de requestAnimationFrame: a fala anda mesmo se o navegador economizar quadros
    let ticks = 0;
    const timer = setInterval(() => {
      const t = (performance.now() - t0) / 1000, full = TUTORIAL[i].text, n = Math.min(full.length, typed());
      if (textEl.textContent.length !== n) textEl.textContent = full.slice(0, n);
      const talking = n < full.length && Math.floor(t * 8) % 2;
      hx.clearRect(0, 0, 16, 26);
      hx.drawImage(getSprite(talking ? 'host_t' : 'host'), 0, 1 + Math.round(Math.sin(t * 2.4)));
      if (++ticks % 3 === 0) place();                    // o carrinho anda e a tela pode rolar
      // some enquanto houver janela aberta (compra de vaga, revelação do mint) e volta depois
      root.classList.toggle('hidden', !$('#modal').classList.contains('hidden'));
      const st = TUTORIAL[i];
      if (root.classList.contains('play') && st.wait() && !advancing) {
        advancing = true;
        setTimeout(() => { advancing = false; go(i + 1); }, 700);
      }
    }, 40);
    go(0);
  }

  // ---------------- HUD + loops ----------------
  function hud() {
    const s = Game.s;
    $('#medo').textContent = s.infinite ? 'INFINITO' : fmt(s.medo, 2);
    $('#farm').textContent = '+' + perHour(Game.farmPerHour() * Game.eventFarm());
    const ready = MISSIONS.filter(m => !Game.daily().claimed[m.key] && Game.missionDone(m)).length;
    $('#missionPill').textContent = ready;
    $('#missionPill').classList.toggle('hidden', !ready);
    const pages = RARITIES.filter(r => Game.pageDone(r.key) && !Game.album().claimed[r.key]).length;
    $('#albumPill').textContent = pages;
    $('#albumPill').classList.toggle('hidden', !pages);
    const ev = Game.event(), eb = $('#eventBadge');
    eb.classList.toggle('hidden', !ev);
    if (ev) {
      eb.textContent = EVENTS[ev.key].name + ' ' + Math.ceil((ev.until - Date.now()) / 1000) + 's · ' + EVENTS[ev.key].desc;
      eb.className = 'event-badge ' + ev.key;
    }
    const sub = $('#farmSub'), on = Game.medicActive(), loss = Game.lossPerHour();
    if (on) { sub.textContent = s.medicForever ? 'paramédicos para sempre' : 'paramédicos de plantão'; sub.className = 'sub2 good'; }
    else if (loss > 0.005) { sub.textContent = 'mortes: -' + perHour(loss) + '/h'; sub.className = 'sub2 bad'; }
    else { sub.textContent = 'sem mortes'; sub.className = 'sub2'; }
    const ib = $('#btnInfinite');
    ib.textContent = '$MEDO INFINITO: ' + (s.infinite ? 'LIGADO' : 'DESLIGADO');
    ib.classList.toggle('on', !!s.infinite);
    const mb = $('#medicBadge');
    mb.textContent = s.medicForever ? '✚ PARAMÉDICOS PARA SEMPRE' : on ? '✚ PARAMÉDICOS ' + duration(s.medicUntil - Date.now()) : '✚ SEM PARAMÉDICOS';
    mb.className = 'medic-badge ' + (on ? 'on' : 'off');
  }

  function fit() {
    const w = $('#screenWrap'), st = $('#stats');
    World.fit(w.clientWidth - 8, w.clientHeight - 8 - (st ? st.offsetHeight + 12 : 0));
  }
  window.addEventListener('resize', fit);

  function catchUpToast(r, where) {
    if (r.gained > 0) toast(where + ', seus monstros juntaram ' + fmt(r.gained, 3) + ' $MEDO.', 'good');
    if (r.lost > 0) toast('Nesse tempo ~' + r.deaths + ' cliente' + (r.deaths === 1 ? '' : 's') + ' morre' + (r.deaths === 1 ? 'u' : 'ram') + ' sem paramédicos e custaram ' + fmt(r.lost, 3) + ' $MEDO (já descontados).', 'bad');
  }

  // ---------------- boot ----------------
  const isNew = !Game.load();
  // quem chega pelo link de convite de alguém ganha um bônus (só em save novo)
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref) history.replaceState(null, '', location.pathname + location.hash);
  World.start();
  FX.init(World.canvas);
  World.onFrame(FX.render);
  const off = Game.applyOffline();
  hydrate(document.querySelector('.topbar'));
  fit();
  renderPanel();
  hud();
  refreshWallet();
  if (!Game.s.welcomed && !location.hash.includes('nointro')) tutorial();
  else catchUpToast(off, 'Enquanto você esteve fora');
  if (ref && Game.applyReferral(ref.toUpperCase().slice(0, 12), isNew)) toast('Você chegou pelo convite de um amigo: +' + CFG.referralBonus + ' $MEDO!', 'good');

  Game.on('event', e => {
    const ev = EVENTS[e.key];
    if (e.on) toast(ev.name + '! ' + ev.desc, e.key === 'bloodmoon' ? 'bad' : 'good');
    else toast('Fim do evento ' + ev.name + '.', 'info');
    hud();
  });
  setInterval(() => Game.tickEvents(), 1000);
  // teste: começa um evento agora
  const evTest = $('#eventTest');
  // o seletor mostra o evento atual; "NENHUM EVENTO" encerra o que estiver rolando
  evTest.innerHTML = '<option value="">NENHUM EVENTO</option>' + Object.entries(EVENTS).map(([k, e]) => `<option value="${k}">${e.name}</option>`).join('');
  evTest.addEventListener('change', () => { if (evTest.value) Game.startEvent(evTest.value); else Game.stopEvent(); });
  setInterval(() => { if (document.activeElement !== evTest) { const ev = Game.event(); evTest.value = ev ? ev.key : ''; } }, 500);

  setInterval(hud, 250);
  setInterval(renderPanel, 1000);
  setInterval(() => Game.save(), 5000);
  window.addEventListener('beforeunload', () => Game.save());

  // com a aba em segundo plano o parque segue rodando por timer; se a página ficou
  // congelada (o navegador suspende timers depois de um tempo), o buraco rende como offline
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.save(); });
  World.onGap(secs => {
    const r = Game.catchUp(secs);
    if (r.gained > 0 || r.lost > 0) {
      catchUpToast(r, 'Enquanto o jogo esteve parado');
      Game.emit('change');
      hud();
    }
  });
})();
