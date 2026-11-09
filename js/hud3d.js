'use strict';
// ============================================================
//  HUD 3D — barra da carteira, doca de atalhos, menu principal, opções e tutorial do jogo em 3D.
//  Script clássico: o módulo do jogo chama initHud3D(contexto) depois de montar o parque.
// ============================================================

// ícones em pixel usados na HUD
Object.assign(SPRITES, {
  ic_eye: ['..kkkkk..', '.kwwwwwk.', 'kwwkkkwwk', 'kwwkekwwk', 'kwwkkkwwk', '.kwwwwwk.', '..kkkkk..'],
  ic_play: ['.kk......', '.kyk.....', '.kyyk....', '.kyyyk...', '.kyyyyk..', '.kyyyk...', '.kyyk....', '.kyk.....', '.kk......'],
  ic_pause: ['.........', '.kkk.kkk.', '.kwk.kwk.', '.kwk.kwk.', '.kwk.kwk.', '.kwk.kwk.', '.kwk.kwk.', '.kkk.kkk.', '.........'],
  ic_help: ['..kkkkk..', '.kyyyyyk.', '.kykkkyk.', '..k.kyyk.', '...kyyk..', '...kyk...', '...kkk...', '...kyk...', '...kkk...'],
  ic_sound: ['....kk...', '...kwk.k.', 'kkkwwk..k', 'kwwwwk.kk', 'kwwwwk..k', 'kwwwwk.kk', 'kkkwwk..k', '...kwk.k.', '....kk...'],
  ic_mute: ['....kk...', '...kwk...', 'kkkwwkr.r', 'kwwwwk.r.', 'kwwwwkr.r', 'kwwwwk...', 'kkkwwk...', '...kwk...', '....kk...'],
  ic_house: ['....k....', '...kQk...', '..kQQQk..', '.kQQQQQk.', 'kkkkkkkkk', '.kqqqqqk.', '.kqykyqk.', '.kqqkqqk.', '.kkkkkkk.'],
  ic_menu: ['.........', 'kkkkkkkkk', 'kwwwwwwwk', 'kkkkkkkkk', 'kwwwwwwwk', 'kkkkkkkkk', 'kwwwwwwwk', 'kkkkkkkkk', '.........'],
});

