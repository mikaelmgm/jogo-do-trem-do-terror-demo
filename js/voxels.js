'use strict';
// ============================================================
//  BONECOS EM VOXEL — modelos 3D de verdade para o jogo em 3D.
//  Cada boneco é montado aqui, bloco a bloco. Dois estilos no mesmo padrão:
//  A = "Cabeção" (cabeça grande, corpo curto, blocos maiores)
//  B = "Esguio"  (proporção alta, blocos menores, mais detalhe)
//  Quem não está nesta lista continua usando o desenho 2D com volume.
// ============================================================

class VoxGrid {
  constructor() { this.m = new Map(); }
  key(x, y, z) { return (x + 512) + (y + 512) * 1024 + (z + 512) * 1048576; }
  set(x, y, z, c) { this.m.set(this.key(x, y, z), { x, y, z, c }); }
  get(x, y, z) { return this.m.get(this.key(x, y, z)); }
  del(x, y, z) { this.m.delete(this.key(x, y, z)); }
  // caixa de limites inclusivos; c pode ser uma cor ou (x, y, z) => cor
  box(x0, x1, y0, y1, z0, z1, c) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
  }
  // caixa com as quinas verticais e horizontais comidas
  rbox(x0, x1, y0, y1, z0, z1, c) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const ex = x === x0 || x === x1, ey = y === y0 || y === y1, ez = z === z0 || z === z1;
      if (ex + ey + ez >= 2) continue;
      this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
  }
  ball(cx, cy, cz, rx, ry, rz, c) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
  }
  cut(x0, x1, y0, y1, z0, z1) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.del(x, y, z);
  }
  // pinta o bloco mais à frente de cada coluna (rostos, botões, manchas)
  decal(x0, x1, y0, y1, c) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      for (let z = 40; z >= -40; z--) if (this.get(x, y, z)) { this.set(x, y, z, c); break; }
    }
  }
  sym(fn) { fn(1); fn(-1); }
}

// junta faces iguais em retângulos: um boneco inteiro vira poucas centenas de triângulos
function meshVoxGrid(v, unit) {
  const cells = [...v.m.values()], min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (const c of cells) { [c.x, c.y, c.z].forEach((p, i) => { min[i] = Math.min(min[i], p); max[i] = Math.max(max[i], p); }); }
  const minY = min[1], quads = [];
  const at = (p) => v.get(p[0], p[1], p[2]);
  for (let d = 0; d < 3; d++) for (const s of [1, -1]) {
    const u = (d + 1) % 3, w = (d + 2) % 3, nu = max[u] - min[u] + 1, nw = max[w] - min[w] + 1;
    for (let q = min[d]; q <= max[d]; q++) {
      const mask = new Array(nu * nw).fill(null);
      for (let a = 0; a < nu; a++) for (let b = 0; b < nw; b++) {
        const p = [0, 0, 0]; p[d] = q; p[u] = min[u] + a; p[w] = min[w] + b;
        const cell = at(p);
        if (!cell) continue;
        const n = p.slice(); n[d] += s;
        if (!at(n)) mask[a + b * nu] = cell.c;
      }
      for (let b = 0; b < nw; b++) for (let a = 0; a < nu;) {
        const c = mask[a + b * nu];
        if (!c) { a++; continue; }
        let wi = 1;
        while (a + wi < nu && mask[a + wi + b * nu] === c) wi++;
        let he = 1;
        grow: for (; b + he < nw; he++) for (let k = 0; k < wi; k++) if (mask[a + k + (b + he) * nu] !== c) break grow;
        for (let j = 0; j < he; j++) for (let k = 0; k < wi; k++) mask[a + k + (b + j) * nu] = null;
        const corner = (ua, wa) => {
          const p = [0, 0, 0];
          p[d] = q + (s > 0 ? 0.5 : -0.5); p[u] = min[u] + ua - 0.5; p[w] = min[w] + wa - 0.5;
          return [p[0] * unit, (p[1] + 0.5 - minY) * unit, p[2] * unit];
        };
        const A = corner(a, b), B = corner(a + wi, b), C = corner(a + wi, b + he), D = corner(a, b + he);
        const nrm = [0, 0, 0]; nrm[d] = s;
        quads.push({ pts: s > 0 ? [A, B, C, A, C, D] : [A, C, B, A, D, C], n: nrm, c });
        a += wi;
      }
    }
  }
  return quads;
}

