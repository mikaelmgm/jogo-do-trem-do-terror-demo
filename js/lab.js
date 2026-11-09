'use strict';
// ============================================================
//  LABORATÓRIO — aba TESTE
//  Cada sistema novo tem várias versões e a aba escolhe qual vale. Tudo o que é experimental
//  (catálogo, contas, aba) fica neste arquivo: state.js continua igual, então o parque 3D e
//  tools/simulacao-economia.js não mudam. Quando as versões forem escolhidas, as vencedoras
//  vão para state.js e o resto sai junto com este arquivo.
// ============================================================

// ---------------- expansão do mapa ----------------
// Cada nível acrescenta um laço ao trilho. view = tamanho do mapa depois da compra (a câmera se
// afasta); at = trecho do trilho de onde o laço sai; c = centro do laço; rOut/rT = raios; slots = vagas novas. O canto de cima à direita
// (casa e entrada) fica parado, então o mapa cresce para a esquerda e para baixo.
const LAB_MAP = {
  big: { noun: 'EXPANSÃO', levels: [
    { cost: 6000,  view: [520, 338], lobe: { at: [70, 100],  c: [-50, 130],  rOut: 46,  rT: 62, slots: 4 } },
    { cost: 14000, view: [640, 416], lobe: { at: [250, 225], c: [235, 350],  rOut: 50,  rT: 95, slots: 5 } },
    { cost: 32000, view: [760, 494], lobe: { at: [80, 215],  c: [-175, 370], rOut: 100, rT: 72, slots: 6 } },
  ] },
  islands: { noun: 'ILHA', levels: [
    { name: 'Pântano',  cost: 8000,  view: [590, 384], lobe: { at: [70, 105],  c: [-105, 150], rOut: 52, rT: 62, slots: 4 }, isle: { x: -105, y: 150, rx: 78,  ry: 88, theme: 0 }, perk: { farm: 0.10, heart: 1 },    perkText: '+10% de farm nos bonecos desta ilha' },
    { name: 'Ossuário', cost: 18000, view: [700, 455], lobe: { at: [250, 225], c: [235, 372],  rOut: 50, rT: 92, slots: 5 }, isle: { x: 235,  y: 372, rx: 126, ry: 76, theme: 1 }, perk: { farm: 0,    heart: 0.75 }, perkText: '-25% de infarto nos bonecos desta ilha' },
    { name: 'Estúdio',  cost: 40000, view: [800, 520], lobe: { at: [80, 215],  c: [-215, 400], rOut: 62, rT: 68, slots: 5 }, isle: { x: -215, y: 400, rx: 112, ry: 102, theme: 2 }, perk: { farm: 0.25, heart: 1.2 }, perkText: '+25% de farm e +20% de infarto nesta ilha' },
  ] },
  bits: { noun: 'TRECHO', levels: [
    { cost: 2500,  view: [470, 306], lobe: { at: [70, 95],   c: [-20, 125], rOut: 32, rT: 52, slots: 2 } },
    { cost: 5000,  view: [540, 351], lobe: { at: [75, 205],  c: [-60, 262], rOut: 40, rT: 56, slots: 3 } },
    { cost: 9000,  view: [610, 396], lobe: { at: [170, 232], c: [140, 322], rOut: 42, rT: 72, slots: 3 } },
    { cost: 15000, view: [680, 442], lobe: { at: [320, 210], c: [320, 345], rOut: 44, rT: 62, slots: 3 } },
  ] },
};

// ---------------- ganho por raridade (comum → lendário) ----------------
// roi = dias para pagar o mint com paramédicos; noMedic = sem eles; heart = chance de infarto por susto
const LAB_RARITY = {
  suave:   { roi: [12, 9.5, 7.5, 5.5, 4], noMedic: [12.6, 10.3, 8.5, 7, 6],     heart: [0.0005, 0.001, 0.002, 0.006, 0.012] },
  dobra:   { roi: [16, 8, 4, 2, 1],       noMedic: [17, 9, 5, 3, 2],            heart: [0.0004, 0.001, 0.003, 0.01, 0.03] },
  comum:   { roi: [9, 8, 6.5, 5, 3.5],    noMedic: [9.4, 8.7, 7.5, 6.5, 5.5],   heart: [0.0003, 0.0008, 0.002, 0.008, 0.02] },
  estrela: { roi: [20, 15, 10, 4, 0.8],   noMedic: [21, 16, 12, 7, 2.5],        heart: [0.0003, 0.0008, 0.002, 0.02, 0.06] },
};

// ---------------- classes ----------------
// power (regra PODERES): o que cada colega da mesma classe por perto dá. farm soma, heart multiplica.
const LAB_CLASSES = {
  sete: {
    morto:       { label: 'MORTO-VIVO',  color: '#9ccf6a', power: { farm: 0.14, heart: 1 },    kinds: ['zombie', 'mummy', 'frank', 'vamp', 'nemesis'] },
    assombracao: { label: 'ASSOMBRAÇÃO', color: '#9fd8ff', power: { farm: 0.06, heart: 0.85 }, kinds: ['ghost', 'samara', 'reaper', 'krueger', 'pinhead', 'pyramid'] },
    cinema:      { label: 'CINEMA',      color: '#ff6a6a', power: { farm: 0.2,  heart: 1.12 }, kinds: ['ghostface', 'jason', 'myers', 'jigsaw', 'joker', 'vader'] },
    boneco:      { label: 'BRINQUEDO',   color: '#ffb52e', power: { farm: 0.1,  heart: 0.95 }, kinds: ['annabelle', 'chucky', 'foxy', 'fazbear', 'pennywise'] },
    fera:        { label: 'FERA',        color: '#d0905a', power: { farm: 0.18, heart: 1.08 }, kinds: ['sirenhead', 'wolf', 'xeno'] },
    desenho:     { label: 'DESENHO',     color: '#5ee07a', power: { farm: 0.05, heart: 0.8 },  kinds: ['mike', 'sulley', 'shrek', 'grinch', 'teemo'] },
    lenda:       { label: 'LENDA',       color: '#c58bff', power: { farm: 0.12, heart: 1 },    kinds: ['momo', 'saci', 'slender', 'herobrine', 'creeper', 'trump'] },
  },
  quatro: {
    morto:    { label: 'MORTO-VIVO', color: '#9ccf6a', power: { farm: 0.14, heart: 1 },    kinds: ['zombie', 'mummy', 'frank', 'vamp', 'nemesis'] },
    fantasma: { label: 'FANTASMA',   color: '#9fd8ff', power: { farm: 0.07, heart: 0.88 }, kinds: ['ghost', 'samara', 'reaper', 'krueger', 'pinhead', 'pyramid', 'momo', 'slender', 'herobrine', 'saci', 'creeper', 'trump'] },
    filme:    { label: 'FILME',      color: '#ff6a6a', power: { farm: 0.18, heart: 1.1 },  kinds: ['ghostface', 'jason', 'myers', 'jigsaw', 'joker', 'vader', 'annabelle', 'chucky', 'foxy', 'fazbear', 'pennywise'] },
    monstro:  { label: 'MONSTRO',    color: '#d0905a', power: { farm: 0.1,  heart: 0.95 }, kinds: ['sirenhead', 'wolf', 'xeno', 'mike', 'sulley', 'shrek', 'grinch', 'teemo'] },
  },
  medos: {
    sangue:       { label: 'SANGUE',       color: '#ff5a6a', power: { farm: 0.2,  heart: 1.12 }, kinds: ['jason', 'myers', 'ghostface', 'jigsaw', 'krueger', 'pinhead', 'nemesis', 'xeno', 'wolf'] },
    sobrenatural: { label: 'SOBRENATURAL', color: '#9fd8ff', power: { farm: 0.1,  heart: 0.9 },  kinds: ['ghost', 'samara', 'reaper', 'vamp', 'pyramid', 'zombie', 'mummy', 'frank'] },
    infancia:     { label: 'INFÂNCIA',     color: '#ffb52e', power: { farm: 0.08, heart: 0.85 }, kinds: ['annabelle', 'chucky', 'foxy', 'fazbear', 'pennywise', 'mike', 'sulley', 'teemo'] },
    bizarro:      { label: 'BIZARRO',      color: '#5ee07a', power: { farm: 0.14, heart: 1 },    kinds: ['shrek', 'grinch', 'saci', 'sirenhead', 'momo'] },
    pop:          { label: 'CULTURA POP',  color: '#c58bff', power: { farm: 0.12, heart: 1 },    kinds: ['slender', 'herobrine', 'creeper', 'joker', 'vader', 'trump'] },
  },
};
const LAB_RADIUS = 75;                                  // alcance da classe (px do mapa)
const LAB_NEIGHBOR = 0.12, LAB_RADIUS_EACH = 0.07, LAB_RADIUS_CAP = 0.35, LAB_POWER_CAP = 3;
const LAB_STREAK = [0, 0, 0.08, 0.2, 0.35, 0.55, 0.8];  // bônus por tamanho da sequência

