'use strict';
// ============================================================
//  ESTADO + ECONOMIA (esboço — valores fáceis de ajustar)
// ============================================================

// A economia de cada raridade sai dos dias de ROI (o mint custa 1000 $MEDO):
// roi        = dias para o monstro pagar o próprio mint com paramédicos (ninguém morre)
// roiNoMedic = dias sem paramédicos: as indenizações comem parte do farm
// heart      = chance de cada susto causar infarto. Sem paramédicos o cliente morre e você paga
//              uma indenização à família, calibrada para o ROI sem paramédicos bater.
// farm/dia = 1000 / roi (calculado depois do CFG); o lendário farma o dobro do épico.
const RARITIES = [
  { key: 'comum',    label: 'Comum',    monster: 'Fantasma',  sprite: 'ghost',  roi: 12,  roiNoMedic: 12.5, chance: 0.30,  power: 1, heart: 0.0004, color: '#b9bdd0', float: true },
  { key: 'incomum',  label: 'Incomum',  monster: 'Zumbi',     sprite: 'zombie', roi: 10,  roiNoMedic: 11,   chance: 0.28,  power: 2, heart: 0.001,  color: '#5ee07a', float: false },
  { key: 'raro',     label: 'Raro',     monster: 'Lobisomem', sprite: 'wolf',   roi: 7,   roiNoMedic: 8,    chance: 0.22,  power: 3, heart: 0.002,  color: '#4aa3ff', float: false },
  { key: 'epico',    label: 'Épico',    monster: 'Drácula',   sprite: 'vamp',   roi: 3,   roiNoMedic: 5,    chance: 0.14,  power: 4, heart: 0.016,  color: '#b86bff', float: true },
  { key: 'lendario', label: 'Lendário', monster: 'Dementador', sprite: 'reaper', roi: 1.5, roiNoMedic: 3,    chance: 0.06,  power: 5, heart: 0.04,   color: '#ffb52e', float: true },
];
const RAR = {};
RARITIES.forEach((r, i) => { r.index = i; RAR[r.key] = r; });

