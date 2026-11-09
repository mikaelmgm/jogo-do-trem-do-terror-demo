'use strict';
// ============================================================
//  FILTROS — pós-processamento em WebGL por cima do jogo.
//  A cada quadro o canvas do jogo vira textura e um shader aplica
//  o efeito. O canvas do jogo continua por baixo recebendo os cliques.
// ============================================================

const FX = (() => {
  // id = qual efeito o shader aplica; mix = nome do efeito que roda dentro da TV de tubo
  // (esses têm duas forças: a do efeito e a do tubo)
  const FILTERS = [
    { key: 'none',    id: 0, name: 'Nenhum' },
    { key: 'vhs',     id: 1, name: 'VHS' },
    { key: 'crtvhs',  id: 7, name: 'Tubo + VHS', mix: 'VHS' },
    { key: 'crtfilm', id: 8, name: 'Tubo + Filme antigo', mix: 'FILME' },
    { key: 'crt',     id: 2, name: 'TV de tubo' },
    { key: 'film',    id: 3, name: 'Filme antigo' },
    { key: 'night',   id: 4, name: 'Câmera noturna' },
    { key: 'glitch',  id: 5, name: 'Glitch' },
    { key: 'gameboy', id: 6, name: 'Game Boy' },
  ];
  const PREF_KEY = 'casaAssombrada.fx';

  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() { vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uSrc;     // resolução do jogo (400x260)
    uniform vec2 uOut;     // resolução do canvas do filtro
    uniform float uTime, uK, uK2, uMode;   // uK2 = força do tubo nos filtros "Tubo + ..."

    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float luma(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
    vec3 tex(vec2 uv) { return texture2D(uTex, clamp(uv, 0., 1.)).rgb; }
    float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
    float bayer4(vec2 a) { return bayer2(.5 * a) * .25 + bayer2(a); }
    float vignette(vec2 uv, float amt) { vec2 d = uv - .5; return clamp(1. - dot(d, d) * amt, 0., 1.); }

    vec3 vhs(vec2 uv, float k) {
      float t = uTime, row = floor(uv.y * uSrc.y);
      float bandY = 1. - fract(t * .09);                                // faixa de tracking descendo
      float band = smoothstep(.05, 0., abs(uv.y - bandY));
      float head = smoothstep(.035, 0., uv.y);                          // ruído no pé da imagem
      float jit = (hash(vec2(row, floor(t * 20.))) - .5) * .003
                + band * (hash(vec2(row, t)) - .5) * .04
                + sin(uv.y * 8. + t * 1.7) * .0015
                + head * (hash(vec2(row, floor(t * 30.))) * .05 + .01);
      uv.x += jit * k;
      float off = .0045 * k;
      vec3 c = vec3(tex(uv + vec2(off, 0.)).r, tex(uv).g, tex(uv - vec2(off, 0.)).b);
      vec3 smear = (tex(uv - vec2(.004, 0.)) + tex(uv - vec2(.008, 0.)) + tex(uv - vec2(.012, 0.))) / 3.;
      c = mix(c, max(c, smear), .45 * k);                               // cor vazando para a direita
      c = mix(c, vec3(luma(c)), .3 * k);                                // cor lavada
      c = c * (1. - .1 * k) + vec3(.035, .02, .06) * k;                 // preto levantado, meio roxo
      c += (hash(uv * uOut + fract(t) * 91.) - .5) * .14 * k;           // chiado
      c += band * hash(vec2(uv.x * 3., row + t)) * .35 * k;
      c += head * hash(vec2(uv.x * 50., t)) * .5 * k;
      c *= 1. - .12 * k * step(.65, fract(uv.y * uSrc.y));              // linhas
      return c * mix(1., vignette(uv, 1.4), k);
    }

    // tubo em duas partes: a curvatura da tela e o "vidro" (linhas, fósforo, cantos)
    vec2 crtWarp(vec2 uv, float k) {
      vec2 c = uv * 2. - 1.;
      c *= 1. + (c.yx * c.yx) * vec2(.07, .1) * k;
      return c * .5 + .5;
    }
    bool offScreen(vec2 u) { return u.x < 0. || u.x > 1. || u.y < 0. || u.y > 1.; }
    vec3 crtGlass(vec3 col, vec2 u, float k) {
      vec3 glow = (tex(u + vec2(.004, 0.)) + tex(u - vec2(.004, 0.)) + tex(u + vec2(0., .006)) + tex(u - vec2(0., .006))) * .25;
      col += glow * .25 * k;
      col *= mix(1., .6 + .4 * sin(fract(u.y * uSrc.y) * 3.14159), k);  // uma linha por linha do jogo
      float m = mod(gl_FragCoord.x, 3.);                                 // máscara de fósforo RGB
      vec3 mask = m < 1. ? vec3(1., .75, .75) : m < 2. ? vec3(.75, 1., .75) : vec3(.75, .75, 1.);
      col *= mix(vec3(1.), mask * 1.2, .7 * k);
      col *= 1. + .2 * k;
      vec2 e = smoothstep(vec2(0.), vec2(.012 + .02 * k), u) * smoothstep(vec2(0.), vec2(.012 + .02 * k), 1. - u);
      col *= e.x * e.y;
      col *= 1. - .02 * k * sin(uTime * 110.);
      return col * mix(1., vignette(u, 1.2), k);
    }
    vec3 crt(vec2 uv, float k) {
      vec2 u = crtWarp(uv, k);
      if (offScreen(u)) return vec3(0.);
      float off = .0012 * k;
      return crtGlass(vec3(tex(u + vec2(off, 0.)).r, tex(u).g, tex(u - vec2(off, 0.)).b), u, k);
    }
    // fita VHS passando numa TV de tubo: a fita é lida na tela curva e depois vem o vidro
    vec3 crtVhs(vec2 uv, float kv, float kc) {
      vec2 u = crtWarp(uv, kc);
      if (offScreen(u)) return vec3(0.);
      return crtGlass(vhs(u, kv), u, kc);
    }

    vec3 film(vec2 uv, float k) {
      float t = uTime, fr = floor(t * 18.);
      uv += vec2(hash(vec2(fr, 2.)) - .5, hash(vec2(fr, 1.)) - .5) * vec2(.003, .006) * k;  // quadro tremendo
      vec3 c = tex(uv);
      float l = luma(c);
      c = mix(c, vec3(l * 1.08 + .04, l * .9 + .02, l * .68), k);       // sépia
      c *= 1. + (hash(vec2(fr, 3.)) - .5) * .25 * k;                    // tremulação da luz
      c += (hash(uv * uOut + fract(t * 7.) * 53.) - .5) * .22 * k;      // grão
      for (int i = 0; i < 2; i++) {                                      // riscos verticais
        float fi = float(i), seg = floor(t * 6. + fi * 3.);
        float sx = hash(vec2(seg, 7. + fi));
        float on = step(.45, hash(vec2(seg, 11. + fi))) * step(hash(vec2(floor(uv.y * 40.), fr + fi)), .9);
        c += (fi < .5 ? .4 : -.35) * on * k * smoothstep(.0015, 0., abs(uv.x - sx));
      }
      float dust = step(.9985, hash(floor(uv * uSrc * .5) + fr));       // poeira
      c = mix(c, vec3(.1, .07, .05), dust * k);
      return c * mix(1., vignette(uv, 2.2), k);
    }

    // filme antigo passando na TV de tubo (precisa vir depois de film())
    vec3 crtFilm(vec2 uv, float kf, float kc) {
      vec2 u = crtWarp(uv, kc);
      if (offScreen(u)) return vec3(0.);
      return crtGlass(film(u, kf), u, kc);
    }

    vec3 night(vec2 uv, float k) {
      vec3 c = tex(uv);
      vec3 b = (tex(uv + vec2(.003, 0.)) + tex(uv - vec2(.003, 0.)) + tex(uv + vec2(0., .004)) + tex(uv - vec2(0., .004))) * .25;
      float l = pow(clamp((luma(c) * .7 + luma(b) * .5) * 2.2, 0., 1.), .8);
      l += (hash(uv * uOut + fract(uTime) * 37.) - .5) * .25;
      l *= .9 + .1 * sin(uv.y * uSrc.y * 3.14159);
      vec3 g = vec3(.15, 1., .35) * l + vec3(0., .05, .02);
      g *= mix(1., smoothstep(.75, .45, length((uv - .5) * vec2(uOut.x / uOut.y, 1.))), .8);
      return mix(c, g, k);
    }

    vec3 glitch(vec2 uv, float k) {
      float t = uTime, fr = floor(t * 12.), blockY = floor(uv.y * 14.);
      float active = step(1. - .35 * k, hash(vec2(blockY, fr)));        // faixas deslocadas
      uv.x += active * (hash(vec2(blockY, fr + 7.)) - .5) * .12 * k;
      float burst = step(.85, hash(vec2(fr, 5.)));                       // tranco forte de vez em quando
      float off = (.004 + burst * .02) * k;
      vec3 c = vec3(tex(uv + vec2(off, 0.)).r, tex(uv).g, tex(uv - vec2(off, off * .5)).b);
      c = mix(c, 1. - c, active * step(.8, hash(vec2(blockY, fr + 3.))) * k);
      vec2 cell = floor(uv * vec2(24., 16.));                            // blocos de pixel quebrado
      float bad = step(.985 - .02 * k, hash(cell + fr)) * k;
      c = mix(c, vec3(hash(cell), hash(cell + 1.), hash(cell + 2.)), bad);
      return c + (hash(uv * uOut + fract(t) * 13.) - .5) * .08 * k;
    }

    vec3 gameboy(vec2 uv, float k) {
      vec2 p = floor(uv * uSrc);
      vec3 c = tex((p + .5) / uSrc);
      float l = clamp(luma(c) * 1.35 + .05, 0., 1.);
      float lv = clamp(floor((l + (bayer4(p) - .5) * .35) * 4.), 0., 3.);
      vec3 g = lv < .5 ? vec3(.06, .22, .06) : lv < 1.5 ? vec3(.19, .38, .19) : lv < 2.5 ? vec3(.55, .67, .06) : vec3(.61, .74, .06);
      vec2 f = fract(uv * uSrc);                                         // grade do LCD
      g *= mix(1., .85 + .15 * step(.12, f.x) * step(.12, f.y), step(3., uOut.x / uSrc.x));
      return mix(c, g, k);
    }

    void main() {
      vec2 uv = vUv;
      vec3 c;
      if (uMode < 1.5) c = vhs(uv, uK);
      else if (uMode < 2.5) c = crt(uv, uK);
      else if (uMode < 3.5) c = film(uv, uK);
      else if (uMode < 4.5) c = night(uv, uK);
      else if (uMode < 5.5) c = glitch(uv, uK);
      else if (uMode < 6.5) c = gameboy(uv, uK);
      else if (uMode < 7.5) c = crtVhs(uv, uK, uK2);
      else c = crtFilm(uv, uK, uK2);
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`;

  let gl = null, src = null, cv = null, uni = {};
  // padrão: Tubo + Filme antigo com filme 14% e tubo 38%. k = força principal (VHS ou filme nos
  // filtros com tubo), k2 = força do tubo
  const DEFAULT_PREF = { mode: 'crtfilm', k: 14, k2: 38 };
  let pref = Object.assign({}, DEFAULT_PREF);
  const filter = () => FILTERS.find(f => f.key === pref.mode);
  const $ = id => document.getElementById(id);

  function loadPref() {
    try { Object.assign(pref, JSON.parse(localStorage.getItem(PREF_KEY)) || {}); } catch (e) { }
    if (!FILTERS.some(f => f.key === pref.mode)) pref.mode = DEFAULT_PREF.mode;
    const clampK = v => Math.max(0, Math.min(100, Math.round(+v) || 0));
    pref.k = clampK(pref.k); pref.k2 = clampK(pref.k2);
  }
  function savePref() { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch (e) { } }

  function setupGL() {
    gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) return false;
    const sh = (type, code) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, code); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    ['uTex', 'uSrc', 'uOut', 'uTime', 'uK', 'uK2', 'uMode'].forEach(n => { uni[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(uni.uTex, 0);
    return true;
  }

  // mostra o segundo controle (força do tubo) só nos filtros "Tubo + ..."
  function apply() {
    const f = filter(), on = !!gl && f.key !== 'none';
    cv.classList.toggle('hidden', !on);
    $('fxPowLbl').textContent = f.mix || 'FORÇA';
    $('fxPowVal').textContent = pref.k + '%';
    $('fxPow').disabled = !on;
    $('fxK2Box').classList.toggle('hidden', !(on && f.mix));
    $('fxPow2Val').textContent = pref.k2 + '%';
  }

  function render(now) {
    if (!gl || pref.mode === 'none') return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform2f(uni.uSrc, src.width, src.height);
    gl.uniform2f(uni.uOut, w, h);
    gl.uniform1f(uni.uTime, now / 1000);
    gl.uniform1f(uni.uK, pref.k / 100);
    gl.uniform1f(uni.uK2, pref.k2 / 100);
    gl.uniform1f(uni.uMode, filter().id);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function init(gameCanvas) {
    src = gameCanvas; cv = $('fx');
    loadPref();
    const sel = $('fxMode'), pow = $('fxPow'), pow2 = $('fxPow2');
    sel.innerHTML = FILTERS.map(f => `<option value="${f.key}">${f.name}</option>`).join('');
    sel.value = pref.mode;
    pow.value = pref.k;
    pow2.value = pref.k2;
    try { setupGL(); } catch (e) { gl = null; console.warn('Filtros desligados:', e); }
    if (!gl) { sel.disabled = true; sel.title = 'Seu navegador não tem WebGL'; }
    sel.addEventListener('change', () => { pref.mode = sel.value; savePref(); apply(); });
    pow.addEventListener('input', () => { pref.k = +pow.value; savePref(); apply(); });
    pow2.addEventListener('input', () => { pref.k2 = +pow2.value; savePref(); apply(); });
    apply();
  }

  return { init, render, FILTERS };
})();