// ---------------- infarto ----------------
const LAB_REFUND = 0.35;       // ESTORNO: parte do que o cliente pagou que volta mesmo com paramédico
const LAB_BILL = 0.3;          // HOSPITAL: fração da indenização que a conta custa
const LAB_FLAKY = 0.75;        // PLANTÃO FALHO: chance de salvar
const LAB_FLAKY_FEE = 0.5;     // PLANTÃO FALHO: fração da indenização quando morre

// ---------------- decoração ----------------
// farm soma (0.12 = +12%), heart multiplica (0.65 = -35% de infarto)
const LAB_ITEMS = {
  planta:   { name: 'Planta carnívora',          farm: 0.12,  heart: 1.1,  cost: 800,  looks: ['Dionéia', 'Jarro', 'Olho roxo'] },
  aranha:   { name: 'Aranha gigante',            farm: 0.2,   heart: 1.25, cost: 1500, looks: ['Viúva-negra', 'Caranguejeira', 'Pendurada'] },
  pelucia:  { name: 'Pelúcia de olho costurado', farm: 0.08,  heart: 1,    cost: 600,  looks: ['Ursinho', 'Coelha', 'Boneca de pano'] },
  incenso:  { name: 'Incenso de lavanda',        farm: 0,     heart: 0.65, cost: 1000, calm: true, looks: ['Incensário', 'Vela', 'Vaso'] },
  caixinha: { name: 'Caixinha de ninar',         farm: -0.05, heart: 0.45, cost: 1500, calm: true, looks: ['Bailarina', 'Gramofone', 'Móbile'] },
};
const LAB_LOT_RADIUS = 62;     // alcance de um enfeite no canteiro
const LAB_ACC_POWER = 1.5;     // enfeite preso na vaga vale mais, mas só para um boneco
const LAB_GLOBAL_POWER = 0.35; // enfeite na entrada vale para o parque todo, mas fraco
const LAB_GLOBAL_MAX = 3;

// ---------------- trilho especial ----------------
// speed: velocidade · heart: infarto · reward: valor do susto · trains: carrinhos extras
// brake: velocidade perto dos bonecos · avg: velocidade média (para a estimativa)
const LAB_TRACKS = {
  off:   { speed: 1,    heart: 1,    reward: 1,    trains: 0, rails: ['#d8d5e6', '#a9a5bf'], ties: ['#7a5434', '#4e3520'] },
  turbo: { speed: 1.4,  heart: 1.1,  reward: 1,    trains: 0, rails: ['#ffd23f', '#e08a20'], ties: ['#2a2230', '#ffd23f'], stripes: true },
  calm:  { speed: 0.8,  heart: 0.55, reward: 1,    trains: 0, rails: ['#f0b6e0', '#b884c8'], ties: ['#6a4a8a', '#46305e'], ballast: ['#3a2a52', '#2f2244', '#44325e'] },
  brake: { speed: 1.25, heart: 1.15, reward: 1.2,  trains: 0, rails: ['#ff7a5a', '#b83a2a'], ties: ['#3a2020', '#241414'], brake: 0.45, avg: 1.08 },
  volt:  { speed: 0.92, heart: 1,    reward: 1,    trains: 1, rails: ['#7fe8ff', '#3aa8d0'], ties: ['#2a3a55', '#1c2840'] },
};

// ---------------- manutenção ----------------
const LAB_MAINT_HOURS = [1, 4, 8, 24];                  // tempo até o estrago máximo
const LAB_ACCEL = [1, 60, 600];                         // acelerador só para testar
const LAB_OIL_MIN = 0.35;                               // velocidade com o trilho todo enferrujado
const LAB_BAT_LOW = 0.25;                               // abaixo disso o boneco rende menos
const LAB_COAL = { min: 0.55, max: 1.25, click: 0.2 };  // rendimento da caldeira vazia/cheia
const LAB_VOMIT_LOSS = 0.7;                             // quanto um carrinho imundo perde
const LAB_PACT = { strike: 0.3, streak: 0.03, cap: 0.3, earliest: 0.5 };

// ---------------- o que aparece na aba ----------------
const LAB_SYSTEMS = [
  { key: 'map', title: 'EXPANSÃO DO MAPA', options: [
    { key: 'off',     name: 'ATUAL',        desc: 'Mapa fixo com 8 vagas, como hoje.' },
    { key: 'big',     name: 'ILHA MAIOR',   desc: 'Poucas compras grandes. O chão cresce, o trilho ganha um laço com várias vagas e a câmera se afasta.' },
    { key: 'islands', name: 'OUTRAS ILHAS', desc: 'Compre ilhas separadas, ligadas por ponte. Cada uma tem visual próprio e um bônus para os bonecos dela.' },
    { key: 'bits',    name: 'TRECHOS',      desc: 'Muitas compras baratas. O trilho cresce aos poucos, 2 a 4 vagas por vez.' },
  ] },
  { key: 'rarity', title: 'GANHO POR RARIDADE', options: [
    { key: 'off',     name: 'ATUAL',          desc: 'Os números de hoje: lendário se paga muito antes do épico.' },
    { key: 'suave',   name: 'ESCADA SUAVE',   desc: 'Cada raridade rende cerca de 30% a mais que a anterior. Comum continua útil até o fim.' },
    { key: 'dobra',   name: 'DOBRA',          desc: 'Cada raridade rende o dobro da anterior. Fácil de entender.' },
    { key: 'comum',   name: 'COMUM FORTE',    desc: 'O começo é rápido e a diferença para o lendário é pequena.' },
    { key: 'estrela', name: 'LENDÁRIO ESTRELA', desc: 'Comum rende pouco, lendário rende muito e mata muito.' },
  ] },
  { key: 'classRule', title: 'BUFF DE CLASSE', options: [
    { key: 'off',       name: 'SEM CLASSE', desc: 'Nenhum bônus de classe.' },
    { key: 'vizinho',   name: 'VIZINHOS',   desc: `Cada vizinho da mesma classe, na vaga de antes ou de depois no trilho, dá +${LAB_NEIGHBOR * 100}% de farm.` },
    { key: 'raio',      name: 'ÁREA',       desc: `Cada colega da mesma classe por perto dá +${LAB_RADIUS_EACH * 100}% de farm, até +${LAB_RADIUS_CAP * 100}%.` },
    { key: 'sequencia', name: 'SEQUÊNCIA',  desc: 'Vagas seguidas da mesma classe formam combo: 2 = +8%, 3 = +20%, 4 = +35%, 5 = +55%, 6 ou mais = +80%.' },
    { key: 'poderes',   name: 'PODERES',    desc: 'Cada classe tem um efeito próprio, que vale por colega por perto (até 3).' },
  ] },
  { key: 'classes', title: 'DIVISÃO DAS CLASSES', options: [
    { key: 'sete',   name: '7 ORIGENS', desc: 'De onde o monstro vem. Mais variedade, combos mais difíceis.' },
    { key: 'quatro', name: '4 GRUPOS',  desc: 'Grupos grandes. Combos mais fáceis.' },
    { key: 'medos',  name: '5 MEDOS',   desc: 'Divide pelo tipo de medo que o monstro dá.' },
  ] },
  { key: 'heart', title: 'INFARTO E PARAMÉDICO', options: [
    { key: 'off',    name: 'ATUAL',          desc: 'Com paramédico o infarto não custa nada: o cliente segue a volta.' },
    { key: 'leave',  name: 'SAI DO PASSEIO', desc: 'Com paramédico ele sobrevive e você não paga indenização, mas ele desce do carrinho e não leva os outros sustos da volta.' },
    { key: 'refund', name: 'ESTORNO',        desc: `Sem paramédico o cliente pega de volta tudo o que pagou na volta e ainda tem indenização. Com paramédico você devolve ${LAB_REFUND * 100}%, sem indenização.` },
    { key: 'bill',   name: 'HOSPITAL',       desc: `Com paramédico o cliente segue a volta, mas você paga a conta: ${LAB_BILL * 100}% do valor de uma indenização.` },
    { key: 'flaky',  name: 'PLANTÃO FALHO',  desc: `Paramédico salva ${LAB_FLAKY * 100}% das vezes. No resto o cliente morre e a indenização sai pela metade.` },
  ] },
  { key: 'decor', title: 'ENFEITES', options: [
    { key: 'off',    name: 'SEM ENFEITES', desc: 'Nenhum enfeite no parque.' },
    { key: 'lots',   name: 'CANTEIROS',    desc: 'Canteiros fixos no mapa, marcados com +. O enfeite afeta os bonecos por perto.' },
    { key: 'acc',    name: 'NA VAGA',      desc: `Cada vaga aceita um enfeite, com efeito ${LAB_ACC_POWER}x maior, só naquele boneco. Clique no boneco para colocar.` },
    { key: 'global', name: 'NA ENTRADA',   desc: `Até ${LAB_GLOBAL_MAX} enfeites na entrada, valendo para o parque todo, com ${LAB_GLOBAL_POWER * 100}% da força.` },
  ] },
  { key: 'track', title: 'TRILHO ESPECIAL', options: [
    { key: 'off',   name: 'NORMAL',     desc: 'O trilho de hoje.' },
    { key: 'turbo', name: 'TURBO',      desc: 'Carrinhos 40% mais rápidos, mais clientes por hora. +10% de infarto.' },
    { key: 'calm',  name: 'ACOLCHOADO', desc: 'Carrinhos 20% mais lentos, mas 45% menos infarto.' },
    { key: 'brake', name: 'FREIO DO SUSTO', desc: 'Acelera nas retas e quase para em cada boneco. Susto rende +20%, +15% de infarto.' },
    { key: 'volt',  name: 'ELÉTRICO',   desc: '+1 carrinho no trilho, cada um 8% mais lento.' },
  ] },
  { key: 'maint', title: 'MANUTENÇÃO (VOLTAR AO JOGO)', options: [
    { key: 'off',     name: 'NADA',    desc: 'O parque rende sozinho para sempre.' },
    { key: 'oil',     name: 'ÓLEO',    desc: 'O trilho enferruja e os carrinhos vão ficando lentos. Clique na lata de óleo perto da casa.' },
    { key: 'battery', name: 'BATERIA', desc: 'Cada boneco gasta bateria e desliga no zero. Clique nos que estão piscando.' },
    { key: 'coal',    name: 'CALDEIRA', desc: 'Com carvão o parque rende mais que o normal; vazia, bem menos. Cada clique põe 20%.' },
    { key: 'vomit',   name: 'VÔMITO',  desc: 'Clientes sujam os carrinhos e pagam menos. Clique no carrinho andando para limpar.' },
    { key: 'pact',    name: 'PACTO',   desc: 'Assine o pacto dentro do prazo. Cada renovação seguida dá +3% (até +30%). Se atrasar, os bonecos fazem greve.' },
  ] },
];
const LAB_SYS = {};
LAB_SYSTEMS.forEach(s => { LAB_SYS[s.key] = s; });