// Personagens de cada raridade (distribuição provisória — fácil de trocar aqui).
// key = nome do sprite; short = nome curto mostrado no mapa; float = flutua em vez de pular.
const MONSTERS = [
  { key: 'ghost',     rarity: 'comum',    name: 'Fantasma',       short: 'FANTASMA',  float: true },
  { key: 'mike',      rarity: 'comum',    name: 'Mike Wazowski',  short: 'MIKE' },
  { key: 'shrek',     rarity: 'comum',    name: 'Shrek',          short: 'SHREK' },
  { key: 'grinch',    rarity: 'comum',    name: 'Grinch',         short: 'GRINCH' },
  { key: 'momo',      rarity: 'comum',    name: 'Momo',           short: 'MOMO' },
  { key: 'mummy',     rarity: 'comum',    name: 'Múmia',          short: 'MUMIA' },
  { key: 'frank',     rarity: 'comum',    name: 'Frankenstein',   short: 'FRANKEN' },
  { key: 'zombie',    rarity: 'incomum',  name: 'Zumbi',          short: 'ZUMBI' },
  { key: 'annabelle', rarity: 'incomum',  name: 'Annabelle',      short: 'ANNABELLE' },
  { key: 'chucky',    rarity: 'incomum',  name: 'Chucky',         short: 'CHUCKY' },
  { key: 'foxy',      rarity: 'incomum',  name: 'Foxy',           short: 'FOXY' },
  { key: 'sirenhead', rarity: 'incomum',  name: 'Siren Head',     short: 'SIREN HEAD' },
  { key: 'teemo',     rarity: 'incomum',  name: 'Teemo',          short: 'TEEMO' },
  { key: 'saci',      rarity: 'incomum',  name: 'Saci',           short: 'SACI' },
  { key: 'sulley',    rarity: 'incomum',  name: 'Sulley',         short: 'SULLEY' },
  { key: 'wolf',      rarity: 'raro',     name: 'Lobisomem',      short: 'LOBISOMEM' },
  { key: 'fazbear',   rarity: 'raro',     name: 'Freddy Fazbear', short: 'FAZBEAR' },
  { key: 'samara',    rarity: 'raro',     name: 'Samara Morgan',  short: 'SAMARA',    float: true },
  { key: 'ghostface', rarity: 'raro',     name: 'Ghostface',      short: 'GHOSTFACE' },
  { key: 'slender',   rarity: 'raro',     name: 'Slenderman',     short: 'SLENDER' },
  { key: 'creeper',   rarity: 'raro',     name: 'Creeper',        short: 'CREEPER' },
  { key: 'herobrine', rarity: 'raro',     name: 'Herobrine',      short: 'HEROBRINE' },
  { key: 'vamp',      rarity: 'epico',    name: 'Drácula',        short: 'DRACULA',   float: true },
  { key: 'jason',     rarity: 'epico',    name: 'Jason',          short: 'JASON' },
  { key: 'myers',     rarity: 'epico',    name: 'Michael Myers',  short: 'MYERS' },
  { key: 'pyramid',   rarity: 'epico',    name: 'Pyramid Head',   short: 'PYRAMID' },
  { key: 'jigsaw',    rarity: 'epico',    name: 'Jigsaw (SAW)',   short: 'JIGSAW' },
  { key: 'joker',     rarity: 'epico',    name: 'Coringa',        short: 'CORINGA' },
  { key: 'xeno',      rarity: 'epico',    name: 'Xenomorfo',      short: 'XENOMORFO' },
  { key: 'reaper',    rarity: 'lendario', name: 'Dementador',     short: 'DEMENTADOR', float: true },
  { key: 'pennywise', rarity: 'lendario', name: 'Pennywise',      short: 'PENNYWISE' },
  { key: 'krueger',   rarity: 'lendario', name: 'Freddy Krueger', short: 'KRUEGER' },
  { key: 'vader',     rarity: 'lendario', name: 'Darth Vader',    short: 'VADER' },
  { key: 'trump',     rarity: 'lendario', name: 'Donald Trump',   short: 'TRUMP' },
  { key: 'pinhead',   rarity: 'lendario', name: 'Pinhead',        short: 'PINHEAD' },
  { key: 'nemesis',   rarity: 'lendario', name: 'Nemesis',        short: 'NEMESIS' },
];
const MON = {};
MONSTERS.forEach(k => { MON[k.key] = k; });
RARITIES.forEach(r => { r.kinds = MONSTERS.filter(k => k.rarity === r.key); });
// monstros salvos antes dos personagens não têm `kind`: usam o clássico da raridade
const monOf = m => MON[m.kind] || MON[RAR[m.rarity].sprite];

const CFG = {
  mintCost: 1000,        // $MEDO
  mintCostSol: 0.02,     // SOL
  slots: 8,              // vagas no trilho; cada uma é comprada (a primeira vem no kit de entrada)
  slotCost: 2000,        // $MEDO por vaga depois do kit
  trains: 3,
  speed: 40,             // velocidade dos carrinhos (px/s)
  seatsPerTrain: 4,
  stationSecs: 8,        // tempo médio parado na casa (embarque + desembarque), só para a estimativa
  maxLevel: 5,           // evoluir: o nível N → N+1 queima N repetidos do mesmo personagem
  fuseCount: 5,          // fusão: 5 da mesma raridade viram 1 da raridade de cima
  flowTrains: 2,         // fluxo turbinado (prêmio das missões): carrinhos extras
  referralBonus: 1000,   // $MEDO para quem entra pelo link de convite de alguém
};

// farm = $MEDO/dia com paramédicos; lossDay = $MEDO/dia que vai em indenizações sem eles
RARITIES.forEach(r => {
  r.farm = CFG.mintCost / r.roi;
  r.lossDay = r.farm - CFG.mintCost / r.roiNoMedic;
});

// álbum de figurinhas: uma página por raridade. Colar uma página completa dá $MEDO e um bônus
// de farm para aquela raridade; com o álbum inteiro colado, todo monstro farma mais
const ALBUM = {
  pageReward: { comum: 1000, incomum: 2000, raro: 4000, epico: 8000, lendario: 20000 },
  pageFarm: 0.10,
  fullFarm: 0.25,
};

// redes do jogo: preencha com o @ do perfil no X (sem @) e o link público do jogo
const SOCIAL = {
  twitter: '',           // vazio: a missão de seguir abre o X sem perfil
  site: '',              // vazio: o link de convite usa o endereço atual da página
};