// ---------------- estilo A: Cabeção ----------------
function modelGhost(v, scared) {
  const W = '#eceaf7', G = '#c9c6e0', K = '#1b1024';
  for (let y = 0; y <= 21; y++) {
    const r = y > 12 ? Math.sqrt(Math.max(0, 1 - ((y - 12) / 10) ** 2)) * 8.5 : 8.5 + (12 - y) * 0.13;
    for (let x = -11; x <= 11; x++) for (let z = -11; z <= 11; z++) {
      if (Math.hypot(x, z * 1.05) > r) continue;
      if (y < 4 && Math.sin(Math.atan2(z, x) * 5) + (y - 2) * 0.6 < -0.2) continue;
      v.set(x, y, z, y < 6 ? G : W);
    }
  }
  v.sym((s) => {
    if (scared) { v.box(s * 8, s * 11, 12, 14, -1, 1, W); v.box(s * 11, s * 13, 14, 19, -1, 1, W); }
    else { v.box(s * 8, s * 11, 8, 10, -1, 1, W); v.box(s * 11, s * 12, 6, 8, -1, 1, G); }
    if (scared) { v.decal(s > 0 ? 2 : -4, s > 0 ? 4 : -2, 12, 17, K); v.decal(s * 3, s * 3, 14, 15, '#e0303c'); }
    else { v.decal(s > 0 ? 2 : -4, s > 0 ? 4 : -2, 13, 16, K); v.decal(s > 0 ? 2 : -4, s > 0 ? 2 : -4, 16, 16, '#ffffff'); v.decal(s > 0 ? 5 : -6, s > 0 ? 6 : -5, 11, 11, '#f3a6c0'); }
  });
  if (scared) { v.decal(-3, 3, 5, 10, K); v.decal(-2, 2, 5, 7, '#7a1420'); } else v.decal(-1, 1, 9, 10, K);
}

function modelZombie(v, scared) {
  const S = '#8cc43c', D = '#55801f', P = '#3a4a7a', T = '#6a5a3a', K = '#1b1024';
  v.sym((s) => {
    v.box(s * 2, s * 4, 0, 1, -1, 2, '#2b1d1d');
    v.box(s * 2, s * 4, 2, 5, -1, 1, (x, y) => (y === 3 && x * s === 4 ? S : P));
  });
  v.rbox(-5, 5, 6, 12, -3, 3, (x, y) => ((x + y * 2) % 6 === 0 ? '#54462c' : T));
  v.decal(-3, -1, 7, 9, S); v.decal(2, 3, 9, 10, '#7a1420');
  v.rbox(-7, 7, 13, 24, -5, 5, (x, y, z) => (y < 15 && z < 2 ? D : S));
  v.box(-7, 6, 24, 25, -4, 3, (x) => (x % 3 === 0 ? '#2e3d24' : '#3a4a2a'));
  v.ball(4, 23, 2, 3, 2, 3, '#e8a08a');
  v.decal(-5, -2, 18, 21, '#f2f0f7'); v.decal(-4, -3, 19, 20, scared ? '#e0303c' : K);
  v.decal(2, 5, 18, 21, '#2b3a18'); v.box(3, 4, 15, 17, 6, 6, '#f2f0f7'); v.set(3, 15, 7, K); v.set(4, 15, 7, K);
  if (scared) { v.decal(-5, 3, 13, 16, K); v.decal(-3, 1, 13, 14, '#7a1420'); for (let x = -5; x <= 3; x += 2) v.decal(x, x, 16, 16, '#f2f0f7'); }
  else { v.decal(-5, 3, 15, 15, K); for (let x = -5; x <= 3; x += 2) v.decal(x, x, 15, 15, '#f2f0f7'); }
  v.sym((s) => {
    if (scared) { v.box(s * 6, s * 8, 11, 13, -1, 1, T); v.box(s * 8, s * 9, 13, 21, -1, 1, T); v.box(s * 8, s * 10, 22, 24, -1, 1, S); }
    else { v.box(s * 6, s * 7, 9, 11, 0, 7, T); v.box(s * 6, s * 7, 9, 11, 8, 11, S); v.box(s * 6, s * 7, 8, 8, 10, 11, D); }
  });
}

