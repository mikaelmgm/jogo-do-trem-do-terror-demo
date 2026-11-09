'use strict';
// ============================================================
//  MUNDO — simulação do trem fantasma + renderização pixel art
//  Resolução lógica 400x260, ampliada sem suavização.
// ============================================================

const W = 400, H = 260;

const World = (() => {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  cv.width = W; cv.height = H;
  ctx.imageSmoothingEnabled = false;

  // área visível do mapa. As expansões aumentam VW/VH (a câmera se afasta): o canto de cima à
  // direita fica parado e o mapa cresce para a esquerda (x negativo) e para baixo
  let VW = W, VH = H, VX0 = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // ---------------- trilho ----------------
  // trilho fixo original — usado só se o gerador não achar um circuito válido
  const CLASSIC_PTS = [
    [276, 51], [262, 56], [250, 68], [196, 70], [142, 72], [104, 82], [74, 99], [58, 124], [60, 152], [78, 176],
    [110, 193], [160, 202], [220, 205], [282, 201], [322, 188], [336, 170], [322, 158], [290, 155],
    [252, 150], [224, 138], [212, 116], [222, 96], [258, 90], [300, 88], [318, 80], [312, 62], [300, 54],
  ];
  const CLASSIC_SLOTS = [[122, 100], [196, 128], [84, 140], [252, 112], [118, 176], [180, 186], [250, 186], [292, 138]];

  function buildTrack(pts) {
    const n = pts.length, raw = [];
    const cr = (p0, p1, p2, p3, t) => {
      const t2 = t * t, t3 = t2 * t;
      return [0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
    };
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let k = 0; k < 40; k++) raw.push(cr(p0, p1, p2, p3, k / 40));
    }
    const cum = [0];
    let len = 0;
    for (let i = 1; i <= raw.length; i++) {
      const a = raw[i - 1], b = raw[i % raw.length];
      len += Math.hypot(b[0] - a[0], b[1] - a[1]);
      cum.push(len);
    }
    const STEP = 0.5, N = Math.floor(len / STEP);
    const xs = new Float32Array(N), ys = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i * STEP;
      while (cum[j + 1] < s) j++;
      const a = raw[j], b = raw[(j + 1) % raw.length];
      const f = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
      xs[i] = a[0] + (b[0] - a[0]) * f;
      ys[i] = a[1] + (b[1] - a[1]) * f;
    }
    const L = N * STEP;
    return {
      L, N, STEP, xs, ys,
      at(s) {
        s = ((s % L) + L) % L;
        const i = Math.min(N - 1, (s / STEP) | 0);
        return { x: xs[i], y: ys[i] };
      },
    };
  }

  function nearestS(t, x, y) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < t.N; i++) {
      const d = (t.xs[i] - x) ** 2 + (t.ys[i] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best * t.STEP;
  }

  // ---------------- trilho procedural ----------------
  // Cada jogador recebe um circuito gerado pela própria seed. A estação fica dentro da casa:
  // o trem sai pela boca (fachada) e volta pelo arco da parede lateral. O resto é sorteado em
  // volta do centro do mapa e sempre ganha as mesmas 8 vagas.
  const STATION_HEAD = [[276, 51], [262, 56], [250, 68]];
  const STATION_TAIL = [[318, 80], [312, 62], [300, 54]];
  const CX = 196, CY = 140, RX = 152, RY = 84;
  const N_SLOTS = 8;
  const UNLOCK_ORDER = [0, 4, 2, 6, 1, 5, 3, 7]; // primeiras vagas espalhadas pelo circuito

  function genTrackPts(rnd) {
    const ang = ([x, y]) => Math.atan2(y - CY, x - CX);
    // percorre no sentido anti-horário (na tela): esquerda → baixo → direita → volta à estação
    const a0 = ang(STATION_HEAD[STATION_HEAD.length - 1]) - 0.35, a1 = ang(STATION_TAIL[0]) - Math.PI * 2 + 0.35;
    const n = 8 + Math.floor(rnd() * 3);
    const pts = STATION_HEAD.slice();
    let dented = false;
    for (let i = 0; i < n; i++) {
      const a = lerp(a0, a1, (i + 0.5 + (rnd() - 0.5) * 0.5) / n);
      let f = 0.62 + rnd() * 0.38;
      if (!dented && rnd() < 0.3) { f = 0.3 + rnd() * 0.2; dented = true; } else dented = false;
      pts.push([clamp(CX + Math.cos(a) * RX * f, 40, 352), clamp(CY + Math.sin(a) * RY * f, 66, 224)]);
    }
    return pts.concat(STATION_TAIL);
  }

  function trackOk(t) { return t.L >= 650 && t.L <= 1150 && pathClear(t, 14, 238); }

  function pathClear(t, minX, maxY) {
    const { N, xs, ys, STEP } = t;
    for (let i = 0; i < N; i++) {
      const s = i * STEP;
      if (xs[i] < minX || xs[i] > 386 || ys[i] > maxY) return false;
      if (s > 50 && s < t.L - 75 && ys[i] < 62) return false;
    }
    // nenhum trecho pode encostar em outro (cruzamento ou curva fechada demais)
    const minArc = 40 / STEP;
    for (let i = 0; i < N; i += 8) for (let j = i + 8; j < N; j += 8) {
      if (Math.min(j - i, N - (j - i)) < minArc) continue;
      if ((xs[i] - xs[j]) ** 2 + (ys[i] - ys[j]) ** 2 < 256) return false;
    }
    return true;
  }

  function genSlots(t, rnd) {
    const { N, xs, ys, STEP, L } = t;
    const tan = i => {
      const a = (i - 6 + N) % N, b = (i + 6) % N;
      const dx = xs[b] - xs[a], dy = ys[b] - ys[a], l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    };
    const hitsTrack = (x0, y0, x1, y1) => {
      for (let i = 0; i < N; i += 2) if (xs[i] > x0 && xs[i] < x1 && ys[i] > y0 && ys[i] < y1) return true;
      return false;
    };
    const fits = (x, y, placed) => {
      if (x < 16 || x > 384 || y < 72 || y > 234) return false;
      if (hitsTrack(x - 11, y - 21, x + 11, y + 5)) return false; // monstro + anel
      if (hitsTrack(x - 20, y + 3, x + 20, y + 13)) return false; // etiqueta com o nome
      return placed.every(p => Math.abs(p.x - x) > 42 || Math.abs(p.y - y) > 30);
    };
    const placed = [];
    for (let k = 0; k < N_SLOTS; k++) {
      const base = 60 + (L - 150) * (k + 0.2 + rnd() * 0.6) / N_SLOTS;
      const sides = rnd() < 0.5 ? [1, -1] : [-1, 1];
      let ok = null;
      search: for (const shift of [0, 14, -14, 28, -28, 42, -42]) {
        const i = clamp(Math.round((base + shift) / STEP), 0, N - 1);
        const [tx, ty] = tan(i), nx = -ty, ny = tx;
        for (const off of [17, 21, 25, 29]) for (const sd of sides) {
          const x = Math.round(xs[i] + nx * off * sd), y = Math.round(ys[i] + ny * off * sd);
          if (fits(x, y, placed)) { ok = { x, y }; break search; }
        }
      }
      if (!ok) return null;
      placed.push(ok);
    }
    return UNLOCK_ORDER.map(k => [placed[k].x, placed[k].y]);
  }

  // ---------------- expansões do mapa ----------------
  // Modo ilhas: fora do terreno original e das ilhas compradas fica o abismo
  let ISLES = null;
  function isleAt(x, y) {
    if (!ISLES) return -1;
    for (let i = 0; i < ISLES.length; i++) {
      const e = ISLES[i], dx = x - e.x, dy = y - e.y, d = Math.hypot(dx / e.rx, dy / e.ry);
      if (d < 0.9 || (d < 1.1 && d <= 1 + 0.05 * Math.sin(Math.atan2(dy, dx) * 7 + e.x))) return i;
    }
    return -1;
  }
  function landAt(x, y) {
    if (!ISLES) return true;
    if (x >= 4 + Math.round(Math.sin(y * 0.3) * 2) && y <= 250 + Math.round(Math.sin(x * 0.2) * 2)) return true;
    return isleAt(x, y) >= 0;
  }

  function trackNear(t, x0, y0, x1, y1) {
    for (let i = 0; i < t.N; i += 2) if (t.xs[i] > x0 && t.xs[i] < x1 && t.ys[i] > y0 && t.ys[i] < y1) return true;
    return false;
  }
  function fitsCourse(t, x, y, others) {
    if (x < VX0 + 22 || x > 384 || y < 72 || y > VH - 26) return false;
    if (!landAt(x - 14, y + 8) || !landAt(x + 14, y + 8) || !landAt(x, y - 16)) return false;
    if (trackNear(t, x - 11, y - 21, x + 11, y + 5)) return false;  // monstro + anel
    if (trackNear(t, x - 20, y + 3, x + 20, y + 13)) return false;  // etiqueta com o nome
    return others.every(p => Math.abs(p.x - x) > 42 || Math.abs(p.y - y) > 30);
  }
  // procura um lugar livre ao lado do trilho, perto da posição s0
  function searchSlot(t, s0, others) {
    const { N, xs, ys, STEP } = t;
    for (const shift of [0, 14, -14, 28, -28, 42, -42, 56, -56]) {
      const i = clamp(Math.round((s0 + shift) / STEP), 0, N - 1);
      const a = (i - 6 + N) % N, b = (i + 6) % N, dx = xs[b] - xs[a], dy = ys[b] - ys[a], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      for (const off of [17, 21, 25, 29, 33]) for (const sd of [1, -1]) {
        const x = Math.round(xs[i] + nx * off * sd), y = Math.round(ys[i] + ny * off * sd);
        if (fitsCourse(t, x, y, others)) return { x, y };
      }
    }
    return null;
  }

  // Acrescenta um laço ao circuito entre dois pontos vizinhos, sem mexer no resto do trilho. Vagas
  // antigas que ficariam em cima do trecho novo são empurradas para o lado mais próximo.
  // Mais pontos de controle sobre o mesmo traçado: cada laço precisa de um trecho só dele, e o
  // circuito base tem poucos pontos
  function densePts(t, pts) {
    const head = STATION_HEAD.length, tail = pts.length - STATION_TAIL.length, step = 40, out = pts.slice(0, head);
    const s0 = nearestS(t, pts[head - 1][0], pts[head - 1][1]), s1 = nearestS(t, pts[tail][0], pts[tail][1]);
    const n = Math.round((s1 - s0) / step);
    for (let k = 1; k < n; k++) { const p = t.at(s0 + (s1 - s0) * k / n); out.push([p.x, p.y]); }
    return out.concat(pts.slice(tail));
  }

  function attachLobe(pts, list, lobe, isle) {
    // nem todo circuito aceita o laço na posição ideal: tenta alguns vizinhos antes de desistir
    for (const [k, ox, oy] of [[1, 0, 0], [1, 0, 24], [0.85, 0, 0]]) {
      const res = tryLobe(pts, list, { ...lobe, c: [lobe.c[0] + ox, lobe.c[1] + oy], rOut: lobe.rOut * k, rT: lobe.rT * k }, isle);
      if (res) return res;
    }
    return null;
  }

  function tryLobe(pts, list, lobe, isle) {
    const [cx, cy] = lobe.c, [ax, ay] = lobe.at, cand = [];
    for (let i = STATION_HEAD.length; i < pts.length - STATION_TAIL.length - 1; i++) {
      const A = pts[i], B = pts[i + 1];
      if (A.lobe || B.lobe) continue;
      // dois laços saindo do mesmo ponto formam uma curva em V: só em último caso
      // melhor sair num trecho perpendicular ao laço: num trecho paralelo o trilho se encosta
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ol = Math.hypot(cx - mx, cy - my) || 1;
      const sl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, along = Math.abs((B[0] - A[0]) * (cx - mx) + (B[1] - A[1]) * (cy - my)) / (ol * sl);
      cand.push({ i, d: Math.hypot(mx - ax, my - ay) + along * 90 + (A.used || B.used ? 1000 : 0) });
    }
    cand.sort((a, b) => a.d - b.d);
    for (const { i } of cand.slice(0, 14)) {
      const A = pts[i], B = pts[i + 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      const l = Math.hypot(cx - mx, cy - my) || 1, dx = (cx - mx) / l, dy = (cy - my) / l;
      let tx = -dy, ty = dx;
      if ((B[0] - A[0]) * tx + (B[1] - A[1]) * ty < 0) { tx = -tx; ty = -ty; }
      const loop = [], n = 9, f0 = 0.75;
      for (let k = 0; k < n; k++) {
        const f = lerp(-(Math.PI - f0), Math.PI - f0, k / (n - 1));
        const p = [cx + dx * lobe.rOut * Math.cos(f) + tx * lobe.rT * Math.sin(f), cy + dy * lobe.rOut * Math.cos(f) + ty * lobe.rT * Math.sin(f)];
        p.lobe = true;
        loop.push(p);
      }
      // pescoço longo sem pontos no meio faz a curva disparar para os lados
      const neck = (P, Q) => {
        const out = [], n2 = Math.ceil(Math.hypot(Q[0] - P[0], Q[1] - P[1]) / 45);
        for (let k = 1; k < n2; k++) { const p = [lerp(P[0], Q[0], k / n2), lerp(P[1], Q[1], k / n2)]; p.lobe = true; out.push(p); }
        return out;
      };
      const next = pts.slice(0, i + 1).concat(neck(A, loop[0]), loop, neck(loop[n - 1], B), pts.slice(i + 1)), t = buildTrack(next);
      if (!pathClear(t, VX0 + 14, VH - 22)) continue;
      // reencaixa as vagas antigas
      const out = list.map(p => ({ ...p }));
      let ok = true;
      for (let k = 0; k < out.length && ok; k++) {
        const others = out.filter((_, j) => j !== k);
        if (fitsCourse(t, out[k].x, out[k].y, others)) continue;
        const moved = searchSlot(t, nearestS(t, out[k].x, out[k].y - 6), others);
        if (moved) Object.assign(out[k], moved); else ok = false;
      }
      if (!ok) continue;
      // vagas novas, espalhadas pelo laço
      const a = nearestS(t, loop[0][0], loop[0][1]), b = nearestS(t, loop[n - 1][0], loop[n - 1][1]);
      let added = 0;
      for (let k = 0; k < lobe.slots; k++) {
        const p = searchSlot(t, a + (b - a) * (k + 0.5) / lobe.slots, out);
        if (p) { out.push({ ...p, isle }); added++; }
      }
      if (added === lobe.slots) {
        for (const j of [i - 1, i, i + 1, i + 2]) if (pts[j]) pts[j].used = true;
        return { pts: next, t, slots: out };
      }
    }
    return null;
  }

  let track, L, SLOTS = [], LOTS = [], GSPOTS = [], PROP = null, pumpkins = [], bg, rust = null;
  const wrap = s => ((s % L) + L) % L;

  function setView([w, h], isles) {
    ISLES = isles;
    if (w === VW && h === VH) return;
    VW = w; VH = h; VX0 = W - w;
    cv.width = VW; cv.height = VH;
    ctx.imageSmoothingEnabled = false;
    vignette = buildVignette();
    scatterSky();
  }

  // o mesmo circuito base da seed + um laço por expansão comprada
  function setTrack(seed) {
    let t = null, slots = null, pts = null;
    for (let attempt = 0; attempt < 80 && !slots; attempt++) {
      const rnd = mulberry32((seed + attempt * 7919) | 0);
      pts = genTrackPts(rnd);
      t = buildTrack(pts);
      if (trackOk(t)) slots = genSlots(t, rnd);
    }
    if (!slots) { pts = CLASSIC_PTS; t = buildTrack(pts); slots = CLASSIC_SLOTS; }
    const plan = Lab.mapPlan();
    setView(plan.view, plan.isles);
    let list = slots.map(([x, y]) => ({ x, y, isle: -1 }));
    if (plan.lobes.length) pts = densePts(t, pts);
    plan.lobes.forEach((lobe, n) => {
      const res = attachLobe(pts, list, lobe, n);
      if (res) { pts = res.pts; t = res.t; list = res.slots; return; }
      // o laço não coube neste circuito: as vagas compradas entram onde houver lugar no trilho
      for (let k = 0; k < lobe.slots; k++) {
        for (let s = 40; s < t.L - 40; s += 40) {
          const p = searchSlot(t, s, list);
          if (p) { list.push({ ...p, isle: -1 }); break; }
        }
      }
    });
    track = t; L = t.L;
    Game.trackLen = L;
    SLOTS = list.map((p, i) => ({ x: p.x, y: p.y, i, isle: p.isle, s: nearestS(t, p.x, p.y - 6) }));
    Game.slotOrder = SLOTS.slice().sort((a, b) => a.s - b.s).map(s => s.i);
    CFG.slots = SLOTS.length;
    Lab.slotsChanged();
    LOTS = []; GSPOTS = []; PROP = null;
    LOTS = buildLots();
    GSPOTS = [[330, 74], [352, 78], [374, 74]].map(([x, y]) => findClear(x, y, LOTS)).filter(Boolean);
    PROP = findClear(214, 76, LOTS.concat(GSPOTS));
    pumpkins = PUMPKINS.filter(([x, y]) => clearSpot(x, y, 10, 10));
    bg = buildBackground(seed);
    rust = null;
  }

  // canteiros de enfeite: um a cada duas vagas, no meio do caminho entre elas
  function buildLots() {
    const order = Game.slotOrder, out = [];
    for (let k = 0; k + 1 < order.length; k += 2) {
      // vagas separadas por uma ponte não têm meio-termo útil: o canteiro fica junto da primeira
      const a = SLOTS[order[k]], b = SLOTS[order[k + 1]], far = Math.hypot(a.x - b.x, a.y - b.y) > 100;
      const p = far ? findClear(a.x, a.y, out) : findClear((a.x + b.x) / 2, (a.y + b.y) / 2, out);
      if (p) out.push({ x: p.x, y: p.y, i: out.length });
    }
    return out;
  }
  function findClear(cx, cy, taken) {
    for (let r = 0; r <= 48; r += 6) for (let k = 0; k < (r ? 12 : 1); k++) {
      const a = k / 12 * Math.PI * 2, x = Math.round(cx + Math.cos(a) * r * 1.4), y = Math.round(cy + Math.sin(a) * r);
      if (x < VX0 + 12 || x > 388 || y < 70 || y > VH - 18) continue;
      if (taken.some(q => Math.abs(q.x - x) < 22 && Math.abs(q.y - y) < 22)) continue;
      if (clearSpot(x, y, 12, 16)) return { x, y };
    }
    return null;
  }

  // decoração não pode ficar em cima do trilho, das vagas, dos canteiros nem fora da terra
  function clearSpot(x, y, w, h) {
    if (!landAt(x, y) || !landAt(x - w / 2, y) || !landAt(x + w / 2, y)) return false;
    const x0 = x - w / 2 - 6, x1 = x + w / 2 + 6, y0 = y - h - 6, y1 = y + 6;
    for (let i = 0; i < track.N; i += 2) if (track.xs[i] > x0 && track.xs[i] < x1 && track.ys[i] > y0 && track.ys[i] < y1) return false;
    if (LOTS.concat(GSPOTS, PROP ? [PROP] : []).some(q => Math.abs(q.x - x) < w / 2 + 12 && y > q.y - 22 && y - h < q.y + 8)) return false;
    return SLOTS.every(s => !(Math.abs(s.x - x) < w / 2 + 22 && y > s.y - 22 && y - h < s.y + 14));
  }

  // ferrugem do trilho (manutenção ÓLEO): desenhada por cima, com a transparência do desgaste
  function rustLayer() {
    if (rust) return rust;
    const c = document.createElement('canvas');
    c.width = VW; c.height = VH;
    const g = c.getContext('2d'), rnd = mulberry32(77), { N, xs, ys } = track;
    for (let i = 0; i < N; i++) {
      const a = (i - 4 + N) % N, b = (i + 4) % N, dx = xs[b] - xs[a], dy = ys[b] - ys[a], l = Math.hypot(dx, dy) || 1;
      for (const side of [-2.7, 2.7]) {
        if (rnd() < 0.15) continue;
        g.fillStyle = rnd() < 0.5 ? '#a0562a' : '#6a3418';
        g.fillRect(Math.round(xs[i] - dy / l * side) - VX0, Math.round(ys[i] + dx / l * side), 1, 1);
      }
    }
    return rust = c;
  }

  // ---------------- arte pré-renderizada ----------------
  const GLOW_Y = makeGlow(9, '#ffb52e');
  const GLOW_SM = makeGlow(5, '#ffd23f');
  const GLOW_O = makeGlow(11, '#ff8a1f');
  const GLOW_G = makeGlow(3, '#c8ff7a');
  const SHADOW = makeEllipse(7, 2, '#0b0912');
  const SHADOW_SM = makeEllipse(3, 1, '#0b0912');

  const PUMPKINS = [[70, 220], [160, 234], [290, 218], [362, 184], [22, 166], [330, 100], [384, 150], [205, 72], [44, 84]];

  // ---------------- casa (3/4) ----------------
  // Fachada com o rosto de frente; parede lateral e telhado recuam para o fundo (DX, DY).
  // A estação fica lá dentro: o trem entra pelo arco da lateral e sai pela boca, e os
  // visitantes entram e saem pela porta lateral.
  const HX0 = 236, HX1 = 291, HB = 56, HT = 33;   // fachada: colunas 236..291, parede nas linhas 33..55
  const DX = 24, DY = -12;                        // profundidade da casa
  const MOUTH_X0 = 252, MOUTH_X1 = 275, MOUTH_TOP = 38;
  const DOOR = [310, 47];                         // porta dos visitantes (base, na parede lateral)
  const sideShift = x => (x - HX1) >> 1;          // a parede lateral sobe 1px a cada 2 colunas
  // chão coberto pela casa: o que estiver aqui só aparece pelas aberturas
  function insideHouse(x, y) {
    const v = (HB - y) / -DY;
    if (v < 0 || v > 1) return false;
    return x >= HX0 + DX * v && x <= HX1 + 1 + DX * v;
  }

  const sign = buildSign();
  const fog = buildFog();
  let vignette = buildVignette();
  const house = buildHouse();
  const clouds = [0, 1, 2].map(i => ({ c: buildCloud(30 + i * 8, 8 + i * 2, 11 + i), x: 40 + i * 140, y: 3 + i * 5, v: 1.5 + i * 0.7 }));

  function buildBackground(seed) {
    const c = document.createElement('canvas');
    c.width = VW; c.height = VH;
    const g = c.getContext('2d');
    const img = g.createImageData(VW, VH), d = img.data;
    const rnd = mulberry32(1337);
    const cache = {};
    const rgb = hex => cache[hex] || (cache[hex] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
    const set = (x, y, hex) => {
      x = Math.round(x) - VX0; y = Math.round(y);
      if (x < 0 || y < 0 || x >= VW || y >= VH) return;
      const i = (y * VW + x) * 4, col = rgb(hex);
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    };
    const areaK = VW * VH / (W * H);
    const ts = Lab.trackStats();

    // céu com degradê pontilhado
    const SKY = ['#07051a', '#0c0922', '#120d2b', '#191235', '#21183f'];
    for (let y = 0; y < 50; y++) {
      const t = Math.min(1, y / 42) * (SKY.length - 1);
      const i = Math.min(SKY.length - 2, Math.floor(t)), f = t - i;
      for (let x = VX0; x < W; x++) set(x, y, f > bayer(x, y) ? SKY[i + 1] : SKY[i]);
    }
    for (let k = 0; k < 80 * VW / W; k++) set(VX0 + rnd() * VW, rnd() * 36, rnd() < 0.3 ? '#a8a0d8' : '#4e4880');

    // lua
    const mx = 120, my = 17, mr = 10;
    for (let y = my - 26; y <= my + 26; y++) for (let x = mx - 26; x <= mx + 26; x++) {
      const dd = Math.hypot(x - mx, y - my);
      if (dd > mr && dd < 26 && (1 - (dd - mr) / 16) * 0.6 > bayer(x, y)) set(x, y, '#2a2350');
    }
    const craters = [[-3, -2, 2.2], [3, 2, 1.8], [-1, 5, 1.3], [5, -4, 1.2], [-6, 3, 1]];
    for (let y = my - mr; y <= my + mr; y++) for (let x = mx - mr; x <= mx + mr; x++) {
      const dd = Math.hypot(x - mx, y - my);
      if (dd > mr) continue;
      let col = '#f5e6a8';
      if (craters.some(([cx, cy, r]) => Math.hypot(x - mx - cx, y - my - cy) <= r)) col = '#d9c47e';
      if (dd > mr - 1.3) col = '#e2cf88';
      if ((x - mx) + (y - my) < -mr * 0.95 && dd > mr - 3) col = '#fff8d8';
      if ((x - mx) + (y - my) > mr * 0.9 && dd > mr - 2.5) col = '#cbb46e';
      set(x, y, col);
    }

    // colinas distantes + castelo
    for (let x = VX0; x < W; x++) {
      const hf = 31 - (3 * Math.sin(x * 0.031) + 2.5 * Math.sin(x * 0.077 + 1.3) + 1.5 * Math.sin(x * 0.19 + 0.4));
      for (let y = Math.round(hf); y < 50; y++) set(x, y, '#191430');
    }
    const castle = [[26, 20, 4, 12], [31, 24, 10, 8], [42, 18, 4, 14], [33, 21, 2, 3], [37, 21, 2, 3]];
    castle.forEach(([x, y, w, h]) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, '#120e24'); });
    [[27, 19], [29, 19], [43, 17], [45, 17]].forEach(([x, y]) => set(x, y, '#120e24'));
    [[28, 24], [44, 22], [35, 27]].forEach(([x, y]) => set(x, y, '#ffd23f'));
    for (let x = VX0; x < W; x++) {
      const hn = 38 - (2.5 * Math.sin(x * 0.045 + 2) + 1.5 * Math.sin(x * 0.12 + 0.7));
      for (let y = Math.round(hn); y < 50; y++) set(x, y, '#15112a');
    }
    // cruzes no morro
    [[70, 33], [84, 34], [160, 36], [176, 35]].forEach(([x, y]) => {
      for (let j = 0; j < 5; j++) set(x, y + j, '#211a3d');
      set(x - 1, y + 1, '#211a3d'); set(x + 1, y + 1, '#211a3d');
    });

    // chão (mais alto à direita, onde fica a entrada do parque)
    const gTop = x => {
      const base = x < 225 ? 44 : x > 292 ? 23 : lerp(44, 23, ease((x - 225) / 67));
      return Math.round(base + Math.sin(x * 0.35) * 0.8 + Math.sin(x * 0.13));
    };
    // modo ilhas: paredão de pedra logo abaixo de cada ilha e abismo no resto
    const abyss = (x, y) => {
      for (let k = 1; k <= 10; k++) {
        if (landAt(x, y - k)) { set(x, y, k < 3 ? '#3a3046' : (x + k) % 5 === 0 ? '#1a1524' : k % 3 ? '#2a2236' : '#231c2e'); return; }
      }
      set(x, y, bayer(x, y) < 0.25 + Math.sin(y * 0.02 + x * 0.01) * 0.1 ? '#0b0916' : '#07050f');
    };
    for (let x = VX0; x < W; x++) {
      const top = gTop(x);
      for (let y = top; y < VH; y++) {
        if (!landAt(x, y)) { abyss(x, y); continue; }
        const r = rnd(), isle = isleAt(x, y), th = isle >= 0 ? ISLE_THEMES[ISLES[isle].theme] : null;
        let col = th ? th.base : y < 60 ? '#1b1e2b' : '#1e2130';
        if (r < 0.05) col = th ? th.a : '#262a3a';
        else if (r < 0.09) col = th ? th.b : '#181a26';
        else if (r < 0.115) col = th ? th.c : '#263a30';
        set(x, y, col);
      }
      if (landAt(x, top)) set(x, top, '#2e4a34');
      if (rnd() < 0.5 && landAt(x, top)) set(x, top - 1, '#2e4a34');
    }
    if (ISLES) for (let k = 0; k < 500; k++) {
      const x = VX0 + rnd() * VW | 0, y = 50 + rnd() * (VH - 50) | 0;
      if (!landAt(x, y) && !landAt(x, y - 11)) set(x, y, rnd() < 0.3 ? '#5a5288' : '#2a2650');
    }
    // tufos de grama
    for (let k = 0; k < 340 * areaK; k++) {
      const x = VX0 + rnd() * VW | 0, y = 50 + rnd() * (VH - 50) | 0;
      if (y < gTop(x) + 3 || !landAt(x, y)) { continue; }
      const light = rnd() < 0.4;
      set(x, y, '#2e4a34'); set(x - 1, y - 1, '#2e4a34'); set(x + 1, y - 1, light ? '#4a7a4e' : '#3f6b44');
      if (rnd() < 0.3) set(x, y - 2, '#3f6b44');
    }

    // caminho de terra da fila, da borda do mapa até a porta lateral da casa
    for (let x = 306; x < W; x++) {
      const top = 40 + Math.round(Math.sin(x * 0.3) * 0.8), bot = 52 + Math.round(Math.sin(x * 0.21 + 1));
      for (let y = top; y <= bot; y++) {
        const r = rnd();
        let col = r < 0.12 ? '#4a3c36' : r < 0.2 ? '#2e2422' : '#3a2e2c';
        if (y === top || y === bot) col = '#2a201e';
        set(x, y, col);
      }
    }
    // pedrinhas no caminho
    for (let k = 0; k < 30; k++) { const x = 312 + rnd() * 86, y = 43 + rnd() * 8; set(x, y, '#5a4a42'); }

    // trilho: cascalho, dormentes e trilhos
    const N = track.N, X = track.xs, Y = track.ys;
    const tan = i => {
      const a = (i - 4 + N) % N, b = (i + 4) % N;
      const dx = X[b] - X[a], dy = Y[b] - Y[a], l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    };
    const stone = ts.ballast || ['#3a3240', '#241f29', '#2c2630'];
    for (let i = 0; i < N; i += 2) {
      const [tx, ty] = tan(i), nx = -ty, ny = tx, over = !landAt(X[i], Y[i]);
      for (let o = -5.5; o <= 5.5; o += 0.5) {
        const r = rnd();
        // no abismo o cascalho vira ponte de madeira
        const col = over ? (Math.abs(o) > 4.8 ? '#2a1a10' : r < 0.3 ? '#4a3220' : '#5a3c26')
          : Math.abs(o) > 4.8 ? '#1a1620' : r < 0.25 ? stone[0] : r < 0.5 ? stone[1] : stone[2];
        set(X[i] + nx * o, Y[i] + ny * o, col);
      }
      if (over && i % 44 === 0) for (let j = 6; j < 20; j++) { set(X[i] - 1, Y[i] + j, '#2a1a10'); set(X[i], Y[i] + j, '#3a2414'); }
    }
    for (let i = 0; i < N; i += 10) {
      const [tx, ty] = tan(i), nx = -ty, ny = tx;
      for (let o = -4.6; o <= 4.6; o += 0.4) set(X[i] + nx * o, Y[i] + ny * o + 1, '#1e150e');
      const tie = ts.stripes && (i / 10) % 2 ? ts.ties[1] : ts.ties[0], dark = ts.stripes ? '#1e150e' : ts.ties[1];
      for (let o = -4.6; o <= 4.6; o += 0.4) {
        set(X[i] + nx * o + tx, Y[i] + ny * o + ty, dark);
        set(X[i] + nx * o, Y[i] + ny * o, tie);
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) {
        const [tx, ty] = tan(i), nx = -ty, ny = tx;
        for (const side of [-2.7, 2.7]) {
          const px = X[i] + nx * side, py = Y[i] + ny * side;
          if (pass === 0) set(px, py + 1, '#2f2a40');
          else set(px, py, side < 0 ? ts.rails[0] : ts.rails[1]);
        }
      }
    }
    g.putImageData(img, 0, 0);
    g.translate(-VX0, 0);

    // decoração estática
    const put = (name, x, y) => { const s = getSprite(name); g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height)); };
    const tombs = [[22, 118], [14, 150], [44, 236], [96, 236], [262, 236], [312, 232], [352, 176], [372, 104], [150, 140], [340, 236], [300, 108]];
    const skulls = [[70, 232], [232, 226], [16, 186], [330, 200]];
    // alguns túmulos e caveiras extras espalhados conforme a seed do trilho
    const drnd = mulberry32(seed ^ 0x5eed);
    for (let k = 0; k < 7; k++) tombs.push([20 + drnd() * 360 | 0, 80 + drnd() * 156 | 0]);
    for (let k = 0; k < 4; k++) skulls.push([20 + drnd() * 360 | 0, 80 + drnd() * 156 | 0]);
    // terra nova ganha enfeites próprios
    const extraTrees = [];
    for (let k = 0; k < Math.round((areaK - 1) * 14); k++) {
      tombs.push([VX0 + 20 + drnd() * (VW - 40) | 0, 80 + drnd() * (VH - 104) | 0]);
      skulls.push([VX0 + 20 + drnd() * (VW - 40) | 0, 80 + drnd() * (VH - 104) | 0]);
      if (k % 2) extraTrees.push([VX0 + 20 + drnd() * (VW - 40) | 0, 80 + drnd() * (VH - 104) | 0]);
    }
    tombs.filter(([x, y]) => clearSpot(x, y, 10, 12))
      .forEach(([x, y]) => { g.drawImage(SHADOW_SM, x - 3, y - 2); put('tomb', x, y); });
    [[10, 72], [34, 206], [356, 128], [388, 214], [196, 242], [56, 62], ...extraTrees].filter(([x, y]) => clearSpot(x, y, 14, 18)).forEach(([x, y]) => put('tree', x, y));
    skulls.filter(([x, y]) => clearSpot(x, y, 6, 5)).forEach(([x, y]) => put('skull', x, y));

    // cerca de ferro no fim do mapa (no modo ilhas o fim do mapa é o abismo)
    if (!ISLES) {
      const fy = VH - H;
      g.fillStyle = '#2b2440';
      g.fillRect(VX0, 249 + fy, VW, 1); g.fillRect(VX0, 255 + fy, VW, 1);
      for (let x = VX0 + 2; x < W; x += 7) {
        g.fillStyle = '#2b2440'; g.fillRect(x, 246 + fy, 2, 14);
        g.fillStyle = '#3e3560'; g.fillRect(x, 245 + fy, 1, 1); g.fillRect(x, 246 + fy, 1, 13);
      }
      g.fillStyle = '#3e3560'; g.fillRect(VX0, 248 + fy, VW, 1);
    }

    // placa "< ENTRADA", acima do caminho
    g.fillStyle = '#3b2a2a'; g.fillRect(371, 35, 2, 6);
    g.fillStyle = '#1b1024'; g.fillRect(352, 26, 41, 10);
    g.fillStyle = '#6b4a2e'; g.fillRect(353, 27, 39, 8);
    drawText(g, '< ENTRADA', 355, 29, '#f2f0f7', 'left', '#2a1a10');
    return c;
  }

  const ISLE_THEMES = [
    { base: '#1c2a24', a: '#25382c', b: '#15201b', c: '#2d4a30' },   // pântano
    { base: '#2e2a26', a: '#3a352e', b: '#24201c', c: '#44403a' },   // ossuário
    { base: '#241a38', a: '#2e2248', b: '#1b132b', c: '#3a2a5c' },   // estúdio
  ];

  function buildSign() {
    const c = document.createElement('canvas');
    c.width = W; c.height = 50;
    const g = c.getContext('2d');
    g.fillStyle = '#3b2a2a'; g.fillRect(182, 19, 2, 26); g.fillRect(227, 19, 2, 26);
    g.fillStyle = '#5a4038'; g.fillRect(182, 19, 1, 26); g.fillRect(227, 19, 1, 26);
    g.fillStyle = '#1b1024'; g.fillRect(175, 8, 60, 13);
    g.fillStyle = '#5a3820'; g.fillRect(176, 9, 58, 11);
    g.fillStyle = '#6b4a2e'; g.fillRect(177, 10, 56, 9);
    drawText(g, 'TREM FANTASMA', 205, 12, '#ffb52e', 'center', '#2a1a10');

    return c;
  }

  function buildCloud(w, h, seed) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const rnd = mulberry32(seed);
    const blobs = [];
    for (let i = 0; i < 6; i++) blobs.push([w * (0.15 + rnd() * 0.7), h * (0.45 + rnd() * 0.3), h * (0.3 + rnd() * 0.3)]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const inside = blobs.some(([bx, by, r]) => Math.hypot((x - bx) * 0.6, y - by) < r);
      if (!inside) continue;
      const above = blobs.some(([bx, by, r]) => Math.hypot((x - bx) * 0.6, y - 1 - by) < r);
      g.fillStyle = above ? '#241c40' : '#3a2e5c';
      g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  function buildFog() {
    const c = document.createElement('canvas');
    c.width = W * 2; c.height = 60;
    const g = c.getContext('2d');
    const rnd = mulberry32(99);
    const blobs = [];
    for (let i = 0; i < 26; i++) blobs.push([rnd() * W * 2, 20 + rnd() * 30, 14 + rnd() * 22]);
    g.fillStyle = '#9c96d0';
    for (let y = 0; y < 60; y++) for (let x = 0; x < W * 2; x++) {
      let v = 0;
      for (const [bx, by, r] of blobs) {
        let dx = Math.abs(x - bx); dx = Math.min(dx, W * 2 - dx);
        v = Math.max(v, 1 - Math.hypot(dx * 0.5, y - by) / r);
      }
      if (v * 0.8 > bayer(x, y)) g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  // casa pré-renderizada: paredes, telhado e detalhes fixos. Boca, arco e porta ficam
  // transparentes (o interior escuro e o que estiver lá dentro são desenhados antes).
  function buildHouse() {
    const c = document.createElement('canvas');
    c.width = W; c.height = 60;
    const g = c.getContext('2d');
    const p = (x, y, col, w, h) => { g.fillStyle = col; g.fillRect(x, y, w || 1, h || 1); };
    const holes = [];
    const xb = HX1 + DX;

    // sombra no chão
    p(HX0 - 1, HB, '#100c1a', HX1 - HX0 + 3, 2);
    for (let x = HX1 + 1; x <= xb; x++) p(x, HB - sideShift(x), '#100c1a', 1, 2);

    // parede lateral (mais escura), coluna a coluna
    for (let x = HX1 + 1; x <= xb; x++) {
      const top = HT - sideShift(x), bot = HB - sideShift(x);
      p(x, top, (x - HX1) % 4 === 0 ? '#171226' : '#1d1730', 1, bot - top);
      p(x, top, '#120d1e');
      p(x, bot - 1, '#151022');
    }
    p(xb, HT - sideShift(xb), '#1b1024', 1, HB - HT);

    // arco de pedra por onde o trem entra
    for (let x = 293; x <= 304; x++) {
      const bot = HB - sideShift(x), d = Math.abs(x - 298.5);
      if (d > 4.5) { p(x, bot - 10, (x + bot) % 2 ? '#5a4a66' : '#463a52', 1, 10); continue; }
      const h = 13 - (d > 3.5 ? 3 : d > 2.5 ? 1 : 0);
      p(x, bot - h - 1, x % 2 ? '#5a4a66' : '#463a52');
      g.clearRect(x, bot - h, 1, h);
      holes.push([x, bot - h, h]);
    }
    // porta dos visitantes, com moldura de madeira e uma janelinha acesa em cima
    for (let x = 306; x <= 313; x++) {
      const bot = HB - sideShift(x);
      if (x === 306 || x === 313) { p(x, bot - 11, '#5a3820', 1, 11); continue; }
      const h = 10 - (x === 307 || x === 312 ? 1 : 0);
      p(x, bot - h - 1, '#5a3820');
      g.clearRect(x, bot - h, 1, h);
      holes.push([x, bot - h, h]);
    }
    for (let x = 307; x <= 312; x++) {
      const bot = HB - sideShift(x);
      p(x, bot - 18, '#1b1024', 1, 5);
      if (x > 307 && x < 312) { p(x, bot - 17, '#fff3a6'); p(x, bot - 16, '#ffd23f', 1, 2); }
    }

    // fachada
    p(HX0, HT, '#2a2140', HX1 - HX0 + 1, HB - HT);
    for (let x = HX0 + 3; x < HX1; x += 4) p(x, HT, '#221a35', 1, HB - HT);
    p(HX0, HT, '#150e22', HX1 - HX0 + 1, 1);
    p(HX0 - 1, HT, '#1b1024', 1, HB - HT);
    p(HX1, HT, '#3a2d5c', 1, HB - HT);
    g.clearRect(MOUTH_X0, MOUTH_TOP, MOUTH_X1 - MOUTH_X0 + 1, HB - MOUTH_TOP);
    // olhos (janelas) e sobrancelhas zangadas
    for (const wx of [240, 279]) {
      p(wx - 1, 35, '#1b1024', 11, 9);
      p(wx, 36, '#ffd23f', 9, 7);
      p(wx, 36, '#fff3a6', 9, 1);
      p(wx, 42, '#e0a020', 9, 1);
    }
    for (let i = 0; i < 11; i++) { p(239 + i, 33 + (i >> 2), '#1b1024'); p(288 - i, 33 + (i >> 2), '#1b1024'); }
    // suportes das lanternas
    for (const lx of [245, 280]) { p(lx - 1, 46, '#1b1024', 5, 1); p(lx, 47, '#1b1024', 3, 5); }

    // frontão (triângulo da fachada) com a beirada esquerda do telhado
    for (let y = 14; y < HT; y++) {
      const hw = (y - 13) * 1.5, xl = Math.ceil(263.5 - hw), xr = Math.floor(263.5 + hw);
      p(xl, y, '#2a2140', xr - xl + 1, 1);
      for (let x = xl; x <= xr; x++) if ((x - HX0) % 4 === 3) p(x, y, '#221a35');
      p(xl - 4, y, '#1b1024');
      p(xl - 3, y, '#7d4cc0');
      p(xl - 2, y, '#4f2b80', 2, 1);
    }
    p(HX0 - 5, HT - 1, '#1b1024', 6, 1);
    p(HX0 - 4, HT - 1, '#4f2b80', 4, 1);
    // janela redonda do sótão
    [[262, 20, 4], [261, 21, 6], [260, 22, 8], [260, 23, 8], [260, 24, 8], [261, 25, 6], [262, 26, 4]].forEach(([x, y, w]) => p(x, y, '#1b1024', w, 1));
    [[262, 21, 4], [261, 22, 6], [261, 23, 6], [261, 24, 6], [262, 25, 4]].forEach(([x, y, w]) => p(x, y, '#ff8a1f', w, 1));
    p(262, 22, '#ffd23f', 3, 2);

    // água do telhado que vai para o fundo: cada pixel é um ponto da beirada da frente
    // deslocado para trás; v = 0 na frente, 1 no fundo
    for (let y = 0; y <= 34; y++) for (let x = 262; x <= 320; x++) {
      const v = (x - 244 - 1.5 * y) / 42, yt = y + 12 * v;
      if (v < 0 || v > 1 || yt < 13 || yt > 33) continue;
      const row = (yt - 13) / 2.5, ri = Math.floor(row);
      let col = '#4f2b80';
      if (row - ri < 0.3) col = '#34195a';
      else if ((v * 12 + (ri % 2) * 0.5) % 1 < 0.12) col = '#43226d';
      if (yt < 14) col = '#7d4cc0';
      if (v < 0.035) col = '#6a3fa8';
      if (v > 0.97 || yt > 32) col = '#22142e';
      p(x, y, col);
    }
    // chaminé torta
    p(283, 4, '#1b1024', 7, 1);
    p(284, 5, '#4a2a2a', 4, 9);
    p(288, 4, '#2e1a1a', 2, 9);
    for (let y = 6; y < 14; y += 2) p(284 + (y % 4 ? 0 : 2), y, '#2a1818', 2, 1);
    p(283, 3, '#3a2d5c', 7, 1);

    return { c, holes };
  }

  function buildVignette() {
    const c = document.createElement('canvas');
    c.width = VW; c.height = VH;
    const g = c.getContext('2d');
    g.fillStyle = '#05030a';
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const dx = (x - VW / 2) / (VW / 2), dy = (y - VH / 2) / (VH / 2);
      const d = Math.sqrt(dx * dx * 0.8 + dy * dy * 0.9);
      if ((d - 0.78) / 0.5 > bayer(x, y)) g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  // ---------------- visitantes ----------------
  const HAIR = ['#2a1a12', '#5a3820', '#c8a050', '#e06030', '#1b1024', '#7a7a8a', '#d04a8a', '#4a6fd0'];
  const SKIN = ['#f2c79a', '#d9a070', '#a8703f', '#6b4226', '#f5d5b5'];
  const SHIRT = ['#e0303c', '#4a6fd0', '#3fae5a', '#ffb52e', '#c050d0', '#2fb0b0', '#f07030', '#e8e8f0'];
  const PANTS = ['#2c3f80', '#3a2a2a', '#2a2a38', '#5a3820'];

  function makeNPC() {
    const pal = { h: pick(HAIR), s: pick(SKIN), t: pick(SHIRT), l: pick(PANTS), f: '#1b1024', e: '#1b1024', w: '#ffffff', o: '#7a1420' };
    pal.T = shade(pal.t, -0.3);
    return {
      spr: { w1: makeSprite(NPC_W1, pal), w2: makeSprite(NPC_W2, pal), s: makeSprite(NPC_S, pal) },
      x: 0, y: 0, path: [], speed: 22, phase: Math.random() * 10, scaredT: 0, exitT: 0, state: 'queue', moving: false,
    };
  }

  // visitante caído (sprite deitado)
  function lying(src) {
    const c = document.createElement('canvas');
    c.width = src.height; c.height = src.width;
    const g = c.getContext('2d');
    g.translate(c.width, 0); g.rotate(Math.PI / 2);
    g.drawImage(src, 0, 0);
    return c;
  }

  // quem desce do carrinho sai pela porta lateral e vai embora pelo caminho
  const LEAVE_HOUSE = () => [DOOR.slice(), [326, 44 + Math.random()], [414, 43 + Math.random() * 2]];
  function getUp(n, speed, path) {
    n.state = 'exit'; n.exitT = 0; n.speed = speed; n.path = path;
  }

  let npcs = [];
  const queue = [];
  const souls = [];
  let spawnT = 0;
  const QUEUE_X = 322, QUEUE_Y = 48;

  function moveAlong(n, dt) {
    n.moving = false;
    if (!n.path.length) return;
    const [tx, ty] = n.path[0];
    const dx = tx - n.x, dy = ty - n.y, dist = Math.hypot(dx, dy), step = n.speed * dt;
    if (dist <= step) { n.x = tx; n.y = ty; n.path.shift(); }
    else { n.x += dx / dist * step; n.y += dy / dist * step; n.moving = true; n.phase += dt; }
  }

  // ---------------- trens ----------------
  const CAR_GAP = 14, CARS = 2, SEATS = CARS * 2;
  const TRAIN_COLORS = [
    { r: '#e0303c', R: '#7a1420' }, { r: '#8a4fd8', R: '#432070' },
    { r: '#2fb08a', R: '#145a46' }, { r: '#e08a20', R: '#7a4a10' },
  ];
  let trains = [];

  function newTrain(s, state) {
    const used = trains.map(t => t.color);
    const color = [0, 1, 2, 3].find(c => !used.includes(c)) || 0;
    return { s, v: 0, state, timer: 0, seats: new Array(SEATS).fill(null), color, departT: 99 };
  }

  function initTrains() {
    trains = [];
    const n = CFG.trains;
    for (let i = 0; i < n; i++) {
      const t = newTrain(L * (i + 0.55) / n, 'moving');
      t.v = CFG.speed;
      for (let k = 0; k < SEATS; k++) if (Math.random() < 0.85) { const r = makeNPC(); r.state = 'ride'; t.seats[k] = r; }
      trains.push(t);
    }
  }

  function seatPos(t, idx) {
    const p = track.at(t.s - (idx >> 1) * CAR_GAP);
    return { x: p.x - 3 + (idx & 1) * 6, y: p.y };
  }

  function gapAhead(t) {
    let best = L;
    for (const o of trains) {
      if (o === t) continue;
      const d = wrap(o.s - t.s);
      if (d > 0 && d < best) best = d;
    }
    return best;
  }

  function stationFree() {
    return trains.every(t => t.state === 'moving' && t.s > 40 && t.s < L - 36);
  }

  function passes(p, a, b) {
    const d = b - a;
    if (d <= 0) return false;
    const off = wrap(p - a);
    return off > 0 && off <= d;
  }

  function slotMonster(i) {
    const b = Lab.buffs().bySlot[i];
    return b ? b.m : undefined;
  }

  function scareCar(t, k, slot) {
    const m = slotMonster(slot.i);
    if (!m || !Lab.canScare(m)) return;
    const riders = [t.seats[k * 2], t.seats[k * 2 + 1]].filter(r => r && r.state === 'ride');
    if (!riders.length) return;
    const rar = RAR[m.rarity], reward = Game.rewardOf(m) * Game.eventFarm(m) * Lab.cartFactor(t.color);
    const amount = reward * riders.length;
    Game.scared(riders.length);
    anim(m.id).t = 0;
    // o susto já vira $MEDO na carteira. Quanto mais raro o monstro, maior (e mais longo) o
    // susto — e maior o risco de infarto
    Game.earn(amount);
    riders.forEach(r => { r.scaredT = 1 + rar.power * 0.15; r.earned = (r.earned || 0) + reward; });
    for (let j = 0; j < 2; j++) {
      const r = t.seats[k * 2 + j];
      if (r && r.state === 'ride' && Math.random() < Lab.heartOf(m) * Game.eventHeart() * HEART_MULT) heartAttack(t, k * 2 + j, m);
    }
    const p = track.at(t.s - k * CAR_GAP);
    floatText(p.x, p.y - 18, '+' + amount.toFixed(4), rar.color);
    burst(slot.x, slot.y - 8, rar.color, 5 + rar.power * 2, p);
    if (m.rarity === 'lendario') bump(0.12);
    if (m.rarity === 'epico' || m.rarity === 'lendario') floatText(slot.x, slot.y - 26, 'BOO!', rar.color, 0.9);
  }

  // #heart=N na URL multiplica a chance de infarto (só para testar)
  const HEART_MULT = +((location.hash.match(/heart=(\d+)/) || [])[1] || 1);

  function heartAttack(t, idx, m) {
    const r = t.seats[idx], sp = seatPos(t, idx);
    const res = Game.heartAttack(m, r.earned);
    floatText(sp.x, sp.y - 16, 'INFARTO!', '#e0303c', 1.8);
    if (res.refund > 0) { floatText(sp.x, sp.y - 2, '-' + res.refund.toFixed(4) + ' ESTORNO', '#ff8a1f', 2.2); r.earned = 0; }
    if (res.bill > 0) floatText(sp.x, sp.y - 2, '-' + res.bill.toFixed(4) + ' HOSPITAL', '#ff8a1f', 2.2);
    if (res.saved) {
      floatText(sp.x, sp.y - 24, 'SALVO!', '#5ff5ff', 1.6);
      for (let q = 0; q < 8; q++) parts.push({ x: sp.x, y: sp.y - 6, vx: rand(-15, 15), vy: rand(-35, -15), color: '#5ff5ff', t: 0, life: 0.7, g: 40 });
      // paramédicos de plantão: choque no próprio carrinho e o visitante segue a volta...
      if (!res.leave) { r.zapT = 0.9; return; }
      // ...ou desce e é atendido fora do carrinho: não leva os outros sustos da volta
      t.seats[idx] = null;
      r.x = sp.x; r.y = sp.y + 9; r.path = []; r.state = 'down'; r.downT = 0; r.medevac = true;
      r.spr.d = r.spr.d || lying(r.spr.s);
      npcs.push(r);
      return;
    }
    // sem paramédicos: morre e você paga a indenização à família
    t.seats[idx] = null;
    r.x = sp.x; r.y = sp.y + 9; r.path = []; r.state = 'down'; r.downT = 0;
    r.spr.d = r.spr.d || lying(r.spr.s);
    npcs.push(r);
    if (res.fee > 0) floatText(sp.x, sp.y - 8, '-' + res.fee.toFixed(4) + ' INDENIZAÇÃO', '#ff8a1f', 2.2);
    for (let q = 0; q < 8; q++) parts.push({ x: sp.x, y: sp.y - 6, vx: rand(-15, 15), vy: rand(-35, -15), color: '#e0303c', t: 0, life: 0.9, g: 40 });
    bump(0.12);
  }

  function updateTrains(dt) {
    // sincroniza a quantidade de trens (fluxo turbinado e eventos põem carrinhos extras)
    const want = Game.trainCount();
    while (trains.length > want) trains.pop();
    if (trains.length < want && stationFree()) trains.push(newTrain(0, 'load'));

    const ts = Lab.trackStats(), speed = CFG.speed * Lab.speedMult();
    // trilho FREIO DO SUSTO: quase para em cada boneco
    const nearMonster = s => SLOTS.some(sl => slotMonster(sl.i) && Math.min(wrap(sl.s - s), wrap(s - sl.s)) < 24);
    for (const t of trains) {
      t.seats.forEach(r => { if (r && r.scaredT > 0) r.scaredT -= dt; if (r && r.zapT > 0) r.zapT -= dt; });

      if (t.state === 'moving') {
        const gap = gapAhead(t);
        let target = ts.brake && nearMonster(t.s) ? CFG.speed * ts.brake * Lab.oilSpeed() : speed;
        const toStation = L - t.s;
        if (toStation < 30) target = Math.max(10, speed * toStation / 30);
        if (gap < 46) target = Math.min(target, Math.max(0, (gap - 30) * 2.5));
        t.v += clamp(target - t.v, -90 * dt, 30 * dt);
        const prev = t.s;
        t.s += t.v * dt;
        t.departT += dt;
        for (let k = 0; k < CARS; k++) {
          for (const slot of SLOTS) if (passes(slot.s, prev - k * CAR_GAP, t.s - k * CAR_GAP)) scareCar(t, k, slot);
        }
        if (t.s >= L) { t.s = 0; t.v = 0; t.state = 'unload'; t.timer = 0; }
      } else if (t.state === 'unload') {
        t.timer += dt;
        if (t.timer > 0.22) {
          t.timer = 0;
          const idx = t.seats.findIndex(r => r);
          if (idx < 0) { t.state = 'load'; t.timer = 0; continue; }
          const r = t.seats[idx], sp = seatPos(t, idx);
          t.seats[idx] = null;
          r.x = sp.x; r.y = sp.y;
          getUp(r, 34, LEAVE_HOUSE());
          npcs.push(r);
        }
      } else if (t.state === 'load') {
        t.timer += dt;
        // o próximo da fila só entra quando o anterior já passou pela porta
        const boarding = t.seats.some(r => r && r.state === 'board' && !r.inDoor);
        const free = t.seats.findIndex(r => !r);
        const front = queue[0];
        if (free >= 0 && front && !boarding && Math.hypot(front.x - QUEUE_X, front.y - QUEUE_Y) < 2) {
          queue.shift();
          front.state = 'board'; front.train = t; front.seat = free; front.speed = 34; front.inDoor = false;
          t.seats[free] = front;
        }
        const stillBoarding = t.seats.some(r => r && r.state === 'board');
        const filled = t.seats.filter(Boolean).length;
        const go = !stillBoarding && (filled === SEATS || (t.timer > 3.5 && filled > 0) || t.timer > 9);
        if (go) { t.state = 'moving'; t.v = 0; t.departT = 0; t.timer = 0; }
      }
    }
  }

  function updateNPCs(dt) {
    spawnT -= dt;
    if (spawnT <= 0 && queue.length < 9) {
      spawnT = rand(0.9, 2.2);
      const n = makeNPC();
      n.x = 414; n.y = QUEUE_Y + rand(-1, 1);
      queue.push(n); npcs.push(n);
    }
    queue.forEach((n, i) => { n.path = [[QUEUE_X + i * 9, QUEUE_Y]]; });

    for (const n of npcs) {
      if (n.scaredT > 0) n.scaredT -= dt;
      // embarque: fila → porta lateral → assento (o trem está parado dentro da casa)
      if (n.state === 'board') {
        const sp = seatPos(n.train, n.seat);
        n.path = n.inDoor ? [[sp.x, sp.y]] : [DOOR.slice(), [sp.x, sp.y]];
      }
      if (n.state === 'exit') n.exitT += dt;
      moveAlong(n, dt);
      if (n.state === 'board' && !n.inDoor && n.x === DOOR[0] && n.y === DOOR[1]) n.inDoor = true;
      if (n.state === 'board' && n.inDoor && !n.path.length) n.state = 'ride';
      // sem paramédico o visitante morre: fica caído e a alma sobe
      if (n.state === 'down') {
        n.downT += dt;
        if (n.downT > 2.2) { if (!n.medevac) souls.push({ x: n.x, y: n.y - 4, t: 0 }); n.state = 'gone'; }
      }
    }
    npcs = npcs.filter(n => n.state !== 'ride' && n.state !== 'gone' && !(n.state === 'exit' && n.x > 410));
  }

  // ---------------- efeitos ----------------
  const parts = [], texts = [], bats = [];
  const anims = {};
  const anim = id => anims[id] || (anims[id] = { t: 9 });
  // tremor de tela: 1px, curto e no máximo uma vez a cada 5s, para vários lendários na pista não
  // deixarem a tela tremendo sem parar
  let shake = 0, shakeReady = 0;
  function bump(secs) {
    if (time < shakeReady) return;
    shake = secs;
    shakeReady = time + 5;
  }

  function floatText(x, y, text, color, life) {
    texts.push({ x, y, text, color, t: 0, life: life || 1.4 });
  }
  function burst(x, y, color, n, toward) {
    for (let i = 0; i < n; i++) {
      let vx = rand(-30, 30), vy = rand(-40, -10);
      if (toward) { const dx = toward.x - x, dy = toward.y - y, l = Math.hypot(dx, dy) || 1; vx += dx / l * 50; vy += dy / l * 50; }
      parts.push({ x, y, vx, vy, color, t: 0, life: rand(0.4, 0.8), g: 60 });
    }
  }

  const sparkles = (x, y, color) => {
    if (Math.random() < 0.25) parts.push({ x: x + rand(-9, 9), y: y + rand(-16, 0), vx: 0, vy: -12, color, t: 0, life: 0.6, g: 0 });
  };

  const stars = [], fireflies = [];
  function scatterSky() {
    const rnd = mulberry32(5), k = VW / W;
    stars.length = fireflies.length = 0;
    for (let i = 0; i < 26 * k; i++) stars.push({ x: VX0 + rnd() * VW | 0, y: rnd() * 30 | 0, p: rnd() * 6, big: rnd() < 0.2 });
    for (let i = 0; i < 14 * k * VH / H; i++) fireflies.push({ x: rand(VX0, W), y: rand(60, VH - 20), p: rand(0, 10), sp: rand(0.3, 0.8) });
  }
  scatterSky();
  let batT = 4;

  // ---------------- coisinhas clicáveis e eventos ----------------
  // De vez em quando aparece algo no parque que dá $MEDO no clique. Na Lua Vermelha vêm
  // lobisomens que atacam os carrinhos; na Sexta-feira 13, gatos pretos; no Halloween, doces.
  const goodies = [], wolves = [];
  let goodieT = rand(8, 15), extraT = 0, wolfT = 0, flash = 0;
  const GOLD_BAT = { k: '#c8a020', r: '#fff3a6' };
  const CANDY_PALS = [{ r: '#e0303c' }, { r: '#7cc85a' }, { r: '#b86bff' }, { r: '#4aa3ff' }];
  const GLOW_C = makeGlow(5, '#5ff5ff');
  const GLOW_R = makeGlow(16, '#e0303c');
  const RED_MOON = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 21;
    const g = c.getContext('2d');
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      const d = Math.hypot(x - 10, y - 10);
      if (d > 10) continue;
      g.fillStyle = [[7, 8, 2.2], [13, 12, 1.8], [9, 15, 1.3], [15, 6, 1.2]].some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r) ? '#8a1420' : d > 8.7 ? '#b01c28' : '#d8303a';
      g.fillRect(x, y, 1, 1);
    }
    return c;
  })();

  function spawnGoodie(type) {
    const dir = Math.random() < 0.5 ? 1 : -1, g = { type, t: 0, ox: 0, oy: 0 };
    const low = VH - H;
    if (type === 'bat') Object.assign(g, { x: dir > 0 ? VX0 - 8 : W + 8, y: rand(40, 200 + low), vx: dir * rand(30, 45), life: 15 * VW / W, value: 1.5 });
    else if (type === 'soul') Object.assign(g, { x: rand(VX0 + 30, 370), y: rand(80, 230 + low), life: 9, value: 1 });
    else if (type === 'ghost') Object.assign(g, { x: rand(VX0 + 30, 370), y: rand(90, 235 + low), life: 5, value: 1 });
    else if (type === 'cat') Object.assign(g, { x: dir > 0 ? VX0 - 10 : W + 10, y: rand(80, 238 + low), vx: dir * rand(18, 26), life: 30 * VW / W, value: 3 });
    else Object.assign(g, { x: rand(VX0 + 20, 380), y: -6, vy: rand(25, 40), ground: rand(90, 240 + low), life: 9, value: 0.6, pal: pick(CANDY_PALS) });
    goodies.push(g);
  }
  const goodiePos = g => ({ x: g.x + g.ox, y: g.y + g.oy });

  function updateGoodies(dt) {
    const ev = Game.event(), key = ev && ev.key;
    goodieT -= dt;
    if (goodieT <= 0) { goodieT = rand(12, 25); spawnGoodie(pick(['bat', 'bat', 'soul', 'ghost'])); }
    if (key === 'friday13' || key === 'halloween') {
      extraT -= dt;
      // poucos de cada vez: o evento é um tempero, não uma chuva de coisas na tela
      if (extraT <= 0) { extraT = key === 'halloween' ? rand(7, 12) : rand(12, 20); spawnGoodie(key === 'halloween' ? 'candy' : 'cat'); }
    }
    for (let i = goodies.length - 1; i >= 0; i--) {
      const g = goodies[i];
      g.t += dt;
      if (g.vx) g.x += g.vx * dt;
      if (g.type === 'bat') g.oy = Math.sin(g.t * 3) * 6;
      if (g.type === 'soul') { g.ox = Math.sin(g.t * 1.3) * 10; g.oy = Math.cos(g.t * 1.7) * 6; }
      if (g.type === 'ghost') g.oy = -Math.min(1, g.t * 1.5) * 6 + Math.sin(g.t * 4);
      if (g.type === 'candy' && g.y < g.ground) g.y = Math.min(g.ground, g.y + g.vy * dt);
      if (g.t > g.life || g.x < VX0 - 24 || g.x > W + 24) goodies.splice(i, 1);
    }
  }

  // lobisomem corre até um ponto do trilho, espera e ataca o primeiro carrinho com gente
  function spawnWolf() {
    const left = Math.random() < 0.5, p = track.at(rand(60, L - 90));
    wolves.push({ x: left ? VX0 - 12 : W + 12, y: rand(90, 235 + VH - H), tx: p.x + rand(-4, 4), ty: p.y + 7, state: 'run', t: 0, flip: !left });
  }
  function wolfLeave(w) { w.state = 'leave'; w.tx = w.x < VX0 + VW / 2 ? VX0 - 24 : W + 24; w.ty = w.y; }
  function wolfAttack(t, idx, w) {
    const r = t.seats[idx], sp = seatPos(t, idx);
    t.seats[idx] = null;
    const fee = Game.wolfKill();
    r.x = sp.x; r.y = sp.y + 9; r.path = []; r.state = 'down'; r.downT = 0;
    r.spr.d = r.spr.d || lying(r.spr.s);
    npcs.push(r);
    floatText(sp.x, sp.y - 16, 'LOBISOMEM!', '#e0303c', 1.8);
    if (fee > 0) floatText(sp.x, sp.y - 8, '-' + fee.toFixed(4) + ' INDENIZAÇÃO', '#ff8a1f', 2.2);
    for (let q = 0; q < 12; q++) parts.push({ x: sp.x, y: sp.y - 6, vx: rand(-25, 25), vy: rand(-45, -15), color: '#7a1420', t: 0, life: 0.9, g: 60 });
    w.bite = 0.5;
    bump(0.15);
  }
  function updateWolves(dt) {
    const ev = Game.event(), on = !!ev && ev.key === 'bloodmoon';
    if (on) {
      wolfT -= dt;
      if (wolfT <= 0 && wolves.filter(w => w.state !== 'leave').length < 2) { wolfT = rand(9, 14); spawnWolf(); }
    }
    for (let i = wolves.length - 1; i >= 0; i--) {
      const w = wolves[i];
      w.t += dt;
      if (w.bite > 0) w.bite -= dt;
      if (!on && w.state !== 'leave') wolfLeave(w);
      if (w.state !== 'lurk') {
        const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy), step = (w.state === 'leave' ? 55 : 30) * dt;
        if (d <= step) {
          w.x = w.tx; w.y = w.ty;
          if (w.state === 'leave') { wolves.splice(i, 1); continue; }
          w.state = 'lurk';
        } else { w.x += dx / d * step; w.y += dy / d * step; w.flip = dx < 0; }
      }
      if (w.state === 'leave') continue;
      attack: for (const t of trains) for (let k = 0; k < CARS; k++) {
        const p = track.at(t.s - k * CAR_GAP);
        if (insideHouse(p.x, p.y) || Math.hypot(p.x - w.x, p.y - w.y) > 12) continue;
        const idx = [k * 2, k * 2 + 1].find(j => t.seats[j] && t.seats[j].state === 'ride');
        if (idx === undefined) continue;
        wolfAttack(t, idx, w);
        wolfLeave(w);
        break attack;
      }
    }
  }

  // clique numa coisinha ou num lobisomem; take = false só testa (para o cursor)
  function hitExtra(p, take) {
    for (let i = wolves.length - 1; i >= 0; i--) {
      const w = wolves[i];
      if (w.state === 'leave' || Math.abs(p.x - w.x) > 9 || p.y < w.y - 17 || p.y > w.y + 2) continue;
      if (!take) return true;
      wolves.splice(i, 1);
      const v = Game.goodieValue(1);
      Game.collect(v);
      floatText(w.x, w.y - 20, '+' + v.toFixed(2), '#ffd23f', 1.4);
      floatText(w.x, w.y - 28, 'CAIU!', '#e0303c', 1.2);
      burst(w.x, w.y - 8, '#7a1420', 14);
      return true;
    }
    for (let i = goodies.length - 1; i >= 0; i--) {
      const g = goodies[i], q = goodiePos(g);
      if (Math.hypot(p.x - q.x, p.y - q.y) > 9) continue;
      if (!take) return true;
      goodies.splice(i, 1);
      const v = Game.goodieValue(g.value);
      Game.collect(v);
      floatText(q.x, q.y - 8, '+' + v.toFixed(2), '#ffd23f', 1.4);
      burst(q.x, q.y, '#ffd23f', 10);
      return true;
    }
    return false;
  }

  function drawGoodies() {
    for (const g of goodies) {
      const q = goodiePos(g), x = Math.round(q.x), y = Math.round(q.y);
      const a = Math.max(0, Math.min(1, g.life - g.t));
      ctx.globalAlpha = a;
      if (g.type === 'bat') {
        ctx.globalAlpha = a * 0.5; ctx.drawImage(GLOW_SM, x - 5, y - 5); ctx.globalAlpha = a;
        ctx.drawImage(getSprite(Math.floor(g.t * 8) % 2 ? 'bat1' : 'bat2', GOLD_BAT, 'goldbat'), x - 3, y - 2);
      } else if (g.type === 'soul') {
        ctx.globalAlpha = a * 0.6; ctx.drawImage(GLOW_C, x - 5, y - 5); ctx.globalAlpha = a;
        px(x - 1, y - 1, '#e8ffff', 2, 2);
      } else if (g.type === 'ghost') {
        ctx.globalAlpha = a * 0.9;
        SOUL.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] !== '.') px(x - 2 + i, y - 2 + j, row[i] === 'w' ? '#e4e2f5' : '#1b1024'); });
      } else if (g.type === 'cat') {
        const spr = getSprite(Math.floor(g.t * 6) % 2 ? 'cat1' : 'cat2');
        const k = 'catL' + (Math.floor(g.t * 6) % 2);
        ctx.drawImage(g.vx < 0 ? (_sprCache[k] || (_sprCache[k] = flipSprite(spr))) : spr, x - 5, y - 3);
        if (Math.floor(g.t * 2) % 2) px(g.vx < 0 ? x - 4 : x + 3, y - 1, '#ffd23f');
      } else {
        ctx.drawImage(getSprite('candy', g.pal, 'candy' + g.pal.r), x - 3, y - 1);
      }
      // brilhinho piscando para chamar atenção
      if (Math.floor(time * 4 + g.t * 3) % 4 === 0) px(x + 4, y - 5, '#fff3a6');
      ctx.globalAlpha = 1;
    }
  }

  function drawWolf(w) {
    const lurk = w.state === 'lurk';
    const name = w.bite > 0 ? 'wolf_s' : 'wolf';
    const spr = w.flip ? (_sprCache[name + '|flip'] || (_sprCache[name + '|flip'] = flipSprite(getSprite(name)))) : getSprite(name);
    const bob = lurk ? Math.round(Math.sin(w.t * 6)) : Math.floor(w.t * 10) % 2 ? -1 : 0;
    ctx.drawImage(SHADOW, Math.round(w.x) - 7, Math.round(w.y) - 2);
    ctx.drawImage(spr, Math.round(w.x) - 8, Math.round(w.y) - 16 + bob);
    if (lurk && Math.floor(time * 3) % 2) drawText(ctx, '!', Math.round(w.x), Math.round(w.y) - 24, '#e0303c', 'center');
  }

  // tinta do céu/parque em cada evento
  function drawEventSky() {
    const ev = Game.event();
    if (ev && ev.key === 'bloodmoon') {
      ctx.globalAlpha = 0.45; ctx.drawImage(GLOW_R, 120 - 16, 17 - 16); ctx.globalAlpha = 1;
      ctx.drawImage(RED_MOON, 120 - 10, 17 - 10);
    }
  }
  function drawEventTint() {
    const ev = Game.event();
    if (!ev) return;
    ctx.fillStyle = ev.key === 'bloodmoon' ? 'rgba(150,0,25,0.2)' : ev.key === 'friday13' ? 'rgba(10,45,20,0.22)' : 'rgba(255,110,0,0.09)';
    ctx.fillRect(VX0, 0, VW, VH);
    if (flash > 0) { ctx.fillStyle = 'rgba(230,240,255,' + (flash * 0.6).toFixed(2) + ')'; ctx.fillRect(VX0, 0, VW, VH); }
  }

  // ---------------- input ----------------
  let mouse = null, hover = -1, hoverLot = -1, onSlotCb = null, onHoverCb = null, onLotCb = null;
  function toLogical(e) {
    const r = cv.getBoundingClientRect();
    return { x: VX0 + (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH };
  }
  function slotAt(p) {
    for (const s of SLOTS) if (Math.abs(p.x - s.x) <= 11 && p.y >= s.y - 30 && p.y <= s.y + 11) return s.i;
    return -1;
  }
  function lotAt(p) {
    if (Lab.picks.decor !== 'lots') return -1;
    for (const l of LOTS) if (Math.abs(p.x - l.x) <= 9 && p.y >= l.y - 18 && p.y <= l.y + 4) return l.i;
    return -1;
  }
  // cliques da manutenção: lata de óleo, caldeira, pacto, bateria dos bonecos, carrinho sujo
  function maintHit(p, take) {
    const o = Lab.picks.maint;
    if (PROP && (o === 'oil' || o === 'coal' || o === 'pact') && Math.abs(p.x - PROP.x) <= 11 && p.y >= PROP.y - 20 && p.y <= PROP.y + 4) {
      if (take) useProp(o);
      return true;
    }
    if (o === 'battery') {
      const i = slotAt(p), m = i >= 0 ? slotMonster(i) : null;
      if (m && Lab.battery(m) <= 0.6) {
        if (take) { Lab.charge(m); floatText(SLOTS[i].x, SLOTS[i].y - 26, 'CARREGADO!', '#5ee07a', 1.2); burst(SLOTS[i].x, SLOTS[i].y - 10, '#5ee07a', 10); }
        return true;
      }
    }
    if (o === 'vomit') {
      for (const t of trains) for (let k = 0; k < CARS; k++) {
        const c = track.at(t.s - k * CAR_GAP);
        if (Math.hypot(p.x - c.x, p.y - c.y) > 10 || insideHouse(c.x, c.y) || Lab.dirt(t.color) < 0.1) continue;
        if (take) { Lab.clean(t.color); floatText(c.x, c.y - 14, 'LIMPO!', '#5ff5ff', 1.2); burst(c.x, c.y, '#5ff5ff', 10); }
        return true;
      }
    }
    return false;
  }
  function useProp(o) {
    const x = PROP.x, y = PROP.y - 18;
    if (o === 'oil') { Lab.oil(); floatText(x, y, 'TRILHO LUBRIFICADO!', '#ffd23f', 1.4); burst(PROP.x, PROP.y - 8, '#ffd23f', 12); }
    else if (o === 'coal') { Lab.stoke(); floatText(x, y, '+CARVÃO', '#ff8a1f', 1); burst(PROP.x, PROP.y - 10, '#ff8a1f', 10); }
    else if (Lab.signPact()) { floatText(x, y, 'PACTO ASSINADO!', '#e0303c', 1.6); burst(PROP.x, PROP.y - 8, '#e0303c', 12); }
    else floatText(x, y, 'AINDA NÃO VENCEU', '#8b87a6', 1.2);
  }
  cv.addEventListener('mousemove', e => {
    mouse = toLogical(e);
    hover = slotAt(mouse);
    hoverLot = lotAt(mouse);
    cv.style.cursor = hover >= 0 || hoverLot >= 0 || hitExtra(mouse, false) || maintHit(mouse, false) ? 'pointer' : 'default';
    if (onHoverCb) onHoverCb(hover, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => { mouse = null; hover = hoverLot = -1; if (onHoverCb) onHoverCb(-1); });
  cv.addEventListener('click', e => {
    const p = toLogical(e);
    if (hitExtra(p, true) || maintHit(p, true)) return;
    const l = lotAt(p);
    if (l >= 0) { if (onLotCb) onLotCb(l); return; }
    const i = slotAt(p);
    if (i >= 0 && onSlotCb) onSlotCb(i);
  });

  // ---------------- update ----------------
  let time = 0, mouth = 0, blink = 0, blinkT = 3, smokeT = 0;
  let camK = 1, camT = 0;   // animação da câmera se afastando depois de uma expansão

  function update(dt) {
    time += dt;
    if (camT > 0) camT = Math.max(0, camT - dt / 1.4);
    Lab.update(dt);
    updateTrains(dt);
    updateNPCs(dt);

    // a boca abre toda quando um trem está saindo por ela
    const leaving = trains.some(t => t.state === 'moving' && t.s < 46);
    const docked = trains.some(t => t.state !== 'moving');
    const mt = leaving ? 1 : docked ? 0.3 : 0.1;
    mouth += (mt - mouth) * Math.min(1, dt * 8);
    blinkT -= dt;
    if (blinkT < 0) { blink = 0.18; blinkT = rand(2.5, 6); }
    if (blink > 0) blink -= dt;

    for (const a of Object.values(anims)) a.t += dt;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
      if (p.t > p.life) parts.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) { texts[i].t += dt; if (texts[i].t > texts[i].life) texts.splice(i, 1); }
    for (let i = souls.length - 1; i >= 0; i--) { souls[i].t += dt; if (souls[i].t > 2.4) souls.splice(i, 1); }
    // fumaça esverdeada da chaminé
    smokeT -= dt;
    if (smokeT < 0) {
      // caldeira apagando: a chaminé quase não solta fumaça
      smokeT = rand(0.2, 0.45) / (Lab.picks.maint === 'coal' ? Math.max(0.12, 1 - Lab.wear()) : 1);
      parts.push({ x: 286 + rand(-1, 1), y: 2, vx: rand(3, 8), vy: rand(-3, -1), color: pick(['#4a4662', '#5a6a5a', '#3a3654']), t: 0, life: rand(1.2, 2.2), g: 0 });
    }

    batT -= dt;
    if (batT < 0) {
      batT = rand(5, 12);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) bats.push({ x: dir > 0 ? VX0 - 10 - i * 9 : W + 10 + i * 9, y: rand(4, 26), vx: dir * rand(28, 40), p: rand(0, 3) });
    }
    for (let i = bats.length - 1; i >= 0; i--) {
      const b = bats[i];
      b.x += b.vx * dt; b.p += dt;
      if (b.x < VX0 - 30 || b.x > W + 30) bats.splice(i, 1);
    }
    clouds.forEach(c => { c.x += c.v * dt; if (c.x > W + 10) c.x = VX0 - c.c.width - 10; });
    if (shake > 0) shake -= dt;
    updateGoodies(dt);
    updateWolves(dt);
    const ev = Game.event();
    if (ev && ev.key === 'halloween') batT -= dt * 0.5;
    if (flash > 0) flash -= dt * 3;
    else if (ev && ev.key === 'friday13' && Math.random() < dt * 0.03) flash = 1;
  }


  // ---------------- render ----------------
  const RING = [];
  for (let a = 0; a < 64; a++) {
    const p = [Math.round(Math.cos(a / 64 * Math.PI * 2) * 11), Math.round(Math.sin(a / 64 * Math.PI * 2) * 4)];
    if (!RING.some(q => q[0] === p[0] && q[1] === p[1])) RING.push(p);
  }

  function px(x, y, col, w, h) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }

  function drawSky() {
    for (const s of stars) {
      const v = Math.sin(time * 1.6 + s.p);
      if (v > 0.6) {
        px(s.x, s.y, '#fff6cc');
        if (s.big && v > 0.85) { px(s.x - 1, s.y, '#8a80c0'); px(s.x + 1, s.y, '#8a80c0'); px(s.x, s.y - 1, '#8a80c0'); px(s.x, s.y + 1, '#8a80c0'); }
      }
    }
    drawEventSky();
    clouds.forEach(c => ctx.drawImage(c.c, Math.round(c.x), c.y));
    for (const b of bats) ctx.drawImage(getSprite(Math.floor(b.p * 8) % 2 ? 'bat1' : 'bat2'), Math.round(b.x), Math.round(b.y));
  }

  function drawSignBulbs() {
    for (let i = 0; i < 15; i++) {
      const on = (i + Math.floor(time * 4)) % 3 === 0;
      px(177 + i * 4, 8, on ? '#fff3a6' : '#7a4a10');
      px(177 + i * 4, 20, on ? '#7a4a10' : '#fff3a6');
    }
  }

  // interior escuro visto pelas aberturas (desenhado antes do que está dentro da casa)
  function drawHouseInterior() {
    px(MOUTH_X0, MOUTH_TOP, '#07050d', MOUTH_X1 - MOUTH_X0 + 1, HB - MOUTH_TOP);
    // língua: o trem sai por cima dela
    if (mouth > 0.25) { px(MOUTH_X0 + 3, HB - 4, '#b8283a', MOUTH_X1 - MOUTH_X0 - 5, 4); px(MOUTH_X0 + 3, HB - 4, '#e0303c', MOUTH_X1 - MOUTH_X0 - 5, 1); }
    for (const [x, y, h] of house.holes) px(x, y, '#0b0814', 1, h);
  }

  function drawHouse() {
    ctx.drawImage(house.c, 0, 0);
    // boca: a parede fecha a abertura até a altura atual
    const h = 5 + Math.round(13 * mouth), top = HB - h;
    if (top > MOUTH_TOP) {
      px(MOUTH_X0, MOUTH_TOP, '#2a2140', MOUTH_X1 - MOUTH_X0 + 1, top - MOUTH_TOP);
      for (let x = HX0 + 3; x < HX1; x += 4) if (x >= MOUTH_X0 && x <= MOUTH_X1) px(x, MOUTH_TOP, '#221a35', 1, top - MOUTH_TOP);
    }
    px(MOUTH_X0 - 1, top - 1, '#1b1024', MOUTH_X1 - MOUTH_X0 + 3, 1);
    px(MOUTH_X0 - 1, top, '#1b1024', 1, h);
    px(MOUTH_X1 + 1, top, '#1b1024', 1, h);
    for (let x = MOUTH_X0 + 1; x < MOUTH_X1 - 1; x += 4) { px(x, top, '#f2f0f7', 3, 1); px(x + 1, top + 1, '#f2f0f7'); }
    px(MOUTH_X0, HB - 3, '#f2f0f7', 1, 3); px(MOUTH_X1, HB - 3, '#f2f0f7', 1, 3);
    // brilho das janelas
    ctx.globalAlpha = 0.35;
    ctx.drawImage(GLOW_Y, 244 - 9, 39 - 9);
    ctx.drawImage(GLOW_Y, 283 - 9, 39 - 9);
    ctx.globalAlpha = 0.25 + Math.sin(time * 2.3) * 0.08;
    ctx.drawImage(GLOW_O, 264 - 11, 23 - 11);
    ctx.globalAlpha = 1;
    // olhos seguem o mouse (ou o primeiro da fila)
    const target = mouse || (queue[0] ? { x: queue[0].x, y: queue[0].y } : { x: 264, y: 80 });
    const lx = clamp(Math.round((target.x - 264) / 50), -2, 2);
    const ly = clamp(Math.round((target.y - 39) / 40), -1, 1);
    for (const wx of [240, 279]) {
      px(wx + 3 + lx, 38 + ly, '#1b1024', 3, 3);
      if (blink > 0) px(wx, 36, '#2a2140', 9, 7);
    }
    // lanternas
    for (const lx2 of [245, 280]) {
      const f = 0.5 + Math.sin(time * 9 + lx2) * 0.15 + Math.random() * 0.1;
      ctx.globalAlpha = f;
      ctx.drawImage(GLOW_SM, lx2 + 1 - 5, 49 - 5);
      ctx.globalAlpha = 1;
      px(lx2 + 1, 48, Math.random() < 0.85 ? '#ffd23f' : '#ff8a1f', 1, 3);
    }
  }

  function drawPumpkins() {
    pumpkins.forEach(([x, y], i) => {
      const f = 0.22 + Math.sin(time * 7 + i * 2) * 0.06 + Math.random() * 0.05;
      ctx.globalAlpha = f;
      ctx.drawImage(GLOW_O, x - 11, y - 15);
      ctx.globalAlpha = 1;
      ctx.drawImage(SHADOW_SM, x - 3, y - 2);
      const s = getSprite(Math.sin(time * 11 + i * 3) > 0.3 ? 'pumpkin2' : 'pumpkin');
      ctx.drawImage(s, x - 4, y - 8);
    });
  }

  function drawSlotsGround() {
    for (const s of SLOTS) {
      const hov = hover === s.i;
      // vaga à venda: plaquinha de madeira com "$" (clique para comprar)
      if (!Game.ownsSlot(s.i)) {
        const bob = Math.round(Math.sin(time * 2 + s.i) * 0.6);
        px(s.x, s.y - 6, '#3a2414', 1, 7);
        px(s.x - 5, s.y - 14 + bob, hov ? '#ffffff' : '#1b1024', 11, 8);
        px(s.x - 4, s.y - 13 + bob, '#8a5a33', 9, 6);
        px(s.x - 4, s.y - 13 + bob, '#a8703f', 9, 1);
        ctx.drawImage(textCanvas('$', '#ffd23f', '#3a2414'), s.x - 1, s.y - 13 + bob);
        continue;
      }
      const m = slotMonster(s.i);
      const col = hov ? '#ffffff' : m ? RAR[m.rarity].color : '#4a4662';
      const off = Math.floor(time * 8);
      RING.forEach((p, k) => { if ((k + off) % 6 < (m ? 4 : 2)) px(s.x + p[0], s.y + p[1], col); });
      if (!m && Math.sin(time * 4 + s.i) > -0.2) { px(s.x - 2, s.y - 6, '#8b87a6', 5, 1); px(s.x, s.y - 8, '#8b87a6', 1, 5); }
    }
  }

  function drawMonster(m, slot) {
    const rar = RAR[m.rarity];
    const a = anim(m.id);
    const scaring = a.t < 0.7;
    const mon = monOf(m);
    if (mon.key === 'samara') { drawSamara(m, slot, a, scaring); return; }
    let name = mon.key + (scaring ? '_s' : '');
    // Coringa: de tempos em tempos solta uma gargalhada (sem som): chacoalha e sobe "HA HA"
    const laughing = mon.key === 'joker' && !scaring && (time + slot.i * 1.3) % 6 < 1.4;
    if (laughing) {
      if (Math.floor(time * 7) % 2) name = 'joker_l';
      if (a.ha === undefined || time - a.ha > 0.45) { a.ha = time; floatText(slot.x + rand(-4, 4), slot.y - 20, pick(['HA', 'HA HA', 'HE']), pick(['#7cc85a', '#b86bff']), 0.9); }
    }
    const spr = getSprite(name);
    let bob = mon.float ? Math.round(Math.sin(time * 2.2 + slot.i) * 1.5) - 1 : (Math.floor(time * 1.5 + slot.i) % 2 ? 0 : -1);
    let sx = 0, jump = 0;
    if (scaring) {
      jump = -Math.round(Math.sin(Math.min(1, a.t / 0.35) * Math.PI) * 4);
      if (a.t < 0.3) sx = Math.floor(a.t * 30) % 2 ? 1 : -1;
    }
    if (laughing) { sx = Math.floor(time * 14) % 2 ? 1 : 0; bob -= Math.floor(time * 7) % 2; }
    ctx.drawImage(SHADOW, slot.x - 7, slot.y - 2);
    // pés na vaga, centralizado (o Vader centra pelo corpo, não pelo sabre)
    const cx = SPRITE_CX[mon.key] !== undefined ? SPRITE_CX[mon.key] : spr.width >> 1;
    const x = slot.x - cx + sx, y = slot.y - spr.height + bob + jump;
    if (mon.key === 'herobrine') drawGlitch(spr, x, y, slot);
    else ctx.drawImage(spr, x, y);
    if (a.t < 0.08) {
      const k = name + '|white';
      ctx.drawImage(_sprCache[k] || (_sprCache[k] = silhouette(spr, '#ffffff')), x, y);
    }
    if (m.rarity === 'lendario' || m.rarity === 'epico') sparkles(slot.x, slot.y - 2, rar.color);
  }

  // Herobrine falhando: fatias deslocadas, sombra ciano/vermelha e uns sumiços rápidos
  const GLITCH_CYAN = {}, GLITCH_RED = {};
  function drawGlitch(spr, x, y, slot) {
    const burst = (time * 0.7 + slot.i * 0.37) % 4 < 0.5;   // rajada de falha a cada ~6s
    if (burst && Math.random() < 0.15) return;               // pisca e some
    if (!burst && Math.random() > 0.05) {
      ctx.drawImage(spr, x, y);
    } else {
      const jx = burst ? Math.round(rand(-3, 3)) : 0;
      const kc = spr.width + 'x' + spr.height;
      const cyan = GLITCH_CYAN[kc] || (GLITCH_CYAN[kc] = silhouette(spr, '#5ff5ff'));
      const red = GLITCH_RED[kc] || (GLITCH_RED[kc] = silhouette(spr, '#e0303c'));
      ctx.globalAlpha = 0.55;
      ctx.drawImage(cyan, x + jx - 2, y);
      ctx.drawImage(red, x + jx + 2, y);
      ctx.globalAlpha = 1;
      for (let row = 0; row < spr.height; row += 2) {
        const off = Math.random() < 0.4 ? Math.round(rand(-3, 3)) : 0;
        ctx.drawImage(spr, 0, row, spr.width, 2, x + jx + off, y + row, spr.width, 2);
      }
    }
    // olhos brancos brilhando
    if (Math.sin(time * 5 + slot.i) > 0) { px(x + 5, y + 5, '#ffffff', 2, 1); px(x + 9, y + 5, '#ffffff', 2, 1); }
  }

  // Samara mora num poço: de tempos em tempos o corpinho sobe, fica um pouco e afunda de novo.
  // No susto ela sai inteira na hora.
  function drawSamara(m, slot, a, scaring) {
    const well = getSprite('well');
    const wx = slot.x - (well.width >> 1), wy = slot.y - well.height;
    const c = (time + slot.i * 2.1) % 9;
    let rise = c < 3 ? 0 : c < 4.5 ? (c - 3) / 1.5 : c < 7 ? 1 : c < 8.5 ? 1 - (c - 7) / 1.5 : 0;
    if (scaring) rise = 1;
    a.out = rise;
    ctx.drawImage(SHADOW, slot.x - 7, slot.y - 2);
    const spr = getSprite('samara' + (scaring ? '_s' : ''));
    const mouth = wy + 3;                                    // linha da boca do poço
    if (a.out > 0.02) {
      const sway = Math.round(Math.sin(time * 2) * (a.out > 0.9 ? 1 : 0));
      const top = mouth - Math.round(a.out * (spr.height - 2));
      ctx.save();
      ctx.beginPath(); ctx.rect(slot.x - 12, top - 2, 24, mouth - top + 2); ctx.clip();
      ctx.drawImage(spr, slot.x - (spr.width >> 1) + sway, top);
      ctx.restore();
    }
    ctx.drawImage(well, wx, wy);
    // mãos agarrando a borda quando ela está fora
    if (a.out > 0.6) { px(slot.x - 6, mouth - 1, '#e4e2f5', 2, 1); px(slot.x + 4, mouth - 1, '#e4e2f5', 2, 1); }
    if (a.t < 0.08 && a.out > 0.5) {
      const k = spr.width + 'samara|white';
      ctx.globalAlpha = 0.7;
      ctx.drawImage(_sprCache[k] || (_sprCache[k] = silhouette(spr, '#ffffff')), slot.x - (spr.width >> 1), mouth - spr.height + 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawLabel(m, slot) {
    const rar = RAR[m.rarity];
    const txt = monOf(m).short + (m.level > 1 ? ' +' + (m.level - 1) : '');
    const tw = txt.length * 4 - 1;
    const bx = slot.x - Math.ceil(tw / 2) - 2, by = slot.y + 4;
    px(bx, by, rar.color, tw + 4, 9);
    px(bx + 1, by + 1, '#0d0a17', tw + 2, 7);
    drawText(ctx, txt, bx + 2, by + 2, '#f2f0f7', 'left', null);
    // classe: tirinha da cor da classe; bônus ativo aparece embaixo do nome
    if (Lab.picks.classRule !== 'off') {
      const c = Lab.classOf(m), b = Lab.buffOf(m);
      px(bx, by + 8, c.color, tw + 4, 1);
      if (b && b.classAdd > 0) drawText(ctx, '+' + Math.round(b.classAdd * 100) + '%', slot.x, by + 11, c.color, 'center');
    }
  }

  // bonecos da mesma classe se ajudando: linha tracejada andando entre eles
  function drawLinks() {
    for (const [a, b, col] of Lab.buffs().links) {
      const A = SLOTS[a], B = SLOTS[b];
      if (!A || !B) continue;
      const n = Math.floor(Math.hypot(B.x - A.x, B.y - A.y) / 3);
      for (let k = 1; k < n; k++) {
        if ((k + Math.floor(time * 6)) % 3) continue;
        px(lerp(A.x, B.x, k / n), lerp(A.y - 6, B.y - 6, k / n), col);
      }
    }
  }

  // ---------------- enfeites ----------------
  function drawItem(key, x, y, n, small) {
    const it = LAB_ITEMS[key], spr = getSprite(Lab.lookSprite(key));
    const bob = Math.round(Math.sin(time * 1.6 + n * 1.7) * (key === 'aranha' ? 1.5 : 0.6));
    if (it.calm) {
      ctx.globalAlpha = 0.28 + Math.sin(time * 2 + n) * 0.08;
      ctx.drawImage(GLOW_C, x - 5, y - 13);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(SHADOW, x - 7, y - 2);
    if (small) ctx.drawImage(spr, x - 6, y - 12 + bob, 12, 12);
    else ctx.drawImage(spr, x - 8, y - 16 + bob);
  }
  function drawLotsGround() {
    if (Lab.picks.decor !== 'lots') return;
    const used = Lab.st().decor.lots;
    for (const l of LOTS) {
      const hov = hoverLot === l.i;
      if (hov) {
        for (let a = 0; a < 80; a++) if ((a + Math.floor(time * 10)) % 4 < 2) px(l.x + Math.cos(a / 80 * Math.PI * 2) * LAB_LOT_RADIUS, l.y - 2 + Math.sin(a / 80 * Math.PI * 2) * LAB_LOT_RADIUS / 1.3, '#ffd23f');
      }
      if (used[l.i]) continue;
      const col = hov ? '#ffffff' : '#7cc85a';
      RING.forEach((p, k) => { if (k % 3 === 0) px(l.x + p[0] * 0.7, l.y + p[1] * 0.7, col); });
      if (Math.sin(time * 3 + l.i) > -0.3) { px(l.x - 2, l.y - 5, col, 5, 1); px(l.x, l.y - 7, col, 1, 5); }
    }
  }

  // ---------------- manutenção ----------------
  function gauge(x, y, w01, width) {
    const col = w01 > 0.7 ? '#e0303c' : w01 > 0.4 ? '#ff8a1f' : '#5ee07a';
    px(x, y, '#05030a', width + 2, 4);
    px(x + 1, y + 1, col, Math.max(1, Math.round(width * (1 - w01))), 2);
  }
  function drawProp() {
    const o = Lab.picks.maint;
    if (!PROP || !(o === 'oil' || o === 'coal' || o === 'pact')) return;
    const w = Lab.wear(), hot = o === 'pact' ? Lab.pactReady() : w > 0.5;
    ctx.drawImage(SHADOW, PROP.x - 7, PROP.y - 2);
    ctx.drawImage(getSprite('lab_' + o), PROP.x - 8, PROP.y - 16);
    gauge(PROP.x - 9, PROP.y - 22, w, 16);
    if (hot && Math.floor(time * 3) % 2) drawText(ctx, '!', PROP.x, PROP.y - 30, '#e0303c', 'center');
  }
  function drawBattery(m, s) {
    const b = Lab.battery(m);
    if (b > 0.6) return;
    const low = b < LAB_BAT_LOW;
    const x = s.x + 8, y = s.y - 22;
    if (low && Math.floor(time * 4) % 2 === 0) px(x - 1, y - 1, '#ffffff', 12, 7);
    px(x, y, '#05030a', 9, 5); px(x + 9, y + 1, '#05030a', 1, 3);
    px(x + 1, y + 1, '#2a2045', 7, 3);
    if (b > 0) px(x + 1, y + 1, b > 0.4 ? '#5ee07a' : low ? '#e0303c' : '#ffb52e', Math.max(1, Math.round(7 * b)), 3);
  }

  function drawCar(t, k) {
    const p = track.at(t.s - k * CAR_GAP);
    const x = Math.round(p.x) - 6, y = Math.round(p.y) - 5;
    for (let j = 0; j < 2; j++) {
      const r = t.seats[k * 2 + j];
      if (!r || r.state !== 'ride') continue;
      const sc = r.scaredT > 0;
      const jump = r.scaredT > 0.95 ? -2 : r.scaredT > 0.7 ? -1 : 0;
      ctx.drawImage(sc ? r.spr.s : r.spr.w1, 0, 0, 7, 6, x + j * 6, y - 5 + jump, 7, 6);
      // salvo pelos paramédicos: choque piscando em cima do visitante
      if (r.zapT > 0) { if (Math.floor(r.zapT * 12) % 2) ctx.drawImage(getSprite('bolt'), x + j * 6 - 1, y - 15 + jump); }
      else if (r.scaredT > 0.8) drawText(ctx, '!', x + j * 6 + 2, y - 12 + jump, '#e0303c');
    }
    ctx.drawImage(getSprite('cart', TRAIN_COLORS[t.color], 'cart' + t.color), x, y);
    // manutenção VÔMITO: quanto mais sujo, mais manchas verdes
    const d = Lab.dirt(t.color);
    if (d > 0.15) {
      px(x + 2, y + 1, '#7cc85a', 2, 1);
      if (d > 0.4) px(x + 8, y + 2, '#a8d84a', 2, 2);
      if (d > 0.65) { px(x + 5, y + 3, '#7cc85a', 3, 1); px(x + 3, y + 4, '#a8d84a', 1, 2); }
      if (d > 0.85 && Math.floor(time * 3) % 2) drawText(ctx, '!', x + 6, y - 13, '#7cc85a', 'center');
    }
  }

  function drawNPC(n) {
    if (n.state === 'down') {
      const x = Math.round(n.x), y = Math.round(n.y);
      ctx.drawImage(SHADOW, x - 7, y - 1);
      ctx.drawImage(n.spr.d, x - 5, y - 6);
      if (Math.floor(time * 3) % 2) ctx.drawImage(getSprite(n.medevac ? 'bolt' : 'skull'), x - 2, y - 12);
      return;
    }
    ctx.drawImage(SHADOW_SM, Math.round(n.x) - 3, Math.round(n.y) - 1);
    const scared = n.state === 'exit' || n.scaredT > 0;
    const step = Math.floor(n.phase * 8) % 2;
    const spr = scared ? n.spr.s : n.moving && step ? n.spr.w2 : n.spr.w1;
    const bob = n.moving && step ? -1 : 0;
    const x = Math.round(n.x) - 3, y = Math.round(n.y) - 10 + bob;
    ctx.drawImage(spr, x, y);
    if (n.state === 'exit') {
      if (n.exitT < 0.8) drawText(ctx, '!', x + 2, y - 7, '#ffd23f');
      else if (Math.floor(time * 4) % 2) px(x + 7, y + 1, '#7fd0ff');
    }
  }

  // alma do visitante que morreu subindo e sumindo
  const SOUL = ['.www.', 'wwwww', 'wkwkw', 'wwwww', 'w.w.w'];
  function drawSoul(s) {
    ctx.globalAlpha = Math.max(0, 1 - s.t / 2.4) * 0.85;
    const x = Math.round(s.x - 2 + Math.sin(s.t * 5) * 1.5), y = Math.round(s.y - s.t * 14);
    SOUL.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] !== '.') px(x + i, y + j, row[i] === 'w' ? '#e4e2f5' : '#1b1024'); });
    ctx.globalAlpha = 1;
  }

  const byY = (a, b) => a.y - b.y;
  function render() {
    ctx.save();
    if (camT > 0) { const k = 1 + (camK - 1) * ease(camT); ctx.translate(VW * (1 - k), 0); ctx.scale(k, k); }
    if (shake > 0) ctx.translate(0, Math.floor(shake * 40) % 2);
    ctx.translate(-VX0, 0);
    ctx.drawImage(bg, VX0, 0);
    if (Lab.picks.maint === 'oil') {
      ctx.globalAlpha = Math.min(1, Lab.wear() * 1.2);
      ctx.drawImage(rustLayer(), VX0, 0);
      ctx.globalAlpha = 1;
    }
    drawSky();
    ctx.drawImage(sign, 0, 0);
    drawSignBulbs();

    // o que está dentro da casa é desenhado antes das paredes: só aparece pela boca,
    // pelo arco do trem e pela porta
    const inside = [], outside = [];
    for (const t of trains) for (let k = 0; k < CARS; k++) {
      const p = track.at(t.s - k * CAR_GAP);
      (insideHouse(p.x, p.y) ? inside : outside).push({ y: p.y + 2, f: () => drawCar(t, k) });
    }
    for (const n of npcs) (insideHouse(n.x, n.y) ? inside : outside).push({ y: n.y, f: () => drawNPC(n) });
    for (const w of wolves) outside.push({ y: w.y, f: () => drawWolf(w) });
    drawHouseInterior();
    inside.sort(byY).forEach(it => it.f());
    drawHouse();
    drawPumpkins();
    drawSlotsGround();
    drawLotsGround();
    drawLinks();

    for (const s of SLOTS) {
      const m = slotMonster(s.i);
      if (!m) continue;
      // boneco sem bateria fica apagado
      outside.push({ y: s.y, f: () => { ctx.globalAlpha = Lab.canScare(m) ? 1 : 0.4; drawMonster(m, s); ctx.globalAlpha = 1; } });
    }
    const dec = Lab.picks.decor, st = Lab.st().decor;
    if (dec === 'lots') for (const l of LOTS) if (st.lots[l.i]) outside.push({ y: l.y, f: () => drawItem(st.lots[l.i], l.x, l.y, l.i) });
    if (dec === 'global') st.global.forEach((k, n) => { const g = GSPOTS[n]; if (g) outside.push({ y: g.y, f: () => drawItem(k, g.x, g.y, n) }); });
    if (dec === 'acc') for (const s of SLOTS) if (st.acc[s.i] && slotMonster(s.i)) outside.push({ y: s.y + 1, f: () => drawItem(st.acc[s.i], s.x - 15, s.y + 2, s.i, true) });
    outside.sort(byY).forEach(it => it.f());

    for (const s of SLOTS) {
      const m = slotMonster(s.i);
      if (!m) continue;
      drawLabel(m, s);
      if (Lab.picks.maint === 'battery') drawBattery(m, s);
    }
    drawProp();

    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      px(p.x, p.y, p.color);
    }
    ctx.globalAlpha = 1;
    souls.forEach(drawSoul);
    drawGoodies();
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, (t.life - t.t) / (t.life * 0.35));
      drawText(ctx, t.text, t.x, t.y - t.t * 14, t.color, 'center');
    }
    ctx.globalAlpha = 1;

    for (const f of fireflies) {
      f.p += 0.016 * f.sp;
      const x = f.x + Math.sin(f.p * 2.3) * 14, y = f.y + Math.cos(f.p * 1.7) * 8;
      const a = 0.5 + Math.sin(f.p * 9) * 0.5;
      ctx.globalAlpha = a * 0.35; ctx.drawImage(GLOW_G, Math.round(x) - 3, Math.round(y) - 3);
      ctx.globalAlpha = a; px(x, y, '#d8ff9a');
    }
    drawEventTint();
    ctx.globalAlpha = 0.07;
    const fo = (time * 4) % (W * 2);
    for (let fx = VX0 - fo; fx < W; fx += W * 2) ctx.drawImage(fog, fx, VH - 70);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(vignette, VX0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------------- loop ----------------
  // A simulação anda pelo relógio, não pelos quadros: se o navegador para de desenhar
  // (aba ou janela em segundo plano), um timer continua avançando o parque em passos de 50ms.
  // Buracos grandes (aba congelada, computador dormindo) viram ganho offline via onGap.
  const GAP_SECS = 30;
  let last = performance.now(), afterRender = null, onGapCb = null;
  function advance() {
    const now = performance.now();
    let left = (now - last) / 1000;
    if (left <= 0) return;
    last = now;
    if (left > GAP_SECS) { if (onGapCb) onGapCb(left); left = 0.05; }
    while (left > 1e-4) { const dt = Math.min(0.05, left); update(dt); left -= dt; }
  }
  function frame(now) {
    advance();
    render();
    if (afterRender) afterRender(now);
    requestAnimationFrame(frame);
  }
  setInterval(() => { if (performance.now() - last > 200) advance(); }, 250);

  function fit(availW, availH) {
    let s = Math.min(availW / VW, availH / VH);
    s = s >= 4 ? Math.floor(s) : Math.max(VW > W ? 0.5 : 1, Math.floor(s * 4) / 4);
    cv.style.width = VW * s + 'px';
    cv.style.height = VH * s + 'px';
  }

  return {
    start() {
      setTrack(Game.s.trackSeed);
      initTrains();
      const m = location.hash.match(/sim=(\d+)/);
      if (m) for (let i = 0; i < +m[1] * 30; i++) update(1 / 30);
      requestAnimationFrame(frame);
    },
    reset() { setTrack(Game.s.trackSeed); initTrains(); npcs = []; queue.length = 0; window.dispatchEvent(new Event('resize')); },
    // refaz trilho e cenário (expansão comprada ou opção trocada na aba TESTE)
    rebuild() {
      const old = VW;
      setTrack(Game.s.trackSeed);
      initTrains();
      if (VW > old) { camK = VW / old; camT = 1; }
      window.dispatchEvent(new Event('resize'));
    },
    fit,
    canvas: cv,
    get viewW() { return VW; },
    get LOTS() { return LOTS; },
    onLot(cb) { onLotCb = cb; },
    onSlot(cb) { onSlotCb = cb; },
    onHover(cb) { onHoverCb = cb; },
    // chamado depois de cada quadro (os filtros usam para copiar a imagem)
    onFrame(cb) { afterRender = cb; },
    // chamado quando a página ficou parada mais de GAP_SECS segundos
    onGap(cb) { onGapCb = cb; },
    get SLOTS() { return SLOTS; },
    // área do mapa (em pixels do jogo) que o tutorial destaca: o carrinho andando ou o primeiro boneco
    spot(kind) {
      if (kind === 'train') {
        const t = trains.find(q => q.state === 'moving') || trains[0];
        if (!t) return null;
        const a = track.at(t.s), b = track.at(t.s - (CARS - 1) * CAR_GAP);
        const x0 = Math.min(a.x, b.x) - 10, y0 = Math.min(a.y, b.y) - 16, x1 = Math.max(a.x, b.x) + 10, y1 = Math.max(a.y, b.y) + 8;
        return { x: x0 - VX0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      // monster = primeiro boneco na pista; slot = primeira vaga à venda; free = vaga comprada e vazia
      const pickSlot = { monster: i => Game.monsterAt(i), slot: i => !Game.ownsSlot(i), free: i => Game.ownsSlot(i) && !Game.monsterAt(i) }[kind];
      if (!pickSlot) return null;
      const slot = Game.slotOrder.map(i => SLOTS[i]).find(sl => sl && pickSlot(sl.i));
      return slot ? { x: slot.x - 13 - VX0, y: slot.y - 32, w: 26, h: 36 } : null;
    },
  };
})();