// missões diárias (renovam à meia-noite). social = conta quando o jogador abre o link;
// goal = quantas vezes fazer. flowHours = horas de fluxo turbinado (+carrinhos)
const MISSIONS = [
  { key: 'follow',  social: true, name: 'Siga a Casa Assombrada no X',               reward: { flowHours: 6 } },
  { key: 'tweet',   social: true, name: 'Poste seu parque no X com seu link de convite', reward: { flowHours: 6 } },
  { key: 'invite',  social: true, name: 'Mande seu link de convite para um amigo',     reward: { flowHours: 6 } },
  { key: 'mint',    goal: 3,      name: 'Minte 3 monstros',                          reward: { flowHours: 6 } },
  { key: 'collect', goal: 10,     name: 'Clique em 10 coisinhas pelo parque',        reward: { medo: 300 } },
  { key: 'upgrade', goal: 1,      name: 'Evolua ou funda um monstro',                reward: { medo: 300 } },
];

// eventos que aparecem de vez em quando (e com mais frequência na data de verdade)
const EVENTS = {
  bloodmoon: { name: 'LUA VERMELHA',   secs: 75,  farm: 2,   heart: 1, trains: 0, desc: 'farm x2 · clique nos lobisomens antes que ataquem os carrinhos!' },
  friday13:  { name: 'SEXTA-FEIRA 13', secs: 120, farm: 1.5, heart: 2, trains: 0, desc: 'farm x1.5 · infarto x2 · Jason rende x3 · gatos pretos valem ouro' },
  halloween: { name: 'HALLOWEEN',      secs: 120, farm: 2,   heart: 1, trains: 1, desc: 'farm x2 · +1 carrinho · chuva de doces para pegar!' },
};

// paramédicos (pagos em SOL): com eles, o infarto não mata e o visitante segue no carrinho
const MEDICS = [
  { key: 'd1', days: 1, sol: 0.1, name: '1 DIA' },
  { key: 'd3', days: 3, sol: 0.3, name: '3 DIAS' },
  { key: 'forever', forever: true, sol: 1, name: 'PARA SEMPRE' },
];
const DAY_MS = 86400000;

const SAVE_KEY = 'casaAssombrada.v1';
// campos de saves antigos (PvP, loja, log, indenização) que não existem mais
const OBSOLETE = ['rivals', 'defenses', 'nextRaidAt', 'log', 'slotsUnlocked', 'trains', 'speedLvl', 'heartAttacks', 'indemnities'];
const r4 = v => Math.round(v * 10000) / 10000;