function modelMummy(v, scared) {
  const L = '#d9c9a0', D = '#a8946a';
  const wrap = (x, y) => ((y * 2 + x + 40) % 7 < 2 ? D : L);
  v.sym((s) => v.box(s * 2, s * 4, 0, 5, -1, 1, wrap));
  v.rbox(-5, 5, 6, 12, -3, 3, wrap);
  v.rbox(-7, 7, 13, 24, -5, 5, wrap);
  v.decal(-5, 5, 18, 20, '#1b1024');
  v.sym((s) => { v.decal(s > 0 ? 2 : -4, s > 0 ? 4 : -2, 19, 19, scared ? '#e0303c' : '#ffd23f'); });
  if (scared) v.decal(-3, 3, 14, 16, '#1b1024');
  v.box(5, 7, 1, 8, -4, -4, D); v.box(6, 7, 0, 2, -5, -5, L);
  v.sym((s) => {
    if (scared) { v.box(s * 6, s * 7, 10, 12, -1, 1, wrap); v.box(s * 7, s * 8, 12, 22, -1, 1, wrap); }
    else v.box(s * 6, s * 7, 9, 11, 0, 11, wrap);
  });
  v.box(-6, -6, 3, 9, 11, 11, L);
}

function modelSaci(v, scared) {
  const S = '#6b3f22', D = '#55301a', R = '#e0303c', K = '#1b1024';
  // uma perna só, comprida, e o redemoinho no pé
  v.box(-1, 1, 0, 1, -1, 3, S); v.box(-1, 1, 2, 12, -1, 1, S);
  v.rbox(-4, 4, 13, 16, -3, 3, R);
  v.rbox(-4, 4, 17, 25, -2, 2, S);
  v.decal(-4, 4, 17, 17, D);
  v.rbox(-4, 4, 26, 34, -4, 4, S);
  v.decal(-4, 4, 26, 26, D);
  v.sym((s) => {
    v.decal(s > 0 ? 1 : -2, s > 0 ? 2 : -1, 29, 31, '#f2f0f7');
    v.decal(s > 0 ? 1 : -2, s > 0 ? 1 : -2, 29, 30, scared ? '#e0303c' : K);
    if (scared) { v.box(s * 5, s * 6, 23, 25, -1, 1, S); v.box(s * 6, s * 7, 26, 34, -1, 1, S); }
    else v.box(s * 5, s * 6, 15, 25, -1, 1, S);
  });
  if (scared) v.decal(-1, 1, 27, 28, K); else v.decal(-1, 1, 27, 27, K);
  v.box(2, 2, 27, 27, 5, 9, '#8a5a33'); v.box(1, 3, 28, 30, 8, 10, '#5a3820'); v.set(2, 31, 9, '#ff8a1f');
  // gorro vermelho caindo para o lado
  v.box(-4, 4, 35, 36, -4, 4, R); v.box(-3, 3, 37, 38, -3, 3, R); v.box(-1, 3, 39, 40, -2, 2, R); v.box(3, 6, 38, 39, -1, 1, R); v.box(6, 7, 35, 37, -1, 1, R);
  v.box(-4, 4, 35, 35, -4, 4, '#7a1420');
  for (let a = 0; a < 6.28; a += 0.5) v.set(Math.round(Math.cos(a) * 7), 0, Math.round(Math.sin(a) * 7), '#8b87a6');
  for (let a = 0.25; a < 6.28; a += 0.8) v.set(Math.round(Math.cos(a) * 5), 3, Math.round(Math.sin(a) * 5), '#c3c0d6');
}

// ---------------- estilo B: Esguio ----------------
function modelWolf(v, scared) {
  const F = '#6a4a30', D = '#4a3220', C = '#b89a70', K = '#1b1024';
  const fur = (x, y) => ((x + y * 2 + 60) % 5 === 0 ? D : F);
  v.sym((s) => {
    v.box(s * 3, s * 7, 0, 2, -2, 4, fur); for (const x of [3, 5, 7]) v.set(s * x, 0, 5, '#f2f0f7');
    v.box(s * 4, s * 6, 3, 10, -3, -1, fur); v.box(s * 3, s * 7, 10, 16, -2, 2, fur);
  });
  v.rbox(-7, 7, 14, 17, -4, 4, (x, y) => (y % 2 ? '#5a4a7a' : '#4a3a68'));
  v.rbox(-8, 8, 18, 28, -5, 5, fur); v.rbox(-10, 10, 27, 31, -5, 4, fur);
  v.decal(-4, 4, 19, 28, C);
  v.box(-5, 5, 31, 39, -3, 5, fur); v.box(-3, 3, 31, 34, 6, 11, C); v.box(-2, 2, 33, 34, 10, 12, K);
  v.sym((s) => {
    v.box(s * 3, s * 5, 40, 42, -1, 1, fur); v.box(s * 4, s * 5, 43, 45, 0, 0, D);
    v.decal(s > 0 ? 2 : -3, s > 0 ? 3 : -2, 36, 37, scared ? '#e0303c' : '#ffd23f');
    if (scared) { v.box(s * 9, s * 12, 28, 31, -2, 2, fur); v.box(s * 11, s * 13, 32, 44, -2, 1, fur); for (const z of [-2, 0, 1]) v.set(s * 13, 45, z, '#f2f0f7'); }
    else { v.box(s * 10, s * 13, 14, 29, -2, 2, fur); v.box(s * 10, s * 13, 11, 13, -2, 3, D); for (const x of [10, 12, 13]) v.set(s * x, 10, 3, '#f2f0f7'); }
  });
  if (scared) { v.cut(-3, 3, 31, 32, 6, 12); v.box(-2, 2, 31, 31, 6, 9, '#7a1420'); v.box(-3, 3, 30, 30, 5, 10, C); for (let x = -3; x <= 3; x += 2) v.set(x, 31, 10, '#f2f0f7'); }
  else for (let x = -3; x <= 3; x += 2) v.set(x, 30, 11, '#f2f0f7');
  v.box(-2, 2, 16, 19, -11, -5, fur); v.box(-2, 2, 19, 25, -14, -11, D);
}

