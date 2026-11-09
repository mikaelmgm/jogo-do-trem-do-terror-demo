'use strict';
// ============================================================
//  CINEMA 3D — o visual "realista" do jogo em 3D: céu, luzes, pós-processamento,
//  passeio em primeira pessoa e som.
//  É um script clássico para o jogo continuar abrindo direto pelo index.html: o módulo do jogo
//  chama initCinema3D(THREE, passes, contexto) e usa o objeto devolvido.
// ============================================================
function initCinema3D(THREE, ADD, C) {
  const { renderer, scene, cam, view, settings, state, U, MAP_S, carts, train, slots, lapPt, OFFS, moon, hemi } = C;
  const $ = (id) => document.getElementById(id);
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, mr = (a, b) => a + Math.random() * (b - a);

  /* ---------- qualidade ---------- */
  const Q_KEY = 'casaAssombrada.3d.q', SND_KEY = 'casaAssombrada.3d.som';
  const QUALITY = [
    { ratio: 1, bloom: false, fxaa: false, shadow: 2048, beamShadow: false },
    { ratio: 1.25, bloom: true, fxaa: true, shadow: 2048, beamShadow: true },
    { ratio: 2, bloom: true, fxaa: true, shadow: 4096, beamShadow: true },
  ];
  let q = window.innerWidth < 760 ? 0 : 2;
  try { const s = localStorage.getItem(Q_KEY); if (s !== null && QUALITY[+s]) q = +s; } catch (e) { /* sem storage */ }

  /* ---------- céu ---------- */
  // Um retângulo na frente de tudo, desenhado antes do resto: cada pixel vira uma direção no céu.
  // Na vista de cima (câmera ortográfica) a direção é inventada a partir do giro da câmera, para o céu
  // andar junto quando o jogador gira a ilha; em primeira pessoa é a direção de verdade.
  const NOISE = `
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }`;
  const MOON_SKY = new V3(-0.5, 0.42, -0.62).normalize();
  const HORIZON = new THREE.Color().setRGB(0.034, 0.022, 0.085), FOG_PIXEL = new THREE.Color(0x1e1733);
  const skyU = {
    uTime: U.time, uOrtho: { value: 1 }, uYaw: { value: 0 }, uEl: { value: 0.2 }, uAspect: { value: 1.78 }, uTan: { value: 0.7 }, uFlash: { value: 0 },
    uRight: { value: new V3(1, 0, 0) }, uUp: { value: new V3(0, 1, 0) }, uFwd: { value: new V3(0, 0, -1) }, uMoon: { value: MOON_SKY },
  };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: skyU, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vN; void main(){ vN = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      precision highp float;
      uniform float uTime, uOrtho, uYaw, uEl, uAspect, uTan, uFlash;
      uniform vec3 uRight, uUp, uFwd, uMoon;
      varying vec2 vN;
      ${NOISE}
      void main(){
        vec3 d;
        if (uOrtho > 0.5) {
          float sc = 0.42 * max(1.0, 0.9 / uAspect);   // em tela em pé o céu abre mais, para a lua não ficar enorme
          float az = uYaw - vN.x * sc * uAspect, el = uEl + vN.y * sc;
          d = vec3(-sin(az) * cos(el), sin(el), -cos(az) * cos(el));
        } else d = normalize(uFwd + uRight * (vN.x * uTan * uAspect) + uUp * (vN.y * uTan));
        vec2 hz = normalize(d.xz + vec2(1e-5));
        float up = max(d.y, 0.0);
        vec3 zen = vec3(0.004, 0.005, 0.02), hor = vec3(0.034, 0.022, 0.085);
        vec3 col = mix(hor, zen, pow(up, 0.45));
        // estrelas quadradinhas, cada uma piscando no seu ritmo
        vec2 sg = d.xz / (up + 0.4) * 46.0, cell = floor(sg), sf = fract(sg) - 0.5;
        float hs = h21(cell);
        float star = step(0.985, hs) * step(max(abs(sf.x), abs(sf.y)), 0.1 + 0.16 * fract(hs * 91.7));
        float tw = 0.6 + 0.4 * sin(uTime * (1.2 + fract(hs * 7.3) * 3.0) + hs * 80.0);
        col += vec3(1.0, 0.94, 0.82) * star * tw * (0.8 + 2.4 * fract(hs * 13.1)) * smoothstep(0.03, 0.3, d.y);
        // lua em blocos, com crateras, e o halo em volta
        float md = acos(clamp(dot(d, uMoon), -1.0, 1.0)), R = 0.088;
        vec3 mx = normalize(cross(vec3(0.0, 1.0, 0.0), uMoon)), my = cross(uMoon, mx);
        vec2 mp = floor(vec2(dot(d, mx), dot(d, my)) / R * 9.0 + 0.5) / 9.0;
        float inMoon = step(length(mp), 1.0) * step(md, R * 1.6);
        float cr = max(max(step(length(mp - vec2(-0.32, 0.22)), 0.26), step(length(mp - vec2(0.3, -0.2)), 0.2)), max(step(length(mp - vec2(0.05, 0.5)), 0.14), step(length(mp - vec2(-0.1, -0.5)), 0.16)));
        vec3 mc = mix(vec3(1.0, 0.9, 0.66), vec3(0.8, 0.68, 0.42), cr);
        mc *= mix(1.0, 0.82, step(0.8, length(mp)));
        mc = mix(mc, vec3(1.0, 0.97, 0.85), step(0.6, mp.y - mp.x) * step(0.62, length(mp)));
        col += vec3(0.75, 0.66, 0.5) * (exp(-md * 9.0) * 0.16 + exp(-md * 30.0) * 0.35) * (1.0 - inMoon);
        col = mix(col, mc * 1.5, inMoon);
        // nuvens passando, acesas pela lua e pelos relâmpagos
        float cn = fbm(d.xz / (up + 0.18) * 0.9 + vec2(uTime * 0.012, uTime * 0.004));
        float cb = smoothstep(0.5, 0.74, cn) * smoothstep(0.015, 0.14, d.y) * (1.0 - smoothstep(0.5, 0.95, d.y)) * (1.0 - 0.65 * exp(-md * 6.0));
        vec3 cc = mix(vec3(0.012, 0.01, 0.03), vec3(0.07, 0.06, 0.13), smoothstep(0.58, 0.9, cn));
        cc += vec3(0.5, 0.42, 0.3) * exp(-md * 3.6) * 0.22 + vec3(0.6, 0.62, 0.9) * uFlash * 1.4;
        col = mix(col, cc, cb * 0.9);
        // serra no horizonte, com um castelo ao longe
        float ridge = 0.03 + 0.06 * vn(hz * 2.3 + 3.0) + 0.03 * vn(hz * 7.0 + 9.0);
        vec2 cd = normalize(vec2(-0.86, -0.5));
        float ca = hz.x * cd.y - hz.y * cd.x, front = step(0.0, dot(hz, cd));
        float tower = max(step(abs(ca), 0.03) * 0.045, max(step(abs(abs(ca) - 0.03), 0.008) * 0.085, step(abs(ca), 0.007) * 0.105)) * front;
        float top = ridge + tower;
        vec3 silc = mix(hor * 0.5, vec3(0.018, 0.014, 0.045), smoothstep(0.0, 0.07, top - d.y));
        float win = front * step(abs(abs(ca) - 0.03), 0.003) * step(abs(d.y - ridge - 0.06), 0.006) + front * step(abs(ca), 0.003) * step(abs(d.y - ridge - 0.08), 0.006);
        silc = mix(silc, vec3(2.0, 1.2, 0.35), min(1.0, win));
        col = mix(col, silc, step(d.y, top));
        // abaixo do horizonte: o mar de nuvens onde as ilhas flutuam
        float dn = max(-d.y, 0.0);
        float sn = fbm(d.xz / (dn + 0.06) * 0.22 + vec2(uTime * 0.008, 0.0));
        vec3 sea = mix(vec3(0.006, 0.005, 0.02), vec3(0.04, 0.034, 0.085), smoothstep(0.3, 0.8, sn));
        sea += vec3(0.35, 0.3, 0.32) * pow(max(dot(hz, normalize(uMoon.xz)), 0.0), 10.0) * smoothstep(0.5, 0.85, sn) * 0.3;
        sea += vec3(0.5, 0.52, 0.8) * uFlash * smoothstep(0.4, 0.9, sn);
        col = mix(col, mix(hor, sea, smoothstep(0.0, 0.2, dn)), step(d.y, 0.0));
        col += vec3(0.1, 0.1, 0.18) * uFlash;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10000; sky.layers.set(3);
  scene.add(sky);

  /* ---------- luzes ---------- */
  // lua mais baixa, para as sombras ficarem compridas
  moon.position.set(-0.5, 0.8, -0.62).normalize().multiplyScalar(60 * MAP_S).add(C.mapMid);
  // farol do trem: um foco de verdade, que joga sombra nos túmulos, mais o facho visível
  const beam = new THREE.SpotLight(0xffd9a0, 0, 34, 0.46, 0.75, 1.6);
  beam.position.set(1.15, 0.78, 0); beam.target.position.set(9, -0.6, 0);
  beam.shadow.mapSize.set(1024, 1024); beam.shadow.camera.near = 0.4; beam.shadow.camera.far = 34; beam.shadow.bias = -0.002; beam.shadow.normalBias = 0.03;
  carts[0].g.add(beam, beam.target);
  const CONE_VS = 'varying float vT; varying vec3 vNn; varying vec3 vV; void main(){ vT = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vNn = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  const CONE_FS = 'uniform vec3 uColor; uniform float uPow; varying float vT; varying vec3 vNn; varying vec3 vV; void main(){ float edge = pow(abs(dot(normalize(vNn), normalize(vV))), 1.6); float a = edge * pow(vT, 1.4) * uPow; gl_FragColor = vec4(uColor * a, a); }';
  const coneMat = (r, g, b, p) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color().setRGB(r, g, b) }, uPow: { value: p } }, vertexShader: CONE_VS, fragmentShader: CONE_FS,
  });
  const fx = new THREE.Group();
  scene.add(fx);
  const lampCone = coneMat(1.0, 0.55, 0.2, 0.3), coneGeo = new THREE.ConeGeometry(1.7, 1.95, 24, 1, true);
  for (const l of C.LANTERNS) { const m = new THREE.Mesh(coneGeo, lampCone); m.position.set(l.x, 0.975, l.z); m.layers.set(1); m.renderOrder = 2; fx.add(m); }
  const beamCone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 11, 24, 1, true), coneMat(1.0, 0.8, 0.5, 0.2));
  beamCone.rotation.z = Math.PI / 2; beamCone.position.set(6.65, 0.7, 0); beamCone.layers.set(1); beamCone.renderOrder = 2;
  carts[0].g.add(beamCone);
  // clarão colorido no boneco que está assustando
  const scareLights = [0, 1].map(() => { const l = new THREE.PointLight(0xffffff, 0, 11, 2); scene.add(l); return { l, t: 0 }; });
  let scareN = 0;
  // névoa rasteira em camadas lisas (no modo pixel art continua a névoa pontilhada)
  const MIST_FS = `uniform float uTime, uA; uniform vec3 uCol; varying vec3 vW;
    ${NOISE}
    void main(){ vec2 qq = vW.xz;
      float m = vn(qq * 0.16 + vec2(uTime * 0.05, uTime * 0.02)) * 0.6 + vn(qq * 0.43 - vec2(uTime * 0.08, -uTime * 0.03)) * 0.4;
      float isl = pow(pow(abs(vW.x) / ${C.RX.toFixed(1)}, 4.0) + pow(abs(vW.z) / ${C.RZ.toFixed(1)}, 4.0), 0.25);
      gl_FragColor = vec4(uCol, smoothstep(0.45, 0.9, m) * (1.0 - smoothstep(0.8, 0.95, isl)) * uA); }`;
  const mistCol = { value: new THREE.Color().setRGB(0.09, 0.1, 0.22) };
  const mkMist = (a) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: U.time, uCol: mistCol, uA: { value: a } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: MIST_FS,
  });
  const softMist = mkMist(0.34);
  for (const [y, a] of [[0.6, 0.16], [1.05, 0.09]]) { const m = new THREE.Mesh(C.mist.geometry, mkMist(a)); m.rotation.x = -Math.PI / 2; m.position.y = y; m.layers.set(1); m.renderOrder = 1; fx.add(m); }
  // vaga-lumes
  const FF = 64, ffMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.4, 3.2, 0.9), fog: false }), FF);
  ffMesh.layers.set(1); ffMesh.frustumCulled = false;
  scene.add(ffMesh);
  const ffs = Array.from({ length: FF }, () => ({ x: mr(-16, 16), z: mr(-10, 14), y: mr(0.5, 2.4), p: mr(0, 6.28), w: mr(0.3, 0.9), r: mr(0.5, 1.8) }));
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _p = new V3();
  // relâmpagos ao longe
  const storm = { next: mr(12, 26), t: 99, pulses: [], f: 0 };

  const EYE = new THREE.Color(0xe0303c), PAD = new THREE.Color(0xff8a1f);
  // roda logo depois do updateLights do jogo, que refaz as cores e as intensidades todo quadro
  function afterLights() {
    const real = !settings.pixel, t = U.time.value;
    if (real) {
      C.lampMat.color.multiplyScalar(3.0); C.winWarm.color.multiplyScalar(2.2); C.winPurple.color.multiplyScalar(2.4);
      C.runeMat.color.multiplyScalar(2.2); C.medLampMat.color.multiplyScalar(2.2); C.doorGlow.color.multiplyScalar(2.0);
      for (const l of C.lampLights) l.intensity *= 1.8;
      C.houseLight.intensity *= 1.6; C.porchLight.intensity *= 1.6; C.cryptLight.intensity *= 1.5;
      C.headlight.intensity *= 0.35;
    }
    C.eyeMat.color.copy(EYE).multiplyScalar(real ? 3 : 1);
    C.padMat.color.copy(PAD).multiplyScalar(real ? 2 : 1);
    beam.intensity = real ? 150 * (0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 7.3)) : 0;
    hemi.intensity = (real ? 1.5 : 2.1) + storm.f * 9;
    moon.intensity = (real ? 3.4 : 1.6) + storm.f * 3;
  }

  /* ---------- pós-processamento ---------- */
  const composer = new ADD.EffectComposer(renderer);
  const mainPass = new ADD.RenderPass(scene, cam);
  const bloom = new ADD.UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 1.0);
  const post = new ADD.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.55 }, uScare: { value: 0 }, uGhost: { value: 0 }, uGrain: { value: 0.035 }, uCA: { value: 0.5 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uVig, uScare, uGhost, uGrain, uCA, uFlash; varying vec2 vUv;
      void main(){
        vec2 c = vUv - 0.5; float r2 = dot(c, c), ca = uCA * (0.0015 + r2 * 0.012);
        vec3 col = vec3(texture2D(tDiffuse, vUv + c * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c * ca).b);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, vec3(l) * vec3(0.55, 0.85, 1.25), uGhost);                 // passeio de fantasma
        col += vec3(0.9, 0.05, 0.08) * uScare * (0.03 + r2 * 0.9);              // susto: vermelho nas bordas
        col += vec3(0.25, 0.26, 0.4) * uFlash;                                   // relâmpago
        col *= 1.0 - uVig * smoothstep(0.1, 0.9, r2 * 1.7);
        float g = fract(sin(dot(vUv * vec2(1920.0, 1080.0) + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
        col += (g - 0.5) * uGrain * (0.4 + l);
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }`,
  });
  const outPass = new ADD.OutputPass();
  const fxaa = new ADD.ShaderPass(ADD.FXAAShader);
  for (const p of [mainPass, bloom, post, outPass, fxaa]) composer.addPass(p);
  renderer.toneMappingExposure = 1.15;

  /* ---------- som (sintetizado na hora, sem arquivos) ---------- */
  const audio = (() => {
    let ctx = null, master = null, wind = null, rumble = null, buf = null, vol = 0.6, muted = false, lastSting = 0;
    try { const s = JSON.parse(localStorage.getItem(SND_KEY)); if (s) { vol = +s.vol; muted = !!s.muted; } } catch (e) { /* sem storage */ }
    const loop = (freq, g) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
      src.buffer = buf; src.loop = true; f.type = 'lowpass'; f.frequency.value = freq; gn.gain.value = g;
      src.connect(f); f.connect(gn); gn.connect(master); src.start();
      return { f, g: gn };
    };
    function unlock() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ctx.destination);
        buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        wind = loop(380, 0.03); rumble = loop(70, 0);
      } catch (e) { ctx = null; }
    }
    const env = (g, t, peak, dur) => { peak = Math.max(0.0002, peak); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012 + dur); };
    function tone(type, f0, f1, dur, peak, when = 0) {
      if (!ctx || muted) return;
      const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.08);
    }
    function noise(freq, type, dur, peak, when = 0) {
      if (!ctx || muted) return;
      const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; f.type = type; f.frequency.value = freq; env(g, t, peak, dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.08);
    }
    return {
      unlock,
      // k = força do susto, de 0 a 1
      sting(k) {
        if (!ctx || ctx.currentTime - lastSting < 0.25) return;
        lastSting = ctx.currentTime;
        const base = 90 + Math.random() * 40;
        tone('sawtooth', base * 4, base, 0.5, 0.16 * k); tone('sawtooth', base * 4.24, base * 1.06, 0.55, 0.12 * k);
        tone('square', base * 8.4, base * 2, 0.3, 0.05 * k); noise(1800, 'bandpass', 0.35, 0.22 * k);
      },
      blip() { if (ctx && ctx.currentTime - lastSting > 0.5) { lastSting = ctx.currentTime; tone('triangle', 320, 110, 0.14, 0.035); } },
      coin() { tone('square', 880, 880, 0.08, 0.06); tone('square', 1320, 1320, 0.18, 0.06, 0.08); },
      beat() { tone('sine', 70, 40, 0.14, 0.5); tone('sine', 60, 36, 0.16, 0.32, 0.18); },
      thunder(k) { noise(170, 'lowpass', 2.6, 0.5 * k); noise(60, 'lowpass', 3.4, 0.6 * k, 0.15); },
      click() { tone('square', 520, 740, 0.05, 0.035); },
      clack(k) { noise(2600, 'highpass', 0.04, 0.05 * k); tone('sine', 110, 70, 0.06, 0.12 * k); },
      flat() { tone('sine', 880, 880, 1.6, 0.09); },
      frame(speed, riding) {
        if (!ctx) return;
        const t = ctx.currentTime;
        rumble.g.gain.setTargetAtTime(riding ? 0.22 * Math.min(1.6, speed) : 0.015 * speed, t, 0.2);
        rumble.f.frequency.setTargetAtTime(60 + speed * 50, t, 0.2);
        wind.g.gain.setTargetAtTime(riding ? 0.05 + 0.05 * speed : 0.03, t, 0.5);
      },
      get vol() { return vol; }, get muted() { return muted; },
      set(v, m) {
        vol = v; muted = m;
        if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, 0.05);
        try { localStorage.setItem(SND_KEY, JSON.stringify({ vol, muted })); } catch (e) { /* sem storage */ }
      },
    };
  })();
  document.addEventListener('click', (e) => { if (e.target.closest('button, a.mb')) { audio.unlock(); audio.click(); } }, true);

  /* ---------- passeio em primeira pessoa ---------- */
  // A câmera vai no segundo carrinho, para ver os clientes da frente levando susto antes de você.
  const fpCam = new THREE.PerspectiveCamera(72, 1, 0.06, 1500);
  fpCam.rotation.order = 'YXZ';
  const fp = { on: false, cart: Math.min(1, carts.length - 1), yaw: 0, pitch: 0, hdg: null, bank: 0, idle: 0, drag: null, shake: 0, flash: 0, ghost: 0, glance: 0, bpm: 72, beat: 0, saved: null, hudT: 0, msgT: 0 };
  let clackD = 0;
  function fpMsg(text, cls) {
    const el = $('fpMsg');
    el.textContent = text; el.className = 'fp-msg show ' + (cls || '');
    fp.msgT = 3;
  }
  function ride(on) {
    if (on === fp.on) return;
    fp.on = on;
    document.body.classList.toggle('riding', on);
    $('fpHud').hidden = !on;
    if (on) {
      fp.saved = { pixel: settings.pixel, names: settings.names, speed: state.speed, fogN: scene.fog.near, fogF: scene.fog.far };
      if (settings.pixel) C.setPixel(false);
      settings.names = false;
      if (state.paused) C.setPaused(false);
      state.speed = 1;
      scene.fog.near = 6; scene.fog.far = 110;
      Object.assign(fp, { yaw: 0, pitch: 0, glance: 0, ghost: 0, bpm: 72, hdg: null, bank: 0, shake: 0, flash: 0 });
      C.closeCard();
      audio.unlock();
      fpMsg('Segure firme. Arraste para olhar em volta.', 'good');
    } else {
      const s = fp.saved;
      scene.fog.near = s.fogN; scene.fog.far = s.fogF;
      settings.names = s.names; state.speed = s.speed;
      for (const seat of carts[fp.cart].seats) seat.rider.g.visible = seat.alive;
      post.uniforms.uGhost.value = 0; post.uniforms.uScare.value = 0;
      if (s.pixel) C.setPixel(true);
    }
    $('speed').textContent = 'VELOC. ×' + state.speed;
    C.resize();
    if (api.onRideChange) api.onRideChange(on);
  }
  function updateRide(dt, dtReal) {
    const c = carts[fp.cart], g = c.g, t = U.time.value;
    for (const seat of c.seats) seat.rider.g.visible = false;
    const d = train.dist - OFFS[fp.cart], a = lapPt(d + 0.2), b = lapPt(d + 4.2);
    const want = Math.atan2(-(b.x - a.x), -(b.z - a.z));
    if (fp.hdg === null) fp.hdg = want;
    let dh = want - fp.hdg; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    fp.hdg += dh * Math.min(1, dtReal * 6);
    fp.bank += (clamp(-dh * 1.4, -0.14, 0.14) - fp.bank) * Math.min(1, dtReal * 4);
    const sp = train.v / 4, rattle = sp * 0.011;
    fpCam.position.set(g.position.x - Math.cos(g.rotation.y) * 0.18, 1.36 + Math.sin(t * 27) * rattle + Math.sin(t * 13.3) * rattle * 0.6, g.position.z + Math.sin(g.rotation.y) * 0.18);
    if (!fp.drag) { fp.idle -= dtReal; if (fp.idle <= 0) { const k = Math.min(1, dtReal * 1.6); fp.yaw *= 1 - k; fp.pitch *= 1 - k; } }
    fp.glance *= Math.max(0, 1 - dtReal * 2.2);
    fp.shake = Math.max(0, fp.shake - dtReal * 1.8);
    fp.flash = Math.max(0, fp.flash - dtReal * 2.2);
    const sh = fp.shake * fp.shake, rnd = () => (Math.random() - 0.5) * sh;
    fpCam.rotation.set(fp.pitch - 0.05 + rnd() * 0.07, fp.hdg + fp.yaw + fp.glance + rnd() * 0.07, fp.bank + Math.sin(t * 9) * rattle * 0.6 + rnd() * 0.05);
    fpCam.fov = lerp(fpCam.fov, 72 + sp * 5 + (train.boost > 0 ? 10 : 0), Math.min(1, dtReal * 3));
    fpCam.updateProjectionMatrix();
    fpCam.updateMatrixWorld();
    // perto demais da câmera, texto e ícone viram um borrão gigante: esconde
    for (const f of C.floaters) if (f.rec.sp.position.distanceToSquared(fpCam.position) < 20) f.rec.sp.visible = false;
    // coração: acalma aos poucos e bate alto quando dispara
    fp.bpm += (72 - fp.bpm) * Math.min(1, dt * 0.4);
    fp.beat -= dt;
    if (fp.bpm > 96 && fp.beat <= 0) { fp.beat = 60 / fp.bpm; audio.beat(); }
    if (train.state === 'boarding') fp.ghost = Math.max(0, fp.ghost - dtReal * 0.8);
    if (fp.msgT > 0) { fp.msgT -= dtReal; if (fp.msgT <= 0) $('fpMsg').classList.remove('show'); }
    fp.hudT -= dtReal;
    if (fp.hudT <= 0) {
      fp.hudT = 0.12;
      $('fpBpm').textContent = Math.round(fp.bpm);
      $('fpHeart').style.setProperty('--beat', (60 / fp.bpm).toFixed(2) + 's');
      $('fpCarry').textContent = '+' + C.fmtN(train.carry, 3);
      $('fpBar').style.width = (train.state === 'running' ? (train.dist / C.LAP) * 100 : 0) + '%';
      let next = null;
      for (const s of slots) if (s.mon && s.d > d && (!next || s.d < next.d)) next = s;
      $('fpNext').textContent = train.state === 'boarding' ? 'Embarcando na estação…' : next ? 'A seguir: ' + MON[next.mon.kind].name : 'De volta para a casa';
    }
  }
  // chamado pelo jogo a cada susto; devolve true quando o texto do ganho já foi mostrado na HUD do passeio
  function onScare(slot, cart, idx, gain) {
    const L = scareLights[scareN++ % scareLights.length];
    L.l.color.set(RAR[slot.mon.rarity].color); L.l.position.set(slot.x - slot.nx * 0.9, 1.7, slot.z - slot.nz * 0.9); L.t = 0.5;
    if (!fp.on) { audio.blip(); return false; }
    const dx = slot.x - fpCam.position.x, dz = slot.z - fpCam.position.z, mine = idx === fp.cart;
    const k = mine ? 1 : clamp(1 - Math.hypot(dx, dz) / 14, 0, 0.6);
    // o susto no seu carrinho dispara o coração; o dos outros só dá um frio na espinha
    if (k > 0.05) { fp.shake = Math.max(fp.shake, k); fp.flash = Math.max(fp.flash, k * 0.8); fp.bpm = Math.min(185, fp.bpm + (mine ? 34 : k * 9)); audio.sting(k); }
    if (!mine) return false;
    // vira a cabeça para o lado do boneco
    if (!fp.drag) fp.glance = -Math.sign(dx * Math.cos(fp.hdg) - dz * Math.sin(fp.hdg)) * 0.55;
    const pop = document.createElement('div');
    pop.className = 'fp-pop'; pop.textContent = '+' + C.fmtN(gain, 3);
    $('fpPops').appendChild(pop); setTimeout(() => pop.remove(), 1200);
    for (const seat of cart.seats) {
      if (seat.dying === 0 && seat.medevac) fpMsg('SOCORRIDO! Os paramédicos tiraram você do trem.', 'good');
      else if (seat.dying === 0) { fp.ghost = 1; fp.bpm = 0; audio.flat(); fpMsg('VOCÊ INFARTOU. Sua família foi indenizada.', 'bad'); }
      else if (seat.shock > 0.85) fpMsg('INFARTO! Os paramédicos deram o choque.', 'good');
    }
    return true;
  }
  function onPay(v) {
    audio.coin();
    if (fp.on) fpMsg('+' + C.fmtN(v, 3) + ' $MEDO caíram na carteira', 'good');
  }
  // olhar em volta: os eventos são pegos antes de chegarem ao jogo, que giraria a ilha
  const cv = renderer.domElement;
  document.addEventListener('pointerdown', (e) => { if (!fp.on || e.target !== cv) return; e.stopPropagation(); fp.drag = { x: e.clientX, y: e.clientY }; }, true);
  document.addEventListener('pointermove', (e) => {
    if (!fp.on || !fp.drag) return;
    e.stopPropagation();
    fp.yaw = clamp(fp.yaw - (e.clientX - fp.drag.x) * 0.005, -2.3, 2.3); fp.pitch = clamp(fp.pitch - (e.clientY - fp.drag.y) * 0.004, -0.7, 0.6);
    fp.drag.x = e.clientX; fp.drag.y = e.clientY;
  }, true);
  const endDrag = (e) => { if (!fp.on) return; if (fp.drag) { fp.drag = null; fp.idle = 2.5; } if (e.target === cv) e.stopPropagation(); };
  document.addEventListener('pointerup', endDrag, true);
  document.addEventListener('pointercancel', endDrag, true);
  document.addEventListener('wheel', (e) => { if (fp.on && e.target === cv) { e.stopPropagation(); e.preventDefault(); } }, { capture: true, passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'f') { ride(!fp.on); e.stopImmediatePropagation(); }
    else if (k === 'escape' && fp.on) { ride(false); e.stopImmediatePropagation(); }
  }, true);
  $('fpExit').addEventListener('click', () => ride(false));

  /* ---------- quadro a quadro ---------- */
  function update(dt, dtReal) {
    const t = U.time.value;
    storm.next -= dt;
    if (storm.next <= 0) {
      storm.next = mr(20, 46); storm.t = 0; storm.pulses = [0, mr(0.08, 0.14), mr(0.25, 0.4)];
      const k = fp.on ? 1 : 0.45;
      setTimeout(() => audio.thunder(k), mr(500, 1700));
    }
    storm.t += dtReal;
    let f = 0;
    for (const p of storm.pulses) if (storm.t >= p) f = Math.max(f, Math.exp(-(storm.t - p) * 16));
    storm.f = f;
    for (const L of scareLights) { L.t = Math.max(0, L.t - dt); L.l.intensity = 26 * (L.t / 0.5) ** 2; }
    ffs.forEach((ff, i) => {
      const s = 0.05 * Math.max(0, Math.sin(t * 1.7 * ff.w + ff.p * 3) * 1.4 - 0.2);
      _m4.compose(_p.set(ff.x + Math.sin(t * ff.w + ff.p) * ff.r, ff.y + Math.sin(t * ff.w * 1.7 + ff.p) * 0.4, ff.z + Math.cos(t * ff.w * 0.8 + ff.p) * ff.r), _q, _s.setScalar(s));
      ffMesh.setMatrixAt(i, _m4);
    });
    ffMesh.instanceMatrix.needsUpdate = true;
    lampCone.uniforms.uPow.value = 0.26 + 0.05 * Math.sin(t * 11) * Math.sin(t * 3.7);
    const sp = train.state === 'running' ? train.v / 4 : 0;
    audio.frame(sp, fp.on);
    clackD += train.v * dt;
    if (clackD > 1.9) { clackD = 0; audio.clack(fp.on ? 1 : 0.12); }
    const pu = post.uniforms;
    if (fp.on) {
      updateRide(dt, dtReal);
      skyU.uOrtho.value = 0; skyU.uTan.value = Math.tan((fpCam.fov * Math.PI) / 360);
      skyU.uRight.value.setFromMatrixColumn(fpCam.matrixWorld, 0); skyU.uUp.value.setFromMatrixColumn(fpCam.matrixWorld, 1);
      skyU.uFwd.value.setFromMatrixColumn(fpCam.matrixWorld, 2).negate();
      pu.uScare.value = fp.flash; pu.uGhost.value = fp.ghost; pu.uCA.value = 0.6 + fp.shake * 3; pu.uVig.value = 0.7 + fp.flash * 0.2;
    } else {
      skyU.uOrtho.value = 1; skyU.uYaw.value = view.yaw; skyU.uEl.value = 0.2 - (view.pitch - 0.6) * 0.6;
      pu.uScare.value = 0; pu.uCA.value = 0.5; pu.uVig.value = document.body.classList.contains('menu-open') ? 0.85 : 0.5;
    }
    skyU.uFlash.value = f; pu.uFlash.value = f * 0.5; pu.uTime.value = t;
  }
  function render() {
    const c = fp.on ? fpCam : cam;
    c.layers.set(0); c.layers.enable(1); c.layers.enable(3);
    mainPass.camera = c;
    composer.render();
  }
  function resize(w, h, pr) {
    composer.setPixelRatio(pr); composer.setSize(w, h);
    fpCam.aspect = w / h; fpCam.updateProjectionMatrix();
    skyU.uAspect.value = w / h;
    fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    fxaa.enabled = QUALITY[q].fxaa && pr < 1.5;
  }
  function applyQuality() {
    const Q = QUALITY[q];
    bloom.enabled = Q.bloom;
    moon.shadow.mapSize.set(Q.shadow, Q.shadow);
    if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
    beam.castShadow = Q.beamShadow;
  }
  // troca entre o visual realista e o pixel art
  function setLook(pixel) {
    if (pixel && fp.on) ride(false);
    fx.visible = beamCone.visible = beam.visible = !pixel;
    moon.shadow.radius = pixel ? 1 : 2.2;
    scene.fog.color.copy(pixel ? FOG_PIXEL : HORIZON);
    C.mist.material = pixel ? C.matMist : softMist;
    renderer.toneMapping = pixel ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  }
  applyQuality();

  const api = {
    render, resize, update, afterLights, onScare, onPay, ride, setLook, audio, fpCam, onRideChange: null,
    tune: { skyU, bloom, post, mistCol, renderer, moon, hemi, beam },
    setQuality(n) { q = n; try { localStorage.setItem(Q_KEY, String(n)); } catch (e) { /* sem storage */ } applyQuality(); C.resize(); },
    faceYaw: (s) => (fp.on ? Math.atan2(fpCam.position.x - s.x, fpCam.position.z - s.z) : view.yaw),
    get riding() { return fp.on; }, get maxRatio() { return QUALITY[q].ratio; }, get quality() { return q; },
  };
  return api;
}