const Game = {
  s: null,
  trackLen: 900,
  slotOrder: [0, 1, 2, 3, 4, 5, 6, 7], // vagas na ordem em que o trem passa (o mundo preenche)
  _ev: {},

  on(ev, fn) { (this._ev[ev] = this._ev[ev] || []).push(fn); },
  emit(ev, d) { (this._ev[ev] || []).forEach(f => f(d)); },

  fresh() {
    return {
      v: 2,
      medo: 0,
      totalScares: 0,
      totalEarned: 0,
      monsters: [],
      nextId: 1,
      slots: [],             // vagas compradas (índices do mapa)
      kit: { slot: 1, mint: 1 }, // kit de entrada (pago com a taxa em token): 1 vaga + 1 mint
      trackSeed: Math.floor(Math.random() * 1e9),
      medicUntil: 0,
      medicForever: false,
      deaths: 0,
      saved: 0,
      lost: 0,               // $MEDO que morreu junto com os visitantes
      flowUntil: 0,          // fluxo turbinado (prêmio das missões) até esta hora
      refCode: Game.newRefCode(),
      referredBy: null,
      daily: null,           // missões do dia: { day, progress, opened, claimed }
      album: { seen: {}, claimed: {} },
      wallet: null,
      demoSol: 2,
      infinite: false,
      welcomed: false,
      lastSave: Date.now(),
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && (d.v === 1 || d.v === 2)) {
          // v1 → v2: o mint passou de 1 para 1000 $MEDO, então o saldo antigo vale 1000x
          if (d.v === 1) { d.medo = (d.medo || 0) * 1000; d.totalEarned = (d.totalEarned || 0) * 1000; d.v = 2; }
          OBSOLETE.forEach(k => delete d[k]);
          this.s = Object.assign(this.fresh(), d);
          this.s.monsters.forEach(m => {
            delete m.mission; delete m.cooldownUntil;
            if (m.slot >= CFG.slots) m.slot = -1;
          });
          if (!this.s.refCode) this.s.refCode = this.newRefCode();
          // saves de antes das vagas compradas: todas as vagas continuam abertas
          if (!Array.isArray(d.slots)) this.s.slots = Array.from({ length: CFG.slots }, (_, i) => i);
          if (!d.kit) this.s.kit = { slot: 0, mint: 0 };
          if (!d.album) { this.s.album = null; this.album(); }
          return true;
        }
      }
    } catch (e) { /* sem storage: segue com estado novo */ }
    this.s = this.fresh();
    return false;
  },
  save() {
    try { this.s.lastSave = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { }
  },
  newRefCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 6; i++) c += abc[Math.floor(Math.random() * abc.length)];
    return c;
  },
  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    this.s = this.fresh();
    this.emit('change');
  },

  // ganhos offline (metade da taxa estimada, máx. 2h)
  applyOffline() {
    return this.catchUp((Date.now() - (this.s.lastSave || Date.now())) / 1000);
  },
  // credita o tempo em que os trens não rodaram (jogo fechado ou aba escondida); no período
  // sem paramédicos as indenizações e os clientes mortos já saem do ganho
  catchUp(secs) {
    const s = this.s, now = Date.now();
    secs = Math.min(secs, 7200);
    if (secs < 30) return { gained: 0, lost: 0, deaths: 0 };
    const covered = s.medicForever ? secs : Math.max(0, Math.min(now, s.medicUntil) - (now - secs * 1000)) / 1000;
    const exposed = secs - covered, gross = this.grossRate(), risk = this.risk();
    const gained = r4((gross * covered + (risk.farm - risk.fees) * exposed) * 0.5);
    const lost = r4((gross - risk.farm + risk.fees) * exposed * 0.5);
    const deaths = Math.round(risk.deaths * exposed * 0.5);
    this.earn(gained);
    s.deaths += deaths;
    s.lost = r4(s.lost + risk.fees * exposed * 0.5);
    return { gained, lost, deaths };
  },

  // ---------------- moeda ----------------
  earn(amount) {
    const s = this.s;
    s.medo = r4(s.medo + amount);
    s.totalEarned = r4(s.totalEarned + amount);
  },
  scared(n) { this.s.totalScares += n; },
  // modo de teste "$MEDO infinito": nada custa $MEDO e o saldo real fica guardado
  canAfford(amount) { return this.s.infinite || this.s.medo + 1e-9 >= amount; },
  spend(amount) {
    if (this.s.infinite) return true;
    if (!this.canAfford(amount)) { this.emit('toast', { text: 'Medo insuficiente! Faltam ' + (amount - this.s.medo).toFixed(2) + ' $MEDO', kind: 'bad' }); return false; }
    this.s.medo = r4(this.s.medo - amount);
    return true;
  },
  toggleInfinite() {
    this.s.infinite = !this.s.infinite;
    this.emit('change');
    this.save();
    return this.s.infinite;
  },

  // ---------------- farm ----------------
  // carrinhos rodando agora: os da configuração + fluxo turbinado + evento
  trainCount() {
    const ev = this.event();
    return CFG.trains + (this.flowActive() ? CFG.flowTrains : 0) + (ev ? EVENTS[ev.key].trains : 0);
  },
  ridersPerSec(trains) {
    const loop = this.trackLen / CFG.speed + CFG.stationSecs;
    return (trains || this.trainCount()) / loop * CFG.seatsPerTrain * 0.9;
  },
  // clientes por segundo com os carrinhos normais (base do valor de cada susto)
  baseRidersPerSec() { return this.ridersPerSec(CFG.trains); },
  placed() { return this.slotOrder.map(i => this.monsterAt(i)).filter(Boolean); },
  // $MEDO por segundo se ninguém morresse
  grossRate() { return this.placed().reduce((a, m) => a + this.rewardOf(m), 0) * this.ridersPerSec(); },
  // fração dos visitantes que passa por todos os monstros sem infartar
  survival() { return this.placed().reduce((a, m) => a * (1 - RAR[m.rarity].heart), 1); },
  // sem paramédicos, por segundo e na ordem do trilho: quem morre não chega aos monstros
  // seguintes e cada morte custa a indenização do monstro que matou
  risk() {
    const rps = this.ridersPerSec();
    let alive = 1, farm = 0, fees = 0;
    for (const m of this.placed()) {
      const rar = RAR[m.rarity];
      farm += alive * this.rewardOf(m);
      fees += alive * rar.heart * this.indemnityOf(rar);
      alive *= 1 - rar.heart;
    }
    return { farm: farm * rps, fees: fees * rps, deaths: (1 - alive) * rps };
  },
  // o que de fato entra na carteira por segundo
  estimatedRate() {
    if (this.medicActive()) return this.grossRate();
    const r = this.risk();
    return r.farm - r.fees;
  },
  farmPerHour() { return this.estimatedRate() * 3600; },
  lossPerHour() { return (this.grossRate() - this.estimatedRate()) * 3600; },
  deathsPerHour() { return this.medicActive() ? 0 : this.risk().deaths * 3600; },
  // indenização de uma morte: o que a raridade perde por dia sem paramédicos dividido pelas
  // mortes que ela causa por dia neste trilho (mesma conta do valor do susto)
  indemnityOf(rar) { return rar.lossDay / (rar.heart * this.baseRidersPerSec() * 86400); },

  // ---------------- monstros ----------------
  farmDayOf(m) { return RAR[m.rarity].farm * (1 + 0.25 * (m.level - 1)) * this.albumMult(m.rarity); },
  // $MEDO de um susto: o farm diário dividido pelos visitantes que passam por dia neste trilho
  rewardOf(m) { return this.farmDayOf(m) / (this.baseRidersPerSec() * 86400); },
  monster(id) { return this.s.monsters.find(m => m.id === id); },
  monsterAt(slot) { return this.s.monsters.find(m => m.slot === slot); },
  rollRarity() {
    let r = Math.random();
    for (const rar of RARITIES) { if (r < rar.chance) return rar.key; r -= rar.chance; }
    return 'comum';
  },
  mintCost(count) { return r4(CFG.mintCost * count); },
  mintCostSol(count) { return +(CFG.mintCostSol * count).toFixed(4); },
  // minta `count` monstros de uma vez (um pagamento só); devolve a lista ou null
  mint(paidWithSol, count) {
    const kit = !paidWithSol && this.s.kit.mint > 0;
    const n = kit ? 1 : count || 1;
    if (kit) this.s.kit.mint--;
    else if (!paidWithSol && !this.spend(this.mintCost(n))) return null;
    const made = [];
    for (let i = 0; i < n; i++) made.push(this.create(this.rollRarity()));
    this.progress('mint', n);
    this.emit('change');
    this.save();
    return made;
  },
  // cria um personagem aleatório da raridade no inventário (o jogador escolhe a vaga)
  create(rarity) {
    const kinds = RAR[rarity].kinds;
    const m = { id: this.s.nextId++, rarity, kind: kinds[Math.floor(Math.random() * kinds.length)].key, level: 1, slot: -1 };
    this.s.monsters.push(m);
    this.discover(m.kind);
    return m;
  },
  // põe os melhores da lista nas vagas compradas que estão livres; devolve quantos entraram
  autoPlace(list) {
    const best = list.filter(m => m.slot < 0).sort((a, b) => this.farmDayOf(b) - this.farmDayOf(a));
    let n = 0;
    for (const m of best) {
      const free = this.freeSlot();
      if (free < 0) break;
      m.slot = free; n++;
    }
    if (n) { this.emit('change'); this.save(); }
    return n;
  },
  burn(list) {
    const ids = new Set(list.map(x => x.id));
    this.s.monsters = this.s.monsters.filter(x => !ids.has(x.id));
  },

  // ---------------- evolução e fusão ----------------
  // só entram cópias de nível 1 que estão no inventário (fora da pista)
  dupesOf(m) { return this.s.monsters.filter(x => x !== m && x.kind === m.kind && x.level === 1 && x.slot < 0); },
  evolveCost(m) { return m.level >= CFG.maxLevel ? null : m.level; },
  evolve(id) {
    const m = this.monster(id), n = m && this.evolveCost(m), dupes = m ? this.dupesOf(m) : [];
    if (!n || dupes.length < n) return false;
    this.burn(dupes.slice(0, n));
    m.level++;
    this.progress('upgrade');
    this.emit('change');
    this.save();
    return true;
  },
  fusePool(rarity) { return this.s.monsters.filter(x => x.rarity === rarity && x.level === 1 && x.slot < 0); },
  // cada fusão queima 5 da raridade e cria 1 aleatório da raridade de cima
  fuse(rarity, times) {
    const next = RARITIES[RAR[rarity].index + 1];
    if (!next) return [];
    const made = [];
    for (let t = 0; t < times; t++) {
      const pool = this.fusePool(rarity);
      if (pool.length < CFG.fuseCount) break;
      this.burn(pool.slice(0, CFG.fuseCount));
      made.push(this.create(next.key));
    }
    if (made.length) { this.progress('upgrade'); this.emit('change'); this.save(); }
    return made;
  },
  // ---------------- vagas ----------------
  // cada vaga do trilho é comprada; o kit de entrada paga a primeira
  ownsSlot(i) { return this.s.slots.includes(i); },
  buySlot(i) {
    const s = this.s;
    if (i < 0 || i >= CFG.slots || this.ownsSlot(i)) return false;
    if (s.kit.slot > 0) s.kit.slot--;
    else if (!this.spend(CFG.slotCost)) return false;
    s.slots.push(i);
    this.emit('change');
    this.save();
    return true;
  },
  // primeira vaga comprada e vazia, na ordem do trilho
  freeSlot() {
    for (const i of this.slotOrder) if (this.ownsSlot(i) && !this.monsterAt(i)) return i;
    return -1;
  },
  place(id, slot) {
    const m = this.monster(id);
    if (!m || !this.ownsSlot(slot)) return;
    const other = this.monsterAt(slot);
    if (other && other !== m) other.slot = -1;
    m.slot = slot;
    this.emit('change');
    this.save();
  },
  unplace(id) {
    const m = this.monster(id);
    if (m) { m.slot = -1; this.emit('change'); this.save(); }
  },

  // ---------------- infarto + paramédicos ----------------
  medicActive() { return this.s.medicForever || this.s.medicUntil > Date.now(); },
  // um susto causou infarto. Com paramédicos o cliente é salvo e continua; sem eles morre e
  // você paga a indenização à família (o que já farmou com ele fica)
  heartAttack(m) {
    const s = this.s;
    if (this.medicActive()) {
      s.saved++;
      return { saved: true };
    }
    const fee = this.payIndemnity(this.indemnityOf(RAR[m.rarity]));
    this.emit('kill', { m, fee });
    return { saved: false, fee };
  },
  // ataque de lobisomem (Lua Vermelha): paramédico não resolve
  wolfKill() {
    const fee = this.payIndemnity(this.indemnityOf(RAR.raro));
    this.emit('kill', { fee, wolf: true });
    return fee;
  },
  // sai da carteira até zerar (sem dívida)
  payIndemnity(fee) {
    const s = this.s, paid = r4(Math.min(s.medo, fee));
    s.medo = r4(s.medo - paid);
    s.lost = r4(s.lost + paid);
    s.deaths++;
    return paid;
  },
  buyMedic(plan) {
    const s = this.s;
    if (plan.forever) s.medicForever = true;
    else s.medicUntil = Math.max(Date.now(), s.medicUntil) + plan.days * DAY_MS;
    this.emit('toast', { text: plan.forever ? 'Paramédicos contratados para sempre!' : 'Paramédicos de plantão por ' + plan.days + (plan.days > 1 ? ' dias' : ' dia') + '!', kind: 'good' });
    this.emit('change');
    this.save();
  },

  // ---------------- eventos ----------------
  _event: null,           // { key, until } — não vai para o save
  nextEventAt: Date.now() + (6 + Math.random() * 6) * 60000,
  event() { return this._event && this._event.until > Date.now() ? this._event : null; },
  eventFarm(m) {
    const ev = this.event();
    if (!ev) return 1;
    return EVENTS[ev.key].farm * (ev.key === 'friday13' && m && m.kind === 'jason' ? 3 : 1);
  },
  eventHeart() { const ev = this.event(); return ev ? EVENTS[ev.key].heart : 1; },
  // encerra o evento atual na hora (o próximo continua sorteado como sempre)
  stopEvent() {
    if (!this._event) return;
    this._event.until = Date.now();
    this.tickEvents();
  },
  startEvent(key) {
    this._event = { key, until: Date.now() + EVENTS[key].secs * 1000 };
    this.nextEventAt = this._event.until + (6 + Math.random() * 6) * 60000;
    this.emit('event', { key, on: true });
    this.emit('change');
  },
  // chamado pela interface a cada segundo: encerra o evento atual e sorteia o próximo.
  // Na data de verdade (31/10 ou sexta-feira 13) o evento do dia vem bem mais vezes.
  tickEvents() {
    const now = Date.now();
    if (this._event && this._event.until <= now) {
      const key = this._event.key;
      this._event = null;
      this.emit('event', { key, on: false });
      this.emit('change');
    }
    if (this._event || now < this.nextEventAt) return;
    const d = new Date();
    const today = d.getMonth() === 9 && d.getDate() === 31 ? 'halloween' : d.getDay() === 5 && d.getDate() === 13 ? 'friday13' : null;
    const keys = Object.keys(EVENTS);
    this.startEvent(today && Math.random() < 0.7 ? today : keys[Math.floor(Math.random() * keys.length)]);
    if (today) this.nextEventAt = this._event.until + (2 + Math.random() * 3) * 60000;
  },

  // ---------------- fluxo turbinado ----------------
  flowActive() { return this.s.flowUntil > Date.now(); },

  // ---------------- missões diárias ----------------
  today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  daily() {
    const s = this.s, day = this.today();
    if (!s.daily || s.daily.day !== day) s.daily = { day, progress: {}, opened: {}, claimed: {} };
    return s.daily;
  },
  progress(key, n) { const d = this.daily(); d.progress[key] = (d.progress[key] || 0) + (n || 1); },
  missionDone(m) { const d = this.daily(); return m.social ? !!d.opened[m.key] : (d.progress[m.key] || 0) >= m.goal; },
  openMission(key) { this.daily().opened[key] = true; this.save(); this.emit('change'); },
  claimMission(key) {
    const m = MISSIONS.find(x => x.key === key), d = this.daily();
    if (!m || d.claimed[key] || !this.missionDone(m)) return false;
    d.claimed[key] = true;
    if (m.reward.medo) this.earn(m.reward.medo);
    if (m.reward.flowHours) this.s.flowUntil = Math.max(Date.now(), this.s.flowUntil) + m.reward.flowHours * 3600000;
    this.emit('change');
    this.save();
    return true;
  },

  // ---------------- convite ----------------
  inviteLink() {
    const base = SOCIAL.site || (location.origin + location.pathname);
    return base + '?ref=' + this.s.refCode;
  },
  // jogador novo que chegou pelo link de alguém ganha um bônus
  applyReferral(code, isNew) {
    if (!code || !isNew || code === this.s.refCode || this.s.referredBy) return false;
    this.s.referredBy = code;
    this.earn(CFG.referralBonus);
    this.save();
    return true;
  },

  // ---------------- álbum ----------------
  newStickers: [],        // figurinhas liberadas desde a última vez que a interface olhou
  album() {
    const s = this.s;
    // saves de antes do álbum: libera tudo o que o jogador já tem
    if (!s.album) { s.album = { seen: {}, claimed: {} }; s.monsters.forEach(m => { s.album.seen[monOf(m).key] = true; }); }
    return s.album;
  },
  discover(kind) {
    const a = this.album();
    if (a.seen[kind]) return;
    a.seen[kind] = true;
    this.newStickers.push(kind);
  },
  takeNewStickers() { const k = this.newStickers; this.newStickers = []; return k; },
  pageCount(rarity) { const a = this.album(); return RAR[rarity].kinds.filter(k => a.seen[k.key]).length; },
  pageDone(rarity) { return this.pageCount(rarity) === RAR[rarity].kinds.length; },
  claimPage(rarity) {
    const a = this.album();
    if (a.claimed[rarity] || !this.pageDone(rarity)) return false;
    a.claimed[rarity] = true;
    this.earn(ALBUM.pageReward[rarity]);
    this.emit('change');
    this.save();
    return true;
  },
  albumComplete() { const a = this.album(); return RARITIES.every(r => a.claimed[r.key]); },
  albumMult(rarity) {
    const a = this.album();
    return (a.claimed[rarity] ? 1 + ALBUM.pageFarm : 1) * (this.albumComplete() ? 1 + ALBUM.fullFarm : 1);
  },

  // ---------------- coisinhas clicáveis ----------------
  // vale uns minutos de farm (no mínimo 2 $MEDO); mult muda por tipo
  goodieValue(mult) { return r4(Math.max(2, this.farmPerHour() / 60 * 2.5) * (mult || 1)); },
  collect(amount) { this.earn(amount); this.progress('collect'); },
};