function modelVamp(v, scared) {
  const B = '#1b1430', R = '#b01c28', P = '#e4e2f5', K = '#07050d';
  v.sym((s) => { v.box(s * 2, s * 4, 2, 13, -2, 1, B); v.box(s * 2, s * 4, 0, 1, -2, 3, K); });
  v.rbox(-5, 5, 14, 25, -3, 3, B);
  v.decal(-2, 2, 17, 25, '#f2f0f7'); v.decal(-1, 1, 24, 25, R); v.decal(0, 0, 19, 19, '#ffd23f');
  v.rbox(-4, 4, 26, 34, -4, 4, P);
  v.box(-4, 4, 33, 35, -4, 4, K); v.box(-4, 4, 26, 35, -4, -4, K);
  v.decal(-4, -3, 31, 33, K); v.decal(3, 4, 31, 33, K); v.decal(-1, 1, 32, 33, K); v.decal(0, 0, 31, 31, K);
  v.sym((s) => {
    v.decal(s > 0 ? 1 : -2, s > 0 ? 2 : -1, 29, 29, scared ? '#ffd23f' : '#e0303c');
    v.decal(s > 0 ? 1 : -2, s > 0 ? 1 : -2, 26, 26, '#f2f0f7');
    v.box(s * 5, s * 7, 24, 33, -3, -1, (x, y, z) => (z === -1 ? R : B));
  });
  if (scared) v.decal(-2, 2, 27, 28, '#7a1420'); else v.decal(-1, 1, 27, 27, '#7a1420');
  const reach = scared ? 15 : 9;
  v.box(-reach, reach, scared ? 6 : 2, 27, -5, -4, (x, y, z) => (z === -4 ? R : B));
  v.sym((s) => {
    v.box(s * reach, s * (reach - 2), scared ? 6 : 2, 27, -3, -2, B);
    if (scared) { v.box(s * 6, s * 13, 23, 25, -2, 0, B); v.box(s * 13, s * 14, 26, 28, -2, 0, P); }
    else { v.box(s * 6, s * 7, 13, 24, -1, 1, B); v.box(s * 6, s * 7, 11, 12, -1, 1, P); }
  });
}

function modelStitched(v, scared) {
  const A = '#a8b890', E = '#c8b090', C = '#3b2a2a', K = '#1b1024';
  const skin = (x) => (x > 1 ? A : E);
  v.sym((s) => { v.box(s * 3, s * 8, 0, 4, -3, 4, '#2b1d1d'); v.box(s * 3, s * 7, 5, 13, -3, 2, '#3a3550'); });
  v.rbox(-9, 9, 14, 29, -5, 5, C);
  v.decal(-3, 3, 16, 29, skin); v.decal(1, 1, 16, 29, K);
  for (let y = 17; y <= 28; y += 3) { v.decal(0, 2, y, y, K); }
  v.rbox(-5, 5, 30, 40, -5, 5, skin);
  v.box(-5, 5, 40, 42, -5, 5, (x, y, z) => ((x * 3 + z * 5 + 50) % 4 === 0 && y === 42 ? '#2a2147' : K));
  v.decal(-5, 5, 39, 39, K);
  v.decal(1, 1, 30, 38, K); for (let y = 31; y <= 37; y += 2) v.decal(0, 2, y, y, K);
  v.decal(-4, -2, 34, 36, '#f2f0f7'); v.decal(-3, -3, 35, 35, scared ? '#e0303c' : K);
  v.decal(3, 4, 34, 36, '#ffd23f'); v.decal(3, 3, 35, 35, K);
  if (scared) { v.decal(-3, 3, 31, 33, K); v.decal(-2, 2, 31, 31, '#7a1420'); } else { v.decal(-4, 4, 32, 32, K); for (let x = -3; x <= 3; x += 2) v.decal(x, x, 31, 33, K); }
  v.sym((s) => {
    if (scared) { v.box(s * 10, s * 13, 26, 29, -2, 2, C); v.box(s * 11, s * 13, 30, 40, -2, 2, C); v.box(s * 11, s * 13, 41, 44, -2, 2, skin); }
    else { v.box(s * 10, s * 13, 14, 29, -2, 2, C); v.box(s * 10, s * 13, 10, 13, -2, 2, skin); }
  });
}