// ---------------- sprites novos (16 de largura) ----------------
Object.assign(SPRITES, {
  // planta carnívora
  lab_planta1: [
    '................',
    '....kkkkkkkk....',
    '...krrrrrrrrk...',
    '..krrwrrrrwrrk..',
    '..krrrrrrrrrrk..',
    '..kwkwkwkwkwkk..',
    '...kxxxxxxxxk...',
    '..kwkwkwkwkwkk..',
    '..kRRRRRRRRRRk..',
    '...kkkkkkkkkk...',
    '.......kNk......',
    '..kk...kNk...kk.',
    '.knnk..kNk..knnk',
    '.kNnnkkkNkkknnNk',
    '..kNNnnNNNnnNNk.',
    '...kkkkkkkkkkk..',
  ],
  lab_planta2: [
    '................',
    '......kkkk......',
    '.....kUUUUk.....',
    '....kUUyUUUk....',
    '.....kkkkkk.....',
    '....knnnnnnk....',
    '...kxxxxxxxxk...',
    '...knxxUxxxnk...',
    '...knnnUnnnnk...',
    '...knNnUnnNnk...',
    '...knNnnnnNnk...',
    '....knNnnNnk....',
    '.....knnnnk.....',
    '..kk..kNNk..kk..',
    '.kNnkkkNNkkknNk.',
    '..kkkkkkkkkkkk..',
  ],
  lab_planta3: [
    '................',
    '...kk......kk...',
    '..kUQk....kQUk..',
    '..kUUQkkkkQUUk..',
    '...kQUUUUUUQk...',
    '....kUwwwwUk....',
    '...kQwwxxwwQk...',
    '..kUUwxrrxwUUk..',
    '..kUUwxrrxwUUk..',
    '...kQwwxxwwQk...',
    '....kUwwwwUk....',
    '...kQUUkkUUQk...',
    '..kUQk.kNk.kQUk.',
    '...kk..kNk..kk..',
    '.....kkkNkkk....',
    '....knnnnnnnk...',
  ],
  // aranha
  lab_aranha1: [
    '................',
    '..k..k....k..k..',
    '..k..k....k..k..',
    '...k.k....k.k...',
    '....kk.kk.kk....',
    '..kk.kkkkkk.kk..',
    '.k..kkVVVVkk..k.',
    '.k.kkVrVVrVkk.k.',
    '..k.kVVVVVVk.k..',
    '...kkkVrrVkkk...',
    '..k.kVVrrVVk.k..',
    '.k..kVrrrrVk..k.',
    '.k...kVVVVk...k.',
    '......kkkk......',
    '................',
    '................',
  ],
  lab_aranha2: [
    '................',
    '................',
    '.....kkkkkk.....',
    '....kOooooOk....',
    '...kOoOooOoOk...',
    '...kOOOOOOOOk...',
    '..kkOkkOOkkOkk..',
    '.k.kkrkkkkrkk.k.',
    'k.k.kkkkkkkk.k.k',
    'k.k.k.kkkk.k.k.k',
    'k..k.k....k.k..k',
    'k..k.k....k.k..k',
    '.k.k..k..k..k.k.',
    '...k..k..k..k...',
    '................',
    '................',
  ],
  lab_aranha3: [
    '.......ww.......',
    '.......gg.......',
    '.......gg.......',
    '.......gg.......',
    '.....kkggkk.....',
    '..k.kvvvvvvk.k..',
    '.k.kvvevvevvk.k.',
    '.k.kvvvvvvvvk.k.',
    '..kkkvvxxvvkkk..',
    '.k..kkvvvvkk..k.',
    'k..k.kkkkkk.k..k',
    'k.k..k....k..k.k',
    '..k..k....k..k..',
    '................',
    '................',
    '................',
  ],
  // pelúcia
  lab_pelucia1: [
    '................',
    '..kkk.....kkk...',
    '.kbSbkkkkkbSbk..',
    '.kbbbbbbbbbbbk..',
    '..kbkbkbbbxxbk..',
    '..kbbkbbbbxxbk..',
    '..kbkbkbbbbbbk..',
    '..kbbbbSSSbbbk..',
    '...kbbSkSkSbk...',
    '....kbbkkbbk....',
    '...kbbbbbbbbk...',
    '..kbbkSSSSkbbk..',
    '..kbbkSSSSkbbk..',
    '...kkkSSSSkkk...',
    '...kbbkkkkbbk...',
    '....kkk..kkk....',
  ],
  lab_pelucia2: [
    '....kk....kk....',
    '...kKKk..kKKk...',
    '...kKpk..kKpk...',
    '...kKpk...kKk...',
    '...kKKkkkkkKk...',
    '..kKKKKKKKKKKk..',
    '..kKkrkKKKxxKk..',
    '..kKKkKKKKxxKk..',
    '..kKkrkKKKKKKk..',
    '..kKKKKkkKKKKk..',
    '...kKKkwwkKKk...',
    '....kkKKKKkk....',
    '...kKKppppKKk...',
    '...kKKppppKKk...',
    '...kKKkkkkKKk...',
    '....kk....kk....',
  ],
  lab_pelucia3: [
    '................',
    '...kBkBkBkBk....',
    '...kBBBBBBBBk...',
    '...kZZZZZZZZk...',
    '..kZkZkZZZggZk..',
    '..kZZkZZZZggZk..',
    '..kZkZkZZZZZZk..',
    '..kZZZZZZZZZZk..',
    '..kZkZkZkZkZZk..',
    '..kZZkZkZkZZZk..',
    '...kZZZZZZZZk...',
    '....kkkkkkkk....',
    '...kcCcCcCcCk...',
    '..kZkcCcCcCkZk..',
    '...k.kCcCck.k...',
    '.....kk..kk.....',
  ],
  // incenso
  lab_incenso1: [
    '.......U........',
    '........U.......',
    '.......U........',
    '......U.........',
    '.......U........',
    '.......k........',
    '.....kkykk......',
    '....kyyyyyk.....',
    '...kOOOOOOOk....',
    '...kyOyOyOyk....',
    '...kOOOOOOOk....',
    '....kOOOOOk.....',
    '.....kOOOk......',
    '.....kOOOk......',
    '....kyyyyyk.....',
    '....kkkkkkk.....',
  ],
  lab_incenso2: [
    '.......Y........',
    '......yYy.......',
    '......yoy.......',
    '.......k........',
    '.....kUUUk......',
    '.....kUQUk......',
    '.....kUQUk......',
    '.....kUUUk......',
    '.....kUQUk......',
    '.....kUUUk......',
    '.....kUQUk......',
    '.....kUUUk......',
    '...kkkkkkkkk....',
    '..kgGGGGGGGgk...',
    '...kkgggggkk....',
    '.....kkkkk......',
  ],
  lab_incenso3: [
    '...U...U...U....',
    '..UQU.UQU.UQU...',
    '...U...U...U....',
    '...H..UQU..H....',
    '...H...U...H....',
    '....H..H..H.....',
    '....H..H..H.....',
    '.....H.H.H......',
    '...kkkkkkkkk....',
    '...kffffffFk....',
    '....kfdddfk.....',
    '....kfdddfk.....',
    '....kfdddfk.....',
    '.....kfffk......',
    '.....kkkkk......',
    '................',
  ],
  // caixinha de ninar
  lab_caixinha1: [
    '.......k........',
    '......kKk.......',
    '.....kpKpk......',
    '......kKk.......',
    '.....kKKKk......',
    '....kKKKKKk.....',
    '......kkk.......',
    '..kkkkkkkkkkk...',
    '..kbbbbbbbbbk...',
    '..kBBBBBBBBBk...',
    '..kbyybbbyybk.kk',
    '..kbyybbbyybkkyk',
    '..kbbbbbbbbbk.kk',
    '..kBBBBBBBBBk...',
    '..kkkkkkkkkkk...',
    '................',
  ],
  lab_caixinha2: [
    '..........kkkkk.',
    '........kkOyyyk.',
    '.......kOyyyyk..',
    '......kOyyyyk...',
    '.....kOyyyk.....',
    '....kOyyk.......',
    '...kOyk.........',
    '...kOk..........',
    '....kk..........',
    '....kk..........',
    '..kkkkkkkkkkkk..',
    '..kbbbbbbbbbbk..',
    '..kbBkkkkkkBbk..',
    '..kbBkxxxxkBbk..',
    '..kBBBBBBBBBBk..',
    '..kkkkkkkkkkkk..',
  ],
  lab_caixinha3: [
    '......kkkkk.....',
    '.......kgk......',
    '.kkkkkkkgkkkkkk.',
    '.k.....kgk....k.',
    '.k......g.....k.',
    '.g......g.....g.',
    '.g......g.....g.',
    'kyk.....g....kyk',
    'yYy.....g....yYy',
    'kyk....kyk...kyk',
    '.......yYy......',
    '.......kyk......',
    '................',
    '................',
    '................',
    '................',
  ],
  // manutenção
  lab_oil: [
    '................',
    '...........kk...',
    '..........kaak..',
    '.........kaak...',
    '......kkkaak....',
    '.....kGGGak.....',
    '....kkkkkkk.....',
    '...kcCcCcCcCk...',
    '...kccyyyycCk...',
    '...kcykkkkyCk...',
    '...kccyyyycCk...',
    '...kcCcCcCcCk...',
    '...kcCcCcCcCk...',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
  lab_coal: [
    '....kkkkkkkk....',
    '...kaaaaaaaak...',
    '..kaAAAAAAAAak..',
    '..kAkkkkkkkkAk..',
    '..kAkxoxxoxkAk..',
    '..kAkoyoyyokAk..',
    '..kAkyYyYyykAk..',
    '..kAkkkkkkkkAk..',
    '..kaAAAAAAAAak..',
    '..kAAaAAAAaAAk..',
    '..kAAAAAAAAAAk..',
    '..kkkkkkkkkkkk..',
    '..kk.......kk...',
    '................',
    '................',
    '................',
  ],
  lab_pact: [
    '...kkkkkkkkk....',
    '..kZSSSSSSSZk...',
    '...kZZZZZZZk....',
    '...kZkkkkkZk....',
    '...kZZZZZZZk....',
    '...kZkkkkZZk....',
    '...kZZZZZZZk....',
    '...kZkkkkkZk....',
    '...kZZZZZZZk....',
    '...kZkkZrrZk....',
    '...kZZZrRRrk....',
    '...kZZZZrrZk....',
    '...kZZZZZZZk....',
    '..kZSSSSSSSZk...',
    '...kkkkkkkkk....',
    '................',
  ],
});

// ---------------- estado e regras ----------------
const LAB_KEY = 'casaAssombrada.lab';
const LAB_ORIG = RARITIES.map(r => ({ roi: r.roi, roiNoMedic: r.roiNoMedic, heart: r.heart }));

const Lab = {
  picks: { looks: {}, maintHours: 4, accel: 1 },
  _cache: null,
  _pristine: false,          // true = conta sem o desgaste da manutenção (ganho offline)
  _warned: false,
  _tick: 0,

  // ---------- escolhas ----------
  loadPicks() {
    LAB_SYSTEMS.forEach(s => { this.picks[s.key] = s.options[0].key; });
    try {
      const d = JSON.parse(localStorage.getItem(LAB_KEY));
      if (d) {
        LAB_SYSTEMS.forEach(s => { if (s.options.some(o => o.key === d[s.key])) this.picks[s.key] = d[s.key]; });
        this.picks.looks = d.looks || {};
        if (LAB_MAINT_HOURS.includes(d.maintHours)) this.picks.maintHours = d.maintHours;
        if (LAB_ACCEL.includes(d.accel)) this.picks.accel = d.accel;
      }
    } catch (e) { /* sem storage: fica com o padrão */ }
    this.applyRarity();
  },
  savePicks() { try { localStorage.setItem(LAB_KEY, JSON.stringify(this.picks)); } catch (e) { } },
  setPick(sys, opt) {
    if (this.picks[sys] === opt) return;
    this.picks[sys] = opt;
    this.savePicks();
    if (sys === 'rarity') this.applyRarity();
    if (sys === 'maint') this.fixAll(true);
    this.dirty();
    if (sys === 'map' || sys === 'track') World.rebuild();
    Game.emit('change');
    Game.save();
  },
  look(item) { return this.picks.looks[item] || 1; },
  lookSprite(item, n) { return 'lab_' + item + (n || this.look(item)); },
  setLook(item, n) { this.picks.looks[item] = n; this.savePicks(); Game.emit('change'); },

  freshState() {
    return { map: { big: 0, islands: 0, bits: 0 }, decor: { lots: {}, acc: {}, global: [] }, maint: { clock: 0, oil: 0, coalLvl: 1, coalAt: 0, clean: {}, pactAt: 0, streak: 0 } };
  },
  st() { return Game.s.lab; },
  dirty() { this._cache = null; },

  applyRarity() {
    const p = LAB_RARITY[this.picks.rarity];
    RARITIES.forEach((r, i) => {
      r.roi = p ? p.roi[i] : LAB_ORIG[i].roi;
      r.roiNoMedic = p ? p.noMedic[i] : LAB_ORIG[i].roiNoMedic;
      r.heart = p ? p.heart[i] : LAB_ORIG[i].heart;
      r.farm = CFG.mintCost / r.roi;
      r.lossDay = r.farm - CFG.mintCost / r.roiNoMedic;
    });
  },

  // ---------- mapa ----------
  mapLevel() { const m = this.picks.map; return m === 'off' ? 0 : this.st().map[m] || 0; },
  mapPlan() {
    const base = { view: [W, H], lobes: [], isles: null };
    const lvl = this.mapLevel();
    if (!lvl) return base;
    const levels = LAB_MAP[this.picks.map].levels.slice(0, lvl);
    return { view: levels[lvl - 1].view, lobes: levels.map(l => l.lobe), isles: this.picks.map === 'islands' ? levels.map(l => l.isle) : null };
  },
  nextLevel() { const m = this.picks.map; return m === 'off' ? null : LAB_MAP[m].levels[this.mapLevel()] || null; },
  buyLevel() {
    const next = this.nextLevel();
    if (!next || !Game.spend(next.cost)) return false;
    this.st().map[this.picks.map]++;
    this.dirty();
    World.rebuild();
    Game.emit('change');
    Game.save();
    return true;
  },
  dropLevel() {
    if (!this.mapLevel()) return;
    this.st().map[this.picks.map]--;
    this.dirty();
    World.rebuild();
    Game.emit('change');
    Game.save();
  },
  // chamado pelo mundo quando o trilho muda: quem ficou numa vaga que não existe volta ao inventário
  slotsChanged() {
    Game.s.monsters.forEach(m => { if (m.slot >= CFG.slots) m.slot = -1; });
    this.dirty();
  },

  // ---------- classes ----------
  scheme() { return LAB_CLASSES[this.picks.classes]; },
  classKey(kind) {
    const sc = this.scheme();
    return Object.keys(sc).find(k => sc[k].kinds.includes(kind));
  },
  classOf(m) { return this.scheme()[this.classKey(monOf(m).key)]; },

  // ---------- bônus por vaga (classe, enfeites, ilha), recalculado só quando algo muda ----------
  buffs() { return this._cache || (this._cache = this.compute()); },
  compute() {
    const mons = {}, st = this.st(), rule = this.picks.classRule, links = [];
    Game.s.monsters.forEach(m => { if (m.slot >= 0) mons[m.slot] = m; });
    const order = Game.slotOrder, entries = order.filter(i => mons[i]).map(i => ({ i, m: mons[i], cls: this.classKey(monOf(mons[i]).key), classAdd: 0, decorAdd: 0, perkAdd: 0, heart: 1 }));
    const bySlot = {};
    entries.forEach(e => {
      bySlot[e.i] = e;
      if (e.m.chargeAt === undefined) e.m.chargeAt = st.maint.clock;
    });
    const slots = typeof World !== 'undefined' ? World.SLOTS : [];
    const dist = (a, b) => Math.hypot(slots[a].x - slots[b].x, (slots[a].y - slots[b].y) * 1.3);
    const color = c => this.scheme()[c].color;

    if (rule === 'vizinho') {
      for (let k = 0; k + 1 < order.length; k++) {
        const a = bySlot[order[k]], b = bySlot[order[k + 1]];
        if (a && b && a.cls === b.cls) { a.classAdd += LAB_NEIGHBOR; b.classAdd += LAB_NEIGHBOR; links.push([a.i, b.i, color(a.cls)]); }
      }
    } else if (rule === 'sequencia') {
      let run = [];
      const close = () => {
        if (run.length >= 2) {
          const add = LAB_STREAK[Math.min(run.length, LAB_STREAK.length - 1)];
          run.forEach((e, n) => { e.classAdd += add; if (n) links.push([run[n - 1].i, e.i, color(e.cls)]); });
        }
        run = [];
      };
      order.forEach(i => {
        const e = bySlot[i];
        if (!e) { close(); return; }
        if (run.length && run[0].cls !== e.cls) close();
        run.push(e);
      });
      close();
    } else if ((rule === 'raio' || rule === 'poderes') && slots.length) {
      entries.forEach(e => { e.near = 0; });
      for (let a = 0; a < entries.length; a++) for (let b = a + 1; b < entries.length; b++) {
        const A = entries[a], B = entries[b];
        if (A.cls !== B.cls || dist(A.i, B.i) > LAB_RADIUS) continue;
        A.near++; B.near++;
        links.push([A.i, B.i, color(A.cls)]);
      }
      entries.forEach(e => {
        if (rule === 'raio') e.classAdd = Math.min(LAB_RADIUS_CAP, e.near * LAB_RADIUS_EACH);
        else {
          const p = this.scheme()[e.cls].power, n = Math.min(LAB_POWER_CAP, e.near);
          e.classAdd = p.farm * n;
          e.heart *= Math.pow(p.heart, n);
        }
      });
    }

    // enfeites
    const mode = this.picks.decor, weak = (h, k) => Math.max(0.2, 1 - (1 - h) * k);
    if (mode === 'lots' && slots.length) {
      Object.entries(st.decor.lots).forEach(([idx, key]) => {
        const lot = World.LOTS[+idx], it = LAB_ITEMS[key];
        if (!lot || !it) return;
        entries.forEach(e => {
          const sl = slots[e.i];
          if (Math.hypot(sl.x - lot.x, (sl.y - lot.y) * 1.3) <= LAB_LOT_RADIUS) { e.decorAdd += it.farm; e.heart *= it.heart; }
        });
      });
    } else if (mode === 'acc') {
      entries.forEach(e => {
        const it = LAB_ITEMS[st.decor.acc[e.i]];
        if (it) { e.decorAdd += it.farm * LAB_ACC_POWER; e.heart *= weak(it.heart, LAB_ACC_POWER); }
      });
    } else if (mode === 'global') {
      st.decor.global.forEach(key => {
        const it = LAB_ITEMS[key];
        entries.forEach(e => { e.decorAdd += it.farm * LAB_GLOBAL_POWER; e.heart *= weak(it.heart, LAB_GLOBAL_POWER); });
      });
    }

    // bônus da ilha
    if (this.picks.map === 'islands') {
      entries.forEach(e => {
        const sl = slots[e.i], lvl = sl && sl.isle >= 0 ? LAB_MAP.islands.levels[sl.isle] : null;
        if (lvl) { e.perkAdd = lvl.perk.farm; e.heart *= lvl.perk.heart; }
      });
    }
    return { bySlot, entries, links, placed: entries.map(e => e.m) };
  },
  buffOf(m) { return m.slot >= 0 ? this.buffs().bySlot[m.slot] : null; },
  farmMult(m) {
    const b = this.buffOf(m);
    return b ? Math.max(0.1, 1 + b.classAdd + b.decorAdd + b.perkAdd) : 1;
  },
  heartOf(m) {
    const b = this.buffOf(m);
    return RAR[m.rarity].heart * (b ? b.heart : 1) * this.trackStats().heart;
  },

  // ---------- trilho ----------
  trackStats() { return LAB_TRACKS[this.picks.track]; },
  speedMult() { return this.trackStats().speed * this.oilSpeed(); },
  avgSpeedMult() { const t = this.trackStats(); return (t.avg || t.speed) * this.oilSpeed(); },

  // ---------- manutenção ----------
  period() { return this.picks.maintHours * 3600; },
  clock() { return this.st().maint.clock; },
  advance(secs) { this.st().maint.clock += secs * this.picks.accel; },
  update(dt) {
    this.advance(dt);
    this._tick += dt;
    if (this._tick < 1) return;
    this._tick = 0;
    this.dirty();
    const w = this.wear();
    if (w >= 0.7 && !this._warned) {
      this._warned = true;
      Game.emit('toast', { text: this.warnText(), kind: 'bad' });
    } else if (w < 0.5) this._warned = false;
  },
  warnText() {
    return { oil: 'O trilho está enferrujando! Passe óleo: clique na lata perto da casa.', battery: 'Bonecos ficando sem bateria! Clique nos que estão piscando.', coal: 'A caldeira está apagando! Clique nela para pôr carvão.', vomit: 'Carrinhos imundos! Clique neles para limpar.', pact: 'O pacto está vencendo! Clique no pergaminho.' }[this.picks.maint] || '';
  },
  oilWearAt(T) { return Math.max(0, Math.min(1, (T - this.st().maint.oil) / this.period())); },
  oilSpeed() {
    if (this.picks.maint !== 'oil' || this._pristine) return 1;
    return this.oilSpeedAt(this.clock());
  },
  oilSpeedAt(T) { return 1 - (1 - LAB_OIL_MIN) * Math.pow(this.oilWearAt(T), 1.3); },
  batteryAt(m, T) { return Math.max(0, 1 - (T - (m.chargeAt === undefined ? T : m.chargeAt)) / this.period()); },
  battery(m) { return this.batteryAt(m, this.clock()); },
  batFactor(b) { return b <= 0 ? 0 : b >= LAB_BAT_LOW ? 1 : 0.4 + 0.6 * (b / LAB_BAT_LOW); },
  coalAt(T) { const M = this.st().maint; return Math.max(0, M.coalLvl - (T - M.coalAt) / this.period()); },
  coalFactor(c) { return LAB_COAL.min + (LAB_COAL.max - LAB_COAL.min) * c; },
  dirtAt(color, T) {
    const M = this.st().maint, at = M.clean[color] === undefined ? M.oil : M.clean[color];
    return Math.max(0, Math.min(1, (T - at) / this.period()));
  },
  dirt(color) { return this.picks.maint === 'vomit' ? this.dirtAt(color, this.clock()) : 0; },
  cartFactor(color) { return 1 - LAB_VOMIT_LOSS * this.dirt(color); },
  pactFactorAt(T) {
    const M = this.st().maint;
    return T - M.pactAt <= this.period() ? 1 + Math.min(LAB_PACT.cap, M.streak * LAB_PACT.streak) : LAB_PACT.strike;
  },
  pactReady() { return this.clock() - this.st().maint.pactAt >= this.period() * LAB_PACT.earliest; },
  // quanto do valor do susto sobra (caldeira e pacto valem para todos; bateria, por boneco)
  rewardFactor(m) {
    if (this._pristine) return 1;
    const o = this.picks.maint;
    if (o === 'battery') return this.batFactor(this.battery(m));
    if (o === 'coal') return this.coalFactor(this.coalAt(this.clock()));
    if (o === 'pact') return this.pactFactorAt(this.clock());
    return 1;
  },
  canScare(m) { return this.picks.maint !== 'battery' || this.battery(m) > 0; },
  vomitFactor(T) {
    if (this.picks.maint !== 'vomit' || this._pristine) return 1;
    return this.vomitFactorAt(T === undefined ? this.clock() : T);
  },
  vomitFactorAt(T) {
    const colors = [0, 1, 2, 3].slice(0, Math.max(1, Math.min(4, Game.trainCount())));
    return colors.reduce((a, c) => a + 1 - LAB_VOMIT_LOSS * this.dirtAt(c, T), 0) / colors.length;
  },
  // desgaste de 0 a 1, para a barra e o aviso
  wear() {
    const o = this.picks.maint, T = this.clock(), M = this.st().maint;
    if (o === 'oil') return this.oilWearAt(T);
    if (o === 'coal') return 1 - this.coalAt(T);
    if (o === 'pact') return Math.min(1, (T - M.pactAt) / this.period());
    if (o === 'vomit') return (1 - this.vomitFactorAt(T)) / LAB_VOMIT_LOSS;
    if (o === 'battery') {
      const p = this.buffs().placed;
      return p.length ? 1 - p.reduce((a, m) => a + this.battery(m), 0) / p.length : 0;
    }
    return 0;
  },
  // multiplicador da manutenção num momento (back = segundos no passado)
  factorAt(back) {
    const o = this.picks.maint, T = this.clock() - back * this.picks.accel;
    if (o === 'oil') {
      const v = CFG.speed * (this.trackStats().avg || this.trackStats().speed);
      return (Game.trackLen / v + CFG.stationSecs) / (Game.trackLen / (v * this.oilSpeedAt(T)) + CFG.stationSecs);
    }
    if (o === 'coal') return this.coalFactor(this.coalAt(T));
    if (o === 'pact') return this.pactFactorAt(T);
    if (o === 'vomit') return this.vomitFactorAt(T);
    if (o === 'battery') {
      const p = this.buffs().placed;
      return p.length ? p.reduce((a, m) => a + this.batFactor(this.batteryAt(m, T)), 0) / p.length : 1;
    }
    return 1;
  },
  // média do multiplicador em todo o tempo fora do jogo: é o que faz valer a pena voltar
  maintAverage(secs) {
    const N = 8;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += this.factorAt(secs * (i + 0.5) / N);
    return sum / N;
  },
  oil() { const M = this.st().maint; M.oil = M.clock; this.afterFix(); },
  charge(m) { m.chargeAt = this.clock(); this.afterFix(); },
  stoke() { const M = this.st().maint; M.coalLvl = Math.min(1, this.coalAt(M.clock) + LAB_COAL.click); M.coalAt = M.clock; this.afterFix(); },
  clean(color) { const M = this.st().maint; M.clean[color] = M.clock; this.afterFix(); },
  signPact() {
    const M = this.st().maint;
    if (!this.pactReady()) return false;
    M.streak = M.clock - M.pactAt <= this.period() ? M.streak + 1 : 0;
    M.pactAt = M.clock;
    this.afterFix();
    return true;
  },
  afterFix() { this.dirty(); Game.emit('change'); Game.save(); },
  // silent: troca de opção, sem efeito de "consertou"
  fixAll(silent) {
    const M = this.st().maint;
    M.oil = M.coalAt = M.pactAt = M.clock; M.coalLvl = 1; M.clean = {};
    Game.s.monsters.forEach(m => { if (m.slot >= 0) m.chargeAt = M.clock; });
    this._warned = false;
    if (!silent) this.afterFix();
  },
  // botão de teste: leva o desgaste direto para uma fração do estrago total
  ageNow(k) {
    const M = this.st().maint, back = this.period() * k;
    M.oil = M.pactAt = M.clock - back;
    M.coalLvl = 1; M.coalAt = M.clock - back;
    M.clean = {};
    [0, 1, 2, 3].forEach(c => { M.clean[c] = M.clock - back; });
    Game.s.monsters.forEach(m => { if (m.slot >= 0) m.chargeAt = M.clock - back; });
    this.afterFix();
  },

  // ---------- contas de farm ----------
  // uma volta de um cliente, passando pelos bonecos na ordem do trilho
  rate(medic) {
    const rps = Game.ridersPerSec(), pol = this.picks.heart;
    let alive = 1, farm = 0, fees = 0, gross = 0, paid = 0;
    for (const m of this.buffs().placed) {
      if (!this.canScare(m) && !this._pristine) continue;
      const rew = Game.rewardOf(m), h = this.heartOf(m), fee = Game.indemnityOf(RAR[m.rarity]);
      gross += rew;
      farm += alive * rew;
      paid += rew;
      if (!medic) {
        fees += alive * h * fee;
        if (pol === 'refund') farm -= alive * h * paid;
        alive *= 1 - h;
      } else if (pol === 'leave') alive *= 1 - h;
      else if (pol === 'refund') farm -= alive * h * paid * LAB_REFUND;
      else if (pol === 'bill') fees += alive * h * fee * LAB_BILL;
      else if (pol === 'flaky') { fees += alive * h * (1 - LAB_FLAKY) * fee * LAB_FLAKY_FEE; alive *= 1 - h * (1 - LAB_FLAKY); }
    }
    const v = this.vomitFactor();
    return { gross: gross * rps * v, farm: farm * rps * v, fees: fees * rps, net: (farm * v - fees) * rps, deaths: (1 - alive) * rps };
  },
  // devolve dinheiro ao cliente (sem dívida)
  takeBack(amount) {
    const s = Game.s, paid = r4(Math.min(s.medo, amount));
    s.medo = r4(s.medo - paid);
    s.totalEarned = r4(Math.max(0, s.totalEarned - paid));
    return paid;
  },
};

// ---------------- ligação com o jogo ----------------
// As regras novas embrulham o Game em vez de mudar state.js.
(() => {
  const G = Game, o = { fresh: G.fresh, load: G.load, farmDayOf: G.farmDayOf, rewardOf: G.rewardOf, trainCount: G.trainCount };

  G.fresh = function () { const s = o.fresh.call(this); s.lab = Lab.freshState(); return s; };
  // o load original tira quem está em vaga maior que 8; o mapa ainda não sabe quantas vagas tem
  G.load = function () {
    const high = {};
    try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d) d.monsters.forEach(m => { if (m.slot >= CFG.slots) high[m.id] = m.slot; }); } catch (e) { }
    const ok = o.load.call(this);
    this.s.monsters.forEach(m => { if (high[m.id] !== undefined) m.slot = high[m.id]; });
    Lab.dirty();
    return ok;
  };
  G.reset = (fn => function () { fn.call(this); Lab.dirty(); })(G.reset);
  G.placed = () => Lab.buffs().placed;
  G.farmDayOf = function (m) { return o.farmDayOf.call(this, m) * Lab.farmMult(m); };
  G.rewardOf = function (m) { return o.rewardOf.call(this, m) * Lab.trackStats().reward * Lab.rewardFactor(m); };
  G.trainCount = function () { return o.trainCount.call(this) + Lab.trackStats().trains; };
  G.ridersPerSec = function (trains) {
    const loop = this.trackLen / (CFG.speed * Lab.avgSpeedMult()) + CFG.stationSecs;
    return (trains || this.trainCount()) / loop * CFG.seatsPerTrain * 0.9;
  };
  // o valor do susto continua calibrado pelo trilho normal: trilho mais rápido rende mais
  G.baseRidersPerSec = function () { return CFG.trains / (this.trackLen / CFG.speed + CFG.stationSecs) * CFG.seatsPerTrain * 0.9; };
  G.grossRate = () => Lab.rate(true).gross;
  G.survival = () => Lab.buffs().placed.reduce((a, m) => a * (1 - Lab.heartOf(m)), 1);
  G.risk = () => Lab.rate(false);
  G.estimatedRate = function () { return Lab.rate(this.medicActive()).net; };

  G.catchUp = function (secs) {
    const s = this.s, now = Date.now();
    Lab.advance(secs);
    Lab.dirty();
    secs = Math.min(secs, 7200);
    if (secs < 30) return { gained: 0, lost: 0, deaths: 0 };
    const covered = s.medicForever ? secs : Math.max(0, Math.min(now, s.medicUntil) - (now - secs * 1000)) / 1000;
    const exposed = secs - covered, k = Lab.maintAverage(secs);
    Lab._pristine = true;
    const withMedic = Lab.rate(true), without = Lab.rate(false);
    Lab._pristine = false;
    const gained = r4((withMedic.net * covered + without.net * exposed) * 0.5 * k);
    const lost = r4((without.gross - without.net) * exposed * 0.5);
    const deaths = Math.round(without.deaths * exposed * 0.5);
    this.earn(gained);
    s.deaths += deaths;
    s.lost = r4(s.lost + without.fees * exposed * 0.5);
    return { gained, lost, deaths };
  };

  G.heartAttack = function (m, earned) {
    const s = this.s, pol = Lab.picks.heart, fee = this.indemnityOf(RAR[m.rarity]);
    earned = earned || 0;
    if (!this.medicActive()) {
      const paid = this.payIndemnity(fee), refund = pol === 'refund' ? Lab.takeBack(earned) : 0;
      this.emit('kill', { m, fee: paid });
      return { saved: false, fee: paid, refund };
    }
    if (pol === 'flaky' && Math.random() >= LAB_FLAKY) {
      const paid = this.payIndemnity(fee * LAB_FLAKY_FEE);
      this.emit('kill', { m, fee: paid });
      return { saved: false, fee: paid };
    }
    s.saved++;
    if (pol === 'leave') return { saved: true, leave: true };
    if (pol === 'refund') return { saved: true, refund: Lab.takeBack(earned * LAB_REFUND) };
    if (pol === 'bill') {
      const bill = r4(Math.min(s.medo, fee * LAB_BILL));
      s.medo = r4(s.medo - bill);
      s.lost = r4(s.lost + bill);
      return { saved: true, bill };
    }
    return { saved: true };
  };

  Game.on('change', () => Lab.dirty());
})();
Lab.loadPicks();