function initHud3D(C) {
  const { Game, CIN, view, state, settings, carts, slots } = C;
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const PLAYED = 'cs3d.jogou';
  for (const id of ['topbar', 'dock', 'fpHud']) C.hydrate($(id));
  const setIcon = (el, name) => { const c = el.querySelector('canvas'); if (c.dataset.spr !== name) { c.dataset.spr = name; C.hydrate(el); } };

  /* ---------- menu principal e opções ---------- */
  const menu = $('menu');
  let resetArmed = 0;
  const showOpts = (on) => { $('menuMain').hidden = on; $('menuOpts').hidden = !on; if (on) syncOpts(); };
  function openMenu(start) {
    if (CIN.riding) CIN.ride(false);
    menu.hidden = false; body.classList.add('menu-open');
    $('mPlayTxt').textContent = start ? 'JOGAR' : 'CONTINUAR';
    showOpts(false);
    $('mPlay').focus();
  }
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true; body.classList.remove('menu-open');
    try { sessionStorage.setItem(PLAYED, '1'); } catch (e) { /* sem storage */ }
    CIN.audio.unlock();
  }
  function syncOpts() {
    $('oReal').setAttribute('aria-pressed', String(!settings.pixel));
    $('oPixel').setAttribute('aria-pressed', String(settings.pixel));
    document.querySelectorAll('[data-q]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.q === CIN.quality)));
    $('oVol').value = Math.round(CIN.audio.vol * 100);
    $('oMute').setAttribute('aria-pressed', String(CIN.audio.muted));
    $('oMute').textContent = CIN.audio.muted ? 'SOM DESLIGADO' : 'SOM LIGADO';
    $('oNames').setAttribute('aria-pressed', String(settings.names));
    $('oNames').textContent = settings.names ? 'NOMES À MOSTRA' : 'NOMES ESCONDIDOS';
    $('oReset').textContent = 'APAGAR TODO O PROGRESSO';
    resetArmed = 0;
  }
  $('menuBtn').addEventListener('click', () => openMenu(false));
  $('mPlay').addEventListener('click', () => { const first = !Game.s.tut3d; closeMenu(); if (first) tutorial(); });
  $('mRide').addEventListener('click', () => { closeMenu(); CIN.ride(true); });
  $('mHelp').addEventListener('click', () => { closeMenu(); tutorial(); });
  $('mOpts').addEventListener('click', () => showOpts(true));
  $('mBack').addEventListener('click', () => showOpts(false));
  $('oReal').addEventListener('click', () => { C.setPixel(false); syncOpts(); });
  $('oPixel').addEventListener('click', () => { C.setPixel(true); syncOpts(); });
  document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { CIN.setQuality(+b.dataset.q); syncOpts(); }));
  $('oVol').addEventListener('input', (e) => { CIN.audio.unlock(); CIN.audio.set(e.target.value / 100, false); syncOpts(); syncDock(); });
  $('oMute').addEventListener('click', () => { CIN.audio.set(CIN.audio.vol, !CIN.audio.muted); syncOpts(); syncDock(); });
  $('oNames').addEventListener('click', () => { const c = $('cNames'); c.checked = !c.checked; settings.names = c.checked; syncOpts(); });
  // apagar o progresso pede um segundo clique
  $('oReset').addEventListener('click', () => {
    if (Date.now() - resetArmed > 4000) { resetArmed = Date.now(); $('oReset').textContent = 'CLIQUE DE NOVO PARA CONFIRMAR'; return; }
    Game.save = () => {};
    try { for (const k of ['casaAssombrada.3d.v1', LAB_KEY, PLAYED]) { localStorage.removeItem(k); sessionStorage.removeItem(k); } } catch (e) { /* sem storage */ }
    location.reload();
  });
  CIN.onRideChange = (on) => { if (on) { closeMenu(); endTutorial(); } syncDock(); };

  /* ---------- doca ---------- */
  function syncDock() {
    setIcon($('dkPause'), state.paused ? 'ic_play' : 'ic_pause');
    $('dkPause').setAttribute('aria-pressed', String(state.paused));
    $('dkSpeed').textContent = '×' + state.speed;
    setIcon($('dkSound'), CIN.audio.muted ? 'ic_mute' : 'ic_sound');
  }
  $('rideBtn').addEventListener('click', () => CIN.ride(true));
  $('dkPause').addEventListener('click', () => { C.setPaused(!state.paused); syncDock(); });
  $('dkSpeed').addEventListener('click', () => { $('speed').click(); syncDock(); });
  $('dkSound').addEventListener('click', () => { CIN.audio.unlock(); CIN.audio.set(CIN.audio.vol, !CIN.audio.muted); syncDock(); });
  $('dkHelp').addEventListener('click', () => tutorial());
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || CIN.riding) return;
    if (tut) endTutorial(); else if (!menu.hidden && !$('menuOpts').hidden) showOpts(false); else if (!menu.hidden) closeMenu();
  });

  /* ---------- tutorial ---------- */
  // O Sr. Calafrio apresenta o parque. Passos com `focus` levam a câmera até o trem ou até um boneco;
  // passos com `el` iluminam um pedaço da HUD.
  const TUT = [
    { text: 'Bem-vindo à Casa Assombrada! Eu sou o Sr. Calafrio, dono deste parque. Vem comigo que eu te mostro como se ganha dinheiro com o medo dos outros.' },
    { focus: 'train', zoom: 2.4, text: 'Este é o trem fantasma. Os clientes embarcam na estação, dão a volta na ilha e voltam para a casa... quase sempre.' },
    { focus: 'monster', zoom: 3, text: 'Cada boneco na beira do trilho assusta quem passa, e susto vale $MEDO. Quanto mais raro o boneco, mais ele rende e mais gente ele mata do coração.' },
    { el: '#cartMeter', text: 'O dinheiro dos sustos vai enchendo o carrinho. Ele só cai na sua carteira quando o trem chega de volta na casa.' },
    { el: '.boxes', tab: 'mons', text: 'Abra o caixão para mintar bonecos e o baú para ganhar itens. O boneco vai para o inventário: coloque ele na pista pelo botão COLOCAR ou clicando numa vaga vazia do mapa.' },
    { el: '#tabItems', text: 'Na aba ITENS você equipa o que saiu do baú. Cada item vale para os bonecos da ilha onde ele está.' },
    { el: '#tabPark', text: 'Na aba PARQUE ficam os paramédicos, que salvam quem infarta, a compra de ilhas novas e os trechos turbo.' },
    { el: '#rideBtn', text: 'Quer sentir na pele? Clique em ANDAR NO TREM e dê uma volta como cliente. Só não vale infartar.' },
    { el: '#menuBtn', text: 'No menu ficam as opções de visual e de som, e este passeio de novo quando você quiser. Bons sustos!' },
  ];
  let tut = null;
  function tutorial() {
    if (tut) return;
    if (CIN.riding) CIN.ride(false);
    closeMenu();
    if (window.innerWidth <= 760) $('panel').classList.add('open');
    tut = { i: -1, t0: 0, cam: { target: view.target.clone(), zoom: view.zoomT }, timer: 0 };
    $('tut').hidden = false; body.classList.add('tut-on');
    $('tutDots').innerHTML = TUT.map(() => '<i></i>').join('');
    tut.timer = setInterval(tick, 33);
    go(0);
  }
  function endTutorial() {
    if (!tut) return;
    clearInterval(tut.timer);
    view.target.copy(tut.cam.target); view.zoomT = tut.cam.zoom;
    tut = null;
    $('tut').hidden = true; body.classList.remove('tut-on');
    Game.s.tut3d = true; Game.save();
  }
  function go(n) {
    if (n >= TUT.length) { endTutorial(); return; }
    tut.i = n; tut.t0 = performance.now();
    const st = TUT[n];
    if (st.tab) C.setTab(st.tab);
    if (!st.focus) { view.target.copy(tut.cam.target); view.zoomT = tut.cam.zoom; }
    [...$('tutDots').children].forEach((d, k) => d.classList.toggle('on', k <= n));
    $('tutNext').textContent = n === TUT.length - 1 ? 'ABRIR O PARQUE' : 'PRÓXIMO';
    place();
  }
  function place() {
    const st = TUT[tut.i], el = st.el && document.querySelector(st.el), hole = $('tutHole');
    const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
    hole.hidden = !r;
    $('tutShade').hidden = !!r;
    $('tutBox').classList.toggle('top', !!r && r.top + r.height / 2 > window.innerHeight * 0.55);
    if (r) Object.assign(hole.style, { left: r.left - 8 + 'px', top: r.top - 8 + 'px', width: r.width + 16 + 'px', height: r.height + 16 + 'px' });
  }
  function tick() {
    const st = TUT[tut.i], n = Math.min(st.text.length, Math.floor((performance.now() - tut.t0) / 22));
    const box = $('tutText');
    if (box.textContent.length !== n) box.textContent = st.text.slice(0, n);
    const x = $('tutHost').getContext('2d'), t = performance.now() / 1000;
    x.clearRect(0, 0, 16, 27);
    x.drawImage(getSprite(n < st.text.length && Math.floor(t * 8) % 2 ? 'host_t' : 'host'), 0, 1 + Math.round(Math.sin(t * 2.4)));
  }
  $('tutNext').addEventListener('click', () => { const st = TUT[tut.i]; if ((performance.now() - tut.t0) / 22 < st.text.length) tut.t0 = 0; else go(tut.i + 1); });
  $('tutSkip').addEventListener('click', endTutorial);
  window.addEventListener('resize', () => { if (tut) place(); });

  /* ---------- quadro a quadro ---------- */
  let dockT = 0;
  function update(dtReal) {
    if (!menu.hidden) view.yawT += dtReal * 0.05;       // a ilha gira devagar atrás do menu
    if (tut) {
      const st = TUT[tut.i];
      if (st.focus) {
        const mon = slots.find((s) => s.mon), p = st.focus === 'train' || !mon ? carts[0].g.position : mon.mon.g.position;
        view.target.lerp(p, Math.min(1, dtReal * 3)); view.target.y = 0.6;
        view.zoomT = st.zoom * C.MAP_S;
      }
    }
    $('carryCart').style.left = $('carryBar').style.width || '0%';
    dockT -= dtReal;
    if (dockT <= 0) { dockT = 0.3; syncDock(); }
  }

  let played = false;
  try { played = !!sessionStorage.getItem(PLAYED); } catch (e) { /* sem storage */ }
  // recarregar na mesma sessão (comprar uma ilha recarrega a página) não mostra o menu de novo
  if (played) { menu.hidden = true; document.addEventListener('pointerdown', () => CIN.audio.unlock(), { once: true }); }
  else openMenu(true);
  syncDock();
  return { update, openMenu, closeMenu, tutorial, endTutorial };
}