function modelReaper(v, scared) {
  const R = '#241a3a', D = '#1b1430', B = '#e4e2f5', K = '#07050d', L = '#c3c0d6';
  const cloth = (x) => ((x + 40) % 4 === 0 ? D : R);
  for (let y = 0; y <= 34; y++) {
    const w = 10.5 - y * 0.16, d = 7.5 - y * 0.08;
    for (let x = -11; x <= 11; x++) for (let z = -8; z <= 8; z++) {
      if (((x / w) ** 2 + (z / d) ** 2) > 1) continue;
      if (y < 2 && (x * 3 + z * 7 + 80) % 5 < 2) continue;
      v.set(x, y, z, cloth(x));
    }
  }
  v.ball(0, 39, 0, 7.5, 7.5, 7.5, cloth);
  v.cut(-4, 4, 35, 42, 3, 8);
  v.box(-4, 4, 35, 42, 2, 2, K);
  v.sym((s) => v.set(s * 2, 39, 3, scared ? '#e0303c' : '#5ff5ff'));
  v.sym((s) => v.set(s * 2, 38, 3, scared ? '#7a1420' : '#2fb0b0'));
  v.sym((s) => {
    if (scared) { v.box(s * 8, s * 11, 28, 31, -3, 2, cloth); v.box(s * 11, s * 13, 31, 41, -3, 2, cloth); v.box(s * 11, s * 13, 42, 44, -1, 0, B); }
    else { v.box(s * 8, s * 11, 20, 31, -3, 2, cloth); v.box(s * 9, s * 11, 15, 19, -2, 3, cloth); v.box(s * 9, s * 11, 13, 14, 0, 3, B); }
  });
  const hx = scared ? 14 : 12;
  v.box(hx, hx + 1, 0, 50, 1, 2, '#5a4038');
  for (let i = 0; i < 16; i++) {
    const x = hx + 1 - i, y = 50 + Math.round(Math.sin((i / 15) * Math.PI) * 5);
    v.box(x, x, y - 2, y, 1, 2, i < 3 ? '#5a4038' : L);
    if (i >= 3) v.set(x, y - 3, 2, '#8b87a6');
  }
}

const VOXEL_MODELS = {
  ghost:   { style: 'A', unit: 0.11, label: 'Fantasma',   build: modelGhost },
  zombie:  { style: 'A', unit: 0.11, label: 'Zumbi',      build: modelZombie },
  mummy:   { style: 'A', unit: 0.11, label: 'Múmia',      build: modelMummy },
  wolf:    { style: 'B', unit: 0.085, label: 'Lobisomem',  build: modelWolf },
  vamp:    { style: 'B', unit: 0.085, label: 'Vampiro',    build: modelVamp },
  frank:   { style: 'B', unit: 0.085, label: 'Costurado',  build: modelStitched },
  reaper:  { style: 'B', unit: 0.085, label: 'Ceifador',   build: modelReaper },
  saci:    { style: 'B', unit: 0.085, label: 'Saci',       build: modelSaci },
};
const VOXEL_STYLE_NAMES = { A: 'CABEÇÃO', B: 'ESGUIO' };

// quads do boneco: nome = 'wolf' ou 'wolf_s' (quadro de susto); null se não tiver modelo próprio
function voxelModelQuads(name) {
  const scared = name.endsWith('_s'), M = VOXEL_MODELS[scared ? name.slice(0, -2) : name];
  if (!M) return null;
  const v = new VoxGrid();
  M.build(v, scared);
  return meshVoxGrid(v, M.unit);
}