// ---------------- aba TESTE ----------------
const LabUI = {
  h: null,
  bind(helpers) { this.h = helpers; },

  card(n, sys, body) {
    const S = LAB_SYS[sys], cur = Lab.picks[sys], opt = S.options.find(o => o.key === cur);
    return `<section class="lab-card px">
      <h4><span class="lab-n">${n}</span>${S.title}</h4>
      <div class="lab-opts">${S.options.map((o, i) => `<button class="lab-opt${o.key === cur ? ' on' : ''}" data-act="labpick" data-sys="${sys}" data-opt="${o.key}"><b>${i + 1}</b> ${o.name}</button>`).join('')}</div>
      <p class="lab-desc">${opt.desc}</p>
      ${body || ''}
    </section>`;
  },

  mapBody() {
    const { money } = this.h, m = Lab.picks.map;
    if (m === 'off') return '';
    const cfg = LAB_MAP[m], lvl = Lab.mapLevel(), next = Lab.nextLevel(), total = cfg.levels.length;
    const owned = cfg.levels.slice(0, lvl), perks = m === 'islands' ? owned.map(l => `<div class="muted small">${l.name}: ${l.perkText}</div>`).join('') : '';
    const pct = Math.round(World.viewW / W * 100);
    return `<div class="lab-status"><span>${cfg.noun} <b>${lvl}/${total}</b></span><span>Vagas <b>${CFG.slots}</b></span><span>Mapa <b>${pct}%</b></span></div>
      ${perks}
      <div class="row-btns left">
        ${next ? `<button class="btn sm" data-act="labup" ${Game.canAfford(next.cost) ? '' : 'disabled'}>COMPRAR${next.name ? ' ' + next.name.toUpperCase() : ''} · ${Game.s.infinite ? 'GRÁTIS' : money(next.cost) + ' $MEDO'}</button>` : '<span class="tag">TUDO COMPRADO</span>'}
        ${lvl ? '<button class="btn sm ghost" data-act="labdown">DESFAZER</button>' : ''}
      </div>
      ${next ? `<p class="muted small">Próxima compra: +${next.lobe.slots} vagas${next.perkText ? ' · ' + next.perkText : ''}.${World.slotsFree ? '' : ' As vagas novas ainda são compradas uma a uma.'}</p>` : ''}`;
  },

  rarityBody() {
    const { money } = this.h, n2 = v => Number.isInteger(v) ? v : v.toFixed(1);
    const avg = RARITIES.reduce((a, r) => a + r.chance * r.farm, 0);
    return `<table class="lab-table">
      <tr><th></th><th>$/DIA</th><th>ROI</th><th>SEM PARAM.</th><th>INFARTO</th></tr>
      ${RARITIES.map(r => `<tr style="--c:${r.color}"><td class="rn">${r.label}</td><td>${money(r.farm)}</td><td>${n2(r.roi)}d</td><td>${n2(r.roiNoMedic)}d</td><td>${+(r.heart * 100).toFixed(2)}%</td></tr>`).join('')}
    </table>
    <p class="muted small">Um mint médio rende <b>${money(avg)} $MEDO/dia</b> e se paga em <b>${(CFG.mintCost / avg).toFixed(1)} dias</b>.</p>`;
  },

  classBody() {
    const { pct } = this.h, sc = Lab.scheme(), rule = Lab.picks.classRule;
    const name = k => MON[k].short;
    return `<div class="lab-classes">${Object.values(sc).map(c => {
      const p = c.power, fx = rule === 'poderes' ? ` <span class="muted">(${p.farm ? '+' + pct(p.farm) + ' farm' : ''}${p.heart !== 1 ? (p.heart < 1 ? ' · ' + pct(1 - p.heart) + ' menos infarto' : ' · +' + pct(p.heart - 1) + ' infarto') : ''})</span>` : '';
      return `<div><b style="color:${c.color}">${c.label}</b>${fx}<br><span class="muted small">${c.kinds.map(name).join(', ')}</span></div>`;
    }).join('')}</div>`;
  },

  heartBody() {
    const { perHour } = this.h;
    if (!Game.placed().length) return '<p class="muted small">Coloque bonecos na pista para ver quanto cada caso rende aqui.</p>';
    const w = Lab.rate(true), wo = Lab.rate(false);
    return `<div class="lab-status"><span>Sem infarto <b>${perHour(w.gross * 3600)}/h</b></span><span>Com param. <b>${perHour(w.net * 3600)}/h</b></span><span>Sem param. <b>${perHour(wo.net * 3600)}/h</b></span></div>
    <p class="muted small">Estimativa com os bonecos que estão na pista agora.</p>`;
  },

  itemEffect(it) {
    const { pct } = this.h, a = [];
    if (it.farm) a.push((it.farm > 0 ? '+' : '') + pct(it.farm) + ' farm');
    if (it.heart !== 1) a.push(it.heart < 1 ? pct(1 - it.heart) + ' menos infarto' : '+' + pct(it.heart - 1) + ' infarto');
    if (it.heart === 1 && it.farm > 0) a.push('sem risco');
    return a.join(' · ');
  },

  decorBody() {
    const { spr, money } = this.h, mode = Lab.picks.decor, st = Lab.st().decor;
    if (mode === 'off') return this.looksBody();
    let extra = '';
    if (mode === 'lots') extra = `<p class="muted small">${Object.keys(st.lots).length} de ${World.LOTS.length} canteiros ocupados. Alcance: ${LAB_LOT_RADIUS} px.</p>`;
    if (mode === 'acc') extra = `<p class="muted small">${Object.keys(st.acc).length} enfeites presos em vagas.</p>`;
    if (mode === 'global') extra = `<p class="muted small">${st.global.length} de ${LAB_GLOBAL_MAX} na entrada.</p>
      <div class="lab-items">${Object.entries(LAB_ITEMS).map(([k, it]) => `<div class="lab-item">${spr(Lab.lookSprite(k), 2)}<span><b>${it.name}</b><br><span class="muted small">${this.itemEffect(it)}</span></span>
        <span class="lab-item-btns"><button class="btn sm" data-act="labglobal" data-key="${k}" ${st.global.length < LAB_GLOBAL_MAX && Game.canAfford(it.cost) ? '' : 'disabled'}>+ ${Game.s.infinite ? 'GRÁTIS' : money(it.cost)}</button>${st.global.includes(k) ? `<button class="btn sm ghost" data-act="labglobalrm" data-key="${k}">-</button>` : ''}</span></div>`).join('')}</div>`;
    return extra + this.looksBody();
  },

  looksBody() {
    const { spr } = this.h;
    return `<h4 class="lab-sub">APARÊNCIA <span class="muted">(clique na mais bonita)</span></h4>
      <div class="lab-looks">${Object.entries(LAB_ITEMS).map(([k, it]) => `<div class="lab-look-row"><span class="muted small">${it.name}</span><div class="lab-look-opts">${it.looks.map((name, i) => `<button class="lab-look${Lab.look(k) === i + 1 ? ' on' : ''}" data-act="lablook" data-key="${k}" data-n="${i + 1}" title="${name}">${spr(Lab.lookSprite(k, i + 1), 3)}<span>${i + 1}</span></button>`).join('')}</div></div>`).join('')}</div>`;
  },

  maintBody() {
    if (Lab.picks.maint === 'off') return '';
    const w = Lab.wear(), f = Lab.factorAt(0);
    const chips = (act, list, cur, label) => list.map(v => `<button class="chip${v === cur ? ' on' : ''}" data-act="${act}" data-v="${v}" style="--c:var(--gold)">${label(v)}</button>`).join('');
    return `<div class="lab-meter"><div style="width:${Math.round(w * 100)}%;background:${w > 0.7 ? 'var(--bad)' : w > 0.4 ? 'var(--orange)' : 'var(--good)'}"></div></div>
      <div class="lab-status"><span>Desgaste <b>${Math.round(w * 100)}%</b></span><span>Rendimento <b>${Math.round(f * 100)}%</b></span></div>
      <div class="lab-line"><span class="muted small">Estrago total em</span><div class="chips">${chips('labhours', LAB_MAINT_HOURS, Lab.picks.maintHours, v => v + 'H')}</div></div>
      <div class="lab-line"><span class="muted small">Acelerar teste</span><div class="chips">${chips('labaccel', LAB_ACCEL, Lab.picks.accel, v => 'x' + v)}</div></div>
      <div class="row-btns left"><button class="btn sm ghost" data-act="labage" data-v="0.9">GASTAR 90%</button><button class="btn sm ghost" data-act="labage" data-v="1.01">ESTRAGAR</button><button class="btn sm ghost" data-act="labfix">CONSERTAR TUDO</button></div>`;
  },

  summary() {
    return LAB_SYSTEMS.map(s => s.title + ': ' + s.options.find(o => o.key === Lab.picks[s.key]).name).concat(
      Object.entries(LAB_ITEMS).map(([k, it]) => 'Aparência ' + it.name + ': ' + Lab.look(k) + ' (' + it.looks[Lab.look(k) - 1] + ')'));
  },

  render() {
    const { esc } = this.h;
    return `
      <p class="hint">Escolha uma versão de cada sistema. Vale na hora, no parque ao lado. O botão <b>$MEDO INFINITO</b> ajuda a testar as compras.</p>
      ${this.card(1, 'map', this.mapBody())}
      ${this.card(2, 'rarity', this.rarityBody())}
      ${this.card(3, 'classRule', Lab.picks.classRule === 'off' ? '' : '<p class="muted small">No mapa, linhas coloridas ligam os bonecos que estão se ajudando.</p>')}
      ${this.card(4, 'classes', this.classBody())}
      ${this.card(5, 'heart', this.heartBody())}
      ${this.card(6, 'decor', this.decorBody())}
      ${this.card(7, 'track')}
      ${this.card(8, 'maint', this.maintBody())}
      <section class="lab-card px">
        <h4><span class="lab-n">✓</span>MINHAS ESCOLHAS</h4>
        <div class="lab-sum">${this.summary().map(esc).join('<br>')}</div>
        <div class="row-btns left"><button class="btn sm" data-act="labcopy">COPIAR ESCOLHAS</button><button class="btn sm ghost" data-act="labzero">ZERAR COMPRAS DO TESTE</button></div>
      </section>`;
  },

  // devolve true se a ação era da aba
  act(a, d) {
    const { toast, refresh, closeModal, openSlot } = this.h, st = Lab.st();
    switch (a) {
      case 'labpick': Lab.setPick(d.sys, d.opt); return true;
      case 'labup': if (Lab.buyLevel()) toast('Mapa expandido! Veja as vagas novas no mapa.', 'good'); return true;
      case 'labdown': Lab.dropLevel(); return true;
      case 'lablook': Lab.setLook(d.key, +d.n); return true;
      case 'labhours': Lab.picks.maintHours = +d.v; Lab.savePicks(); Lab.fixAll(); return true;
      case 'labaccel': Lab.picks.accel = +d.v; Lab.savePicks(); refresh(); return true;
      case 'labage': Lab.ageNow(+d.v); return true;
      case 'labfix': Lab.fixAll(); return true;
      case 'labglobal': {
        const it = LAB_ITEMS[d.key];
        if (st.decor.global.length < LAB_GLOBAL_MAX && Game.spend(it.cost)) { st.decor.global.push(d.key); Lab.afterFix(); }
        return true;
      }
      case 'labglobalrm': st.decor.global.splice(st.decor.global.indexOf(d.key), 1); Lab.afterFix(); return true;
      case 'lablot': {
        const it = LAB_ITEMS[d.key];
        if (it && Game.spend(it.cost)) { st.decor.lots[d.i] = d.key; Lab.afterFix(); closeModal(); toast(it.name + ' no canteiro!', 'good'); }
        return true;
      }
      case 'lablotrm': delete st.decor.lots[d.i]; Lab.afterFix(); closeModal(); return true;
      case 'labacc': {
        const it = LAB_ITEMS[d.key];
        if (it && Game.spend(it.cost)) { st.decor.acc[d.slot] = d.key; Lab.afterFix(); openSlot(+d.slot); }
        return true;
      }
      case 'labaccrm': delete st.decor.acc[d.slot]; Lab.afterFix(); openSlot(+d.slot); return true;
      case 'labcopy': {
        const text = this.summary().join('\n');
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => toast('Escolhas copiadas!', 'good'), () => toast('Não deu para copiar.', 'bad'));
        else toast('O navegador bloqueou a cópia: é só ler a lista na tela.', 'bad');
        return true;
      }
      case 'labzero':
        Game.s.lab = Lab.freshState();
        Lab.dirty();
        World.rebuild();
        Game.emit('change');
        Game.save();
        toast('Expansões, enfeites e manutenção do teste foram zerados.', 'info');
        return true;
    }
    return false;
  },

  openLot(i) {
    const { openModal, spr, money } = this.h, cur = Lab.st().decor.lots[i], it = LAB_ITEMS[cur];
    openModal(`<h3>CANTEIRO ${i + 1}</h3>
      <p class="hint">O enfeite afeta os bonecos por perto.${it ? ' Colocar outro troca o atual.' : ''}</p>
      ${it ? `<div class="pick px">${spr(Lab.lookSprite(cur), 2)}<div><b>${it.name}</b><br><span class="muted">${this.itemEffect(it)}</span></div><button class="btn sm ghost" data-act="lablotrm" data-i="${i}">TIRAR</button></div>` : ''}
      <div class="pick-list">${Object.entries(LAB_ITEMS).filter(([k]) => k !== cur).map(([k, x]) => `<div class="pick px">${spr(Lab.lookSprite(k), 2)}<div><b>${x.name}</b><br><span class="muted">${this.itemEffect(x)}</span></div><button class="btn sm" data-act="lablot" data-i="${i}" data-key="${k}" ${Game.canAfford(x.cost) ? '' : 'disabled'}>${Game.s.infinite ? 'GRÁTIS' : money(x.cost)}</button></div>`).join('')}</div>`);
  },

  // linhas extras da janela da vaga (classe, bônus e enfeite)
  slotExtra(i, m) {
    const { spr, money, pct } = this.h, b = Lab.buffOf(m), parts = [];
    if (Lab.picks.classRule !== 'off') {
      const c = Lab.classOf(m);
      parts.push(`<p>Classe: <b style="color:${c.color}">${c.label}</b>${b && b.classAdd ? ` · <b class="gold">+${pct(b.classAdd)} de farm</b>` : ' · sem colegas por perto'}</p>`);
    }
    if (b && b.decorAdd) parts.push(`<p class="muted">Enfeites: ${b.decorAdd > 0 ? '+' : ''}${pct(b.decorAdd)} de farm</p>`);
    if (b && b.perkAdd) parts.push(`<p class="muted">Ilha: +${pct(b.perkAdd)} de farm</p>`);
    if (Lab.picks.decor === 'acc') {
      const cur = Lab.st().decor.acc[i], it = LAB_ITEMS[cur];
      parts.push(`<h4>ENFEITE DA VAGA</h4>${it ? `<div class="pick px">${spr(Lab.lookSprite(cur), 2)}<div><b>${it.name}</b></div><button class="btn sm ghost" data-act="labaccrm" data-slot="${i}">TIRAR</button></div>` : ''}
      <div class="pick-list">${Object.entries(LAB_ITEMS).filter(([k]) => k !== cur).map(([k, x]) => `<div class="pick px">${spr(Lab.lookSprite(k), 2)}<div><b>${x.name}</b><br><span class="muted">${this.itemEffect({ farm: x.farm * LAB_ACC_POWER, heart: Math.max(0.2, 1 - (1 - x.heart) * LAB_ACC_POWER) })}</span></div><button class="btn sm" data-act="labacc" data-slot="${i}" data-key="${k}" ${Game.canAfford(x.cost) ? '' : 'disabled'}>${Game.s.infinite ? 'GRÁTIS' : money(x.cost)}</button></div>`).join('')}</div>`);
    }
    return parts.join('');
  },

  // texto extra do balão do mapa
  tip(m) {
    if (Lab.picks.classRule === 'off') return '';
    const c = Lab.classOf(m), b = Lab.buffOf(m);
    return `<br><span style="color:${c.color}">${c.label}</span>${b && b.classAdd ? ` +${this.h.pct(b.classAdd)}` : ''}`;
  },
  classTag(m) {
    if (Lab.picks.classRule === 'off') return '';
    const c = Lab.classOf(m);
    return ` · <span style="color:${c.color}">${c.label}</span>`;
  },
};
