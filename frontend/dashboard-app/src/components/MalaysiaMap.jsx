/* MalaysiaMap.jsx — interactive SVG choropleth of Malaysia.
   Region/state selection animates the viewBox; the user can additionally
   scroll-wheel to zoom (anchored on the cursor) and drag to pan. */
import { useEffect, useRef, useState, useCallback, Fragment } from 'react'
import { C } from '@/lib/colors'
import { boxToView } from '@/lib/malaysiaGeo'

const REGION_LABEL = { west: 'West Malaysia', east: 'East Malaysia' };

// Federal-territory enclaves and their neighbours sit almost on top of each
// other in the Klang Valley, so their centroid labels collide. Nudge them
// apart (values in label em-units, scaled with the current zoom).
const LABEL_OFFSET = {
  'Selangor':         { dx: -1.4, dy: -1.5 },
  'Kuala Lumpur':     { dx:  1.7, dy: -0.2 },
  'Putrajaya':        { dx:  2.1, dy:  1.1 },
  'Negeri Sembilan':  { dx:  0.9, dy:  2.2 },
};

// ----- Monsoon wind streaks --------------------------------------------
// Light directional lines drifting across the sea to evoke Malaysia's
// seasonal monsoon: the whole field blows Northeast for 30s, then reverses
// to Southwest for the next 30s, and so on. At each switch the streaks
// collapse to a single dot, then re-grow flowing the opposite way (no
// U-turn). Drawn behind the land so they never cover the islands.
const WIND_PERIOD = 30000;          // 30s per monsoon phase
const WIND_COLLAPSE = 1500;         // ms each side of a switch for dot collapse
const NE_ANG = -Math.PI / 4;        // blows toward upper-right (Northeast)
const SW_ANG =  Math.PI * 3 / 4;    // blows toward lower-left (Southwest)
const windSmooth = (u) => u * u * (3 - 2 * u);
// Discrete wind direction for the current 30s phase (flips instantly — the
// flip is hidden because the streaks are collapsed to dots at that instant).
function windAngle(t) {
  return Math.floor(t / WIND_PERIOD) % 2 === 0 ? NE_ANG : SW_ANG;
}
// Length factor 1 → 0 → 1 across each phase boundary: streaks shrink to a
// dot exactly at the switch, then expand again flowing the reverse way.
function windLenFactor(t) {
  const nearest = Math.round(t / WIND_PERIOD) * WIND_PERIOD;
  const d = Math.abs(t - nearest);
  return d >= WIND_COLLAPSE ? 1 : windSmooth(d / WIND_COLLAPSE);
}
// One faint wind streak with its own length, speed, wobble and opacity.
function makeStreak(W, H) {
  return {
    x: Math.random() * W, y: Math.random() * H,
    len: 30 + Math.random() * 64,
    speed: 16 + Math.random() * 30,      // px / second
    w: 1.1 + Math.random() * 1.1,
    a: 0.16 + Math.random() * 0.20,      // bolder, clearly visible
    phase: Math.random() * Math.PI * 2,
    amp: 1.5 + Math.random() * 5,
  };
}
// Draws a streak as a gently waving, head-bright / tail-faded line.
// lenScale (0–1) shrinks the streak toward its head; at ~0 it renders as a
// single dot so the field can collapse before reversing direction.
function drawStreak(ctx, s, ang, t, lenScale = 1) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const L = s.len * lenScale;
  // collapsed → draw a single dot at the head
  if (L < 1.6) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(s.w * 0.85, 1.1), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(94,62,38,${s.a})`;
    ctx.fill();
    return;
  }
  const px = -dy, py = dx;             // perpendicular for the wobble
  const N = 6;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const along = -L * u;              // head (0) back to tail (-L)
    const wob = Math.sin(s.phase + u * 3 + t * 0.0016) * s.amp * u;
    const X = s.x + dx * along + px * wob;
    const Y = s.y + dy * along + py * wob;
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  const g = ctx.createLinearGradient(s.x, s.y, s.x + dx * -L, s.y + dy * -L);
  g.addColorStop(0, `rgba(94,62,38,${s.a})`);   // head — deep earth
  g.addColorStop(1, 'rgba(94,62,38,0)');         // tail dissolves
  ctx.strokeStyle = g;
  ctx.lineWidth = s.w;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ----- Aerial coastal ocean --------------------------------------------
// A calm, top-down aerial sea: a pale cyan-teal wash with clean off-white
// current lines parallel to the coast and organic foam patches that drift
// slowly and press toward the shore, fading into the parchment at the edges.
const OCEAN_WASH_TOP = 'rgba(150,184,178,0.44)';
const OCEAN_WASH_BOT = 'rgba(196,214,206,0.30)';
const FOAM_RGB = '244,241,230'; // warm off-white

function _oceanCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// geo→device transform matching the SVG's viewBox + xMidYMid meet
function _landTransform(W, H, dpr, vb) {
  const scale = Math.min(W / vb.w, H / vb.h);
  return {
    a: dpr * scale,
    e: dpr * ((W - vb.w * scale) / 2 - vb.x * scale),
    f: dpr * ((H - vb.h * scale) / 2 - vb.y * scale),
    scale,
  };
}
// cache one Path2D per district (keyed on the geo object)
function _landPaths(geo) {
  if (geo.__oceanPaths) return geo.__oceanPaths;
  const arr = [];
  for (const st of geo.states) for (const d of st.districts) arr.push(new Path2D(d.d));
  geo.__oceanPaths = arr;
  return arr;
}
// Render the land (fill or stroke) into an offscreen, then blur it → a soft
// white silhouette/ring used as an alpha mask for the water.
function _buildLandMask(W, H, dpr, vb, geo, blurCss, paint) {
  const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
  const tmp = _oceanCanvas(pw, ph), tx = tmp.getContext('2d');
  const T = _landTransform(W, H, dpr, vb);
  tx.setTransform(T.a, 0, 0, T.a, T.e, T.f);
  paint(tx, T, _landPaths(geo));
  const out = _oceanCanvas(pw, ph), ox = out.getContext('2d');
  ox.filter = `blur(${Math.max(0.01, blurCss * dpr)}px)`;
  ox.drawImage(tmp, 0, 0);
  return out;
}

function _smooth(e0, e1, x) {
  let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
// compact value noise — used only to break contour lines into organic streaks
function _h2(x, y) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function _vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = _h2(xi, yi), b = _h2(xi + 1, yi), c = _h2(xi, yi + 1), d = _h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Build the coastline distance field once, then extract:
//  • contour — concentric off-white current lines parallel to the coast,
//    brightest near the shore and fading outward (clean top-down linework)
//  • field  — a low-res sample (1 at the coast → 0 offshore) to bias/brighten
//    foam toward the shoreline
function buildContour(W, H, dpr, vb, geo) {
  const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
  const sil = _oceanCanvas(pw, ph), sx = sil.getContext('2d');
  const T = _landTransform(W, H, dpr, vb);
  sx.setTransform(T.a, 0, 0, T.a, T.e, T.f);
  sx.fillStyle = '#fff';
  for (const p of _landPaths(geo)) sx.fill(p);
  // blurred silhouette → smooth field that falls off around the coast
  const fld = _oceanCanvas(pw, ph), fx = fld.getContext('2d');
  fx.filter = `blur(${68 * dpr}px)`;
  fx.drawImage(sil, 0, 0);
  const fdata = fx.getImageData(0, 0, pw, ph).data;
  // contour lines from iso-levels of the field (lines parallel to the coast)
  const out = _oceanCanvas(pw, ph), ox = out.getContext('2d');
  const oimg = ox.createImageData(pw, ph), od = oimg.data;
  const levels = [0.78, 0.62, 0.48, 0.36, 0.26, 0.17, 0.10];
  const hw = 0.05;
  for (let i = 0; i < pw * ph; i++) {
    const a = fdata[i * 4 + 3] / 255;
    if (a >= 0.96 || a <= 0.015) continue;        // inside land / far open sea
    let v = 0;
    for (let k = 0; k < levels.length; k++) {
      const d = Math.abs(a - levels[k]);
      if (d < hw) { const s = 1 - d / hw; if (s > v) v = s; }
    }
    if (v <= 0) continue;
    const inten = v * Math.min(1, a * 1.35);       // brighter near shore
    const o = i * 4;
    od[o] = 240; od[o + 1] = 238; od[o + 2] = 226;
    od[o + 3] = Math.round(Math.min(1, inten) * 200);
  }
  ox.putImageData(oimg, 0, 0);
  // low-res field for foam biasing (CSS-px grid)
  const cell = 6;
  const lw = Math.max(1, Math.ceil(W / cell)), lh = Math.max(1, Math.ceil(H / cell));
  const field = new Float32Array(lw * lh);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const px = Math.min(pw - 1, Math.round((x * cell + cell / 2) * dpr));
      const py = Math.min(ph - 1, Math.round((y * cell + cell / 2) * dpr));
      field[y * lw + x] = fdata[(py * pw + px) * 4 + 3] / 255;
    }
  }
  return { contour: out, field, lw, lh, cell };
}
// One organic, stretched foam patch (wobbly — never a clean circle).
function makeBlob(W, H) {
  const N = 9, pts = [];
  for (let k = 0; k < N; k++) pts.push(0.5 + Math.random() * 0.7);
  return {
    x: Math.random() * W, y: Math.random() * H,
    r: 11 + Math.random() * 30,
    elong: 1.3 + Math.random() * 1.8,
    rot: Math.random() * Math.PI,
    vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 4,
    ph: Math.random() * Math.PI * 2,
    a: 0.20 + Math.random() * 0.22,
    pts,
  };
}
function drawBlob(ctx, b, t, mult) {
  const a = b.a * mult * (0.6 + 0.4 * Math.sin(t * 0.0005 + b.ph));
  if (a <= 0.01) return;
  ctx.save();
  ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.scale(b.elong, 1);
  const N = b.pts.length;
  ctx.beginPath();
  for (let k = 0; k <= N; k++) {
    const i = k % N, ang = (i / N) * Math.PI * 2, rr = b.r * b.pts[i];
    const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
    k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r);
    g.addColorStop(0, `rgba(246,243,232,${a})`);
    g.addColorStop(0.6, `rgba(238,233,216,${a * 0.55})`);
    g.addColorStop(1, 'rgba(238,233,216,0)');
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
// Soft radial vignette (device res) → fades the whole sea at container edges.
function buildEdgeMask(W, H, dpr) {
  const c = _oceanCanvas(Math.max(1, Math.round(W * dpr)), Math.max(1, Math.round(H * dpr)));
  const x = c.getContext('2d');
  const cx = c.width / 2, cy = c.height / 2;
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(c.width, c.height) * 0.66);
  g.addColorStop(0, '#fff'); g.addColorStop(0.58, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  return c;
}

const MalaysiaMap = ({
  geo, selectedState, selectedDistrict, region = 'west',
  onSelectState, onSelectDistrict, onRegionChange,
}) => {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const windRef = useRef(null);
  const oceanRef = useRef(null);
  const [hoverState, setHoverState] = useState(null);
  const [hoverDistrict, setHoverDistrict] = useState(null);
  const [tip, setTip] = useState(null); // {x,y,label}

  const stateObj = selectedState ? geo.byName[selectedState] : null;
  const target = stateObj
    ? boxToView(stateObj.bbox, 0.24)
    : boxToView(geo.regions[region], 0.10);

  // ----- controllable viewBox (state + ref mirror so handlers read live value) -----
  const [vb, setVbState] = useState(target);
  const vbRef = useRef(vb);
  const rafRef = useRef(null);
  const setVb = useCallback((upd) => {
    const next = typeof upd === 'function' ? upd(vbRef.current) : upd;
    vbRef.current = next; setVbState(next);
  }, []);

  const animateTo = useCallback((to) => {
    cancelAnimationFrame(rafRef.current);
    const from = vbRef.current;
    const start = performance.now();
    const dur = 720;
    const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = ease(t);
      setVb({
        x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e,
        w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e,
      });
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [setVb]);

  // re-fit whenever the target (region / selected state) changes
  useEffect(() => {
    animateTo(target);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.x, target.y, target.w, target.h]);

  const strokeW = (vb.w / geo.W); // keep strokes/labels visually scaled while zoomed

  // ----- monsoon wind streaks: removed (kept disabled for a clean ocean) -----
  useEffect(() => {
    const canvas = windRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return undefined;
  }, []);

  // ----- (legacy wind animation, no longer mounted) -----
  const _windDisabled = () => {
    const canvas = windRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf, running = true, W = 0, H = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const M = 70; // wrap margin
    const streaks = [];
    const target = () => Math.round((W * H) / 17000); // density scales with area
    const sync = () => {
      const n = Math.max(40, Math.min(150, target()));
      while (streaks.length < n) streaks.push(makeStreak(W, H));
      if (streaks.length > n) streaks.length = n;
    };
    // Paint one frame at angle for time t (no position advance).
    const paint = (t) => {
      const ang = reduce ? NE_ANG : windAngle(t);
      const lf = reduce ? 1 : windLenFactor(t);
      ctx.clearRect(0, 0, W, H);
      for (const s of streaks) drawStreak(ctx, s, ang, t, lf);
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sync();
      paint(performance.now()); // always leave a visible frame after layout
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    if (reduce) {
      return () => { running = false; ro.disconnect(); };
    }

    let prev = performance.now();
    const tick = (t) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
      const ang = windAngle(t);
      const lf = windLenFactor(t);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      sync();
      ctx.clearRect(0, 0, W, H);
      // monsoon wind streaks
      for (const s of streaks) {
        s.x += dx * s.speed * dt;
        s.y += dy * s.speed * dt;
        if (s.x < -M) s.x = W + M; else if (s.x > W + M) s.x = -M;
        if (s.y < -M) s.y = H + M; else if (s.y > H + M) s.y = -M;
        drawStreak(ctx, s, ang, t, lf);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
  };

  // ----- aerial ocean (current lines + drifting foam patches around the coast) -----
  useEffect(() => {
    const canvas = oceanRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let raf, running = true, W = 0, H = 0;

    const scratch = document.createElement('canvas'), sctx = scratch.getContext('2d');
    let contour = null, field = null, lw = 0, lh = 0, cell = 6, edgeMask = null;
    let bakedSig = '', pendingSig = '', pendingT = 0;
    let blobs = [];

    const sig = (vb) => `${W}x${H}|${vb.x.toFixed(1)},${vb.y.toFixed(1)},${vb.w.toFixed(1)},${vb.h.toFixed(1)}`;
    const bake = (vb) => {
      const r = buildContour(W, H, dpr, vb, geo);
      contour = r.contour; field = r.field; lw = r.lw; lh = r.lh; cell = r.cell;
      bakedSig = sig(vb);
    };
    const fieldAt = (x, y) => {
      if (!field) return 0;
      const ix = Math.max(0, Math.min(lw - 1, (x / cell) | 0));
      const iy = Math.max(0, Math.min(lh - 1, (y / cell) | 0));
      return field[iy * lw + ix];
    };
    const buildBlobs = () => {
      const n = Math.max(44, Math.min(120, Math.round((W * H) / 9000)));
      blobs = []; let guard = 0;
      while (blobs.length < n && guard < n * 14) {
        guard++;
        const b = makeBlob(W, H);
        // bias toward the coast: keep with probability rising near shore
        if (Math.random() < 0.22 + 0.78 * fieldAt(b.x, b.y)) blobs.push(b);
      }
    };

    const render = (t) => {
      const vb = vbRef.current;
      // debounce the re-bake so zoom/pan stays smooth (rebake once settled)
      const cs = sig(vb);
      if (cs !== bakedSig) {
        if (cs !== pendingSig) { pendingSig = cs; pendingT = t; }
        else if (t - pendingT > 170) { bake(vb); buildBlobs(); }
      }
      if (!contour || !edgeMask) return;
      const pw = canvas.width, ph = canvas.height;

      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1;
      sctx.filter = 'none';
      sctx.clearRect(0, 0, W, H);

      // 1 — pale cyan water wash
      const g = sctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, OCEAN_WASH_TOP); g.addColorStop(1, OCEAN_WASH_BOT);
      sctx.fillStyle = g; sctx.fillRect(0, 0, W, H);

      // 2 — aerial current lines, breathing gently in/out around the island
      const s = 1 + 0.010 * Math.sin(t * 0.00016);
      const cx = W / 2, cy = H / 2;
      sctx.save();
      sctx.translate(cx, cy); sctx.scale(s, s); sctx.translate(-cx, -cy);
      sctx.globalAlpha = 0.80 + 0.16 * Math.sin(t * 0.00035);
      sctx.drawImage(contour, 0, 0, W, H);
      sctx.restore();
      sctx.globalAlpha = 1;

      // 3 — organic foam patches, brighter near the coast (light softening blur)
      sctx.filter = 'blur(0.7px)';
      for (const b of blobs) drawBlob(sctx, b, t, 0.5 + 1.2 * fieldAt(b.x, b.y));
      sctx.filter = 'none';

      // fade the whole sea softly toward the container edges
      sctx.globalCompositeOperation = 'destination-in';
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.drawImage(edgeMask, 0, 0);
      sctx.globalCompositeOperation = 'source-over';

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(scratch, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
      canvas.width = pw; canvas.height = ph;
      scratch.width = pw; scratch.height = ph;
      edgeMask = buildEdgeMask(W, H, dpr);
      bake(vbRef.current); buildBlobs();
      render(performance.now()); // leave a visible frame after layout
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    if (reduce) {
      render(performance.now());
      return () => { running = false; ro.disconnect(); };
    }

    let prev = performance.now();
    const tick = (t) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
      // drift foam slowly + a gentle shoreward push (up the field gradient)
      for (const b of blobs) {
        const gx = fieldAt(b.x + cell, b.y) - fieldAt(b.x - cell, b.y);
        const gy = fieldAt(b.x, b.y + cell) - fieldAt(b.x, b.y - cell);
        const gl = Math.hypot(gx, gy) || 1;
        b.x += (b.vx + 7 * gx / gl) * dt;
        b.y += (b.vy + 7 * gy / gl) * dt;
        if (b.x < -40) b.x = W + 40; else if (b.x > W + 40) b.x = -40;
        if (b.y < -40) b.y = H + 40; else if (b.y > H + 40) b.y = -40;
      }
      render(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  // ----- zoom (cursor-anchored, accounts for preserveAspectRatio="meet" letterboxing) -----
  const Z_MIN = geo.W * 0.035, Z_MAX = geo.W * 1.9;
  const fitScale = (rect, w, h) => Math.min(rect.width / w, rect.height / h);
  const zoomAt = useCallback((cx, cy, factor) => {
    cancelAnimationFrame(rafRef.current);
    const rect = svgRef.current.getBoundingClientRect();
    setVb(v => {
      let nw = Math.max(Z_MIN, Math.min(Z_MAX, v.w * factor));
      const nh = nw * (v.h / v.w);
      const s = fitScale(rect, v.w, v.h);
      const offX = (rect.width - v.w * s) / 2, offY = (rect.height - v.h * s) / 2;
      const wx = v.x + (cx - offX) / s, wy = v.y + (cy - offY) / s;
      const ns = fitScale(rect, nw, nh);
      const noffX = (rect.width - nw * ns) / 2, noffY = (rect.height - nh * ns) / 2;
      return { x: wx - (cx - noffX) / ns, y: wy - (cy - noffY) / ns, w: nw, h: nh };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVb]);
  const centerZoom = (factor) => {
    const rect = svgRef.current.getBoundingClientRect();
    zoomAt(rect.width / 2, rect.height / 2, factor);
  };

  // non-passive wheel listener so we can preventDefault the page scroll
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY > 0 ? 1.12 : 1 / 1.12);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [zoomAt]);

  // ----- drag to pan (with click suppression so a drag never mis-selects) -----
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x, dy = e.clientY - dragRef.current.y;
    if (!movedRef.current && Math.hypot(dx, dy) < 4) return;
    movedRef.current = true;
    dragRef.current = { x: e.clientX, y: e.clientY };
    cancelAnimationFrame(rafRef.current);
    const rect = svgRef.current.getBoundingClientRect();
    setVb(v => {
      const s = fitScale(rect, v.w, v.h);
      return { ...v, x: v.x - dx / s, y: v.y - dy / s };
    });
  };
  const endDrag = () => {
    if (movedRef.current) {
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 60);
    }
    dragRef.current = null;
  };

  const move = useCallback((e, label) => {
    const rect = wrapRef.current.getBoundingClientRect();
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, label });
  }, []);

  return (
    <div ref={wrapRef} style={{
      position: 'relative', width: '100%', height: '100%',
      cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none',
      backgroundColor: C.cream,
      // Line-art ground that echoes the intro globe: a soft parchment light pool
      // overlaid with a faint forest-line graticule (lat/lng grid), so the
      // location map continues the globe's wireframe aesthetic — no sea.
      backgroundImage: [
        `linear-gradient(to right, ${C.deep}12 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${C.deep}12 1px, transparent 1px)`,
        `radial-gradient(120% 90% at 50% 44%, ${C.raised} 0%, rgba(237,233,225,0) 60%)`,
      ].join(', '),
      backgroundSize: '64px 64px, 64px 64px, 100% 100%',
      backgroundPosition: 'center, center, center',
    }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onMouseLeave={() => { setHoverState(null); setHoverDistrict(null); setTip(null); endDrag(); }}>
      {/* No sea — the location map is pure line-art on parchment, continuing the
          intro globe's wireframe look. The faint graticule lives on the wrapper. */}
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} width="100%" height="100%"
        style={{ display: 'block', background: 'transparent', position: 'relative' }}
        preserveAspectRatio="xMidYMid meet">
        <g>
        {geo.states.map(st => {
          const isSel = st.name === selectedState;
          const isHov = st.name === hoverState;
          const dim = selectedState && !isSel;
          return (
            <g key={st.name}>
              {st.districts.map(d => {
                const distSel = isSel && d.name === selectedDistrict;
                const distHov = isSel && d.name === hoverDistrict;
                let fill, stroke;
                if (isSel) {
                  // state view — districts as line-art; the picked or hovered
                  // one gets a faint warm wash, the rest stay open parchment.
                  fill = distSel || distHov ? C.earthFaint : C.cream;
                  stroke = distSel || distHov ? C.earth : C.mid;
                } else if (dim) {
                  // other states while one is selected — faint outlines only
                  fill = C.cream; stroke = C.border;
                } else {
                  // country view — each state is a line-art outline on parchment
                  fill = isHov ? C.earthFaint : C.cream;
                  stroke = isHov ? C.earth : C.mid;
                }
                return (
                  <path key={d.name} d={d.d}
                    data-state={st.name} data-district={d.name}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={(isSel ? (distSel || distHov ? 1.4 : 1.0) : (isHov ? 1.4 : 0.9)) * strokeW}
                    strokeLinejoin="round"
                    opacity={dim ? 0.45 : 1}
                    style={{ cursor: 'pointer', transition: 'fill .18s, stroke .18s, stroke-width .18s' }}
                    onMouseEnter={(e) => {
                      if (isSel) { setHoverDistrict(d.name); move(e, d.name); }
                      else { setHoverState(st.name); move(e, st.name); }
                    }}
                    onMouseMove={(e) => move(e, isSel ? d.name : st.name)}
                    onMouseLeave={() => { setHoverDistrict(null); if (!isSel) setHoverState(null); setTip(null); }}
                    onClick={() => {
                      if (suppressClickRef.current) return;
                      if (isSel) onSelectDistrict(d.name);
                      else onSelectState(st.name);
                    }}
                  />
                );
              })}
            </g>
          );
        })}
        </g>

        {/* country-view state labels */}
        {!selectedState && geo.states.map(st => {
          const off = LABEL_OFFSET[st.name];
          const em = Math.max(7, 9 * strokeW); // label font size in view units
          const cx = st.centroid[0] + (off ? off.dx * em : 0);
          const cy = st.centroid[1] + (off ? off.dy * em : 0);
          return (
            <g key={'lbl' + st.name} style={{ pointerEvents: 'none' }}>
              {off && (
                <line x1={st.centroid[0]} y1={st.centroid[1]} x2={cx} y2={cy}
                  stroke={C.deep} strokeWidth={0.5 * strokeW} opacity={0.35}/>
              )}
              <text x={cx} y={cy}
                textAnchor="middle" dominantBaseline="middle"
                fontFamily="'DM Sans', sans-serif"
                fontSize={em}
                fontWeight="700"
                fill={hoverState === st.name ? C.cream : C.deep}
                opacity={1}>
                {st.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* tooltip */}
      {tip && (
        <div style={{
          position: 'absolute', left: tip.x + 14, top: tip.y + 12,
          background: C.deep, color: C.cream, padding: '5px 10px',
          borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 12,
          fontWeight: 500, pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(44,57,48,.28)', zIndex: 5,
        }}>{tip.label}</div>
      )}

      {/* zoomed-in chrome */}
      {selectedState ? (
        <button onClick={() => onSelectState(null)} style={{
          position: 'absolute', top: 16, right: 16,
          display: 'flex', alignItems: 'center', gap: 6,
          background: C.cream, border: `1px solid ${C.border}`,
          color: C.deep, borderRadius: 9999, padding: '9px 16px',
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 3px 12px rgba(44,57,48,.16)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to {REGION_LABEL[region]}
        </button>
      ) : (
        <Fragment>
          {/* region toggle pills */}
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 4, background: C.cream, padding: 4,
            borderRadius: 9999, border: `1px solid ${C.border}`,
            boxShadow: '0 3px 12px rgba(44,57,48,.14)',
          }}>
            {['west', 'east'].map(r => (
              <button key={r} onClick={() => onRegionChange(r)} style={{
                border: 0, borderRadius: 9999, padding: '7px 16px',
                background: region === r ? C.deep : 'transparent',
                color: region === r ? C.cream : C.mid,
                fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap',
              }}>{REGION_LABEL[r]}</button>
            ))}
          </div>

          {/* big edge arrow to the other region */}
          {region === 'west' ? (
            <EdgeArrow side="right" label="East Malaysia"
              onClick={() => onRegionChange('east')}/>
          ) : (
            <EdgeArrow side="left" label="West Malaysia"
              onClick={() => onRegionChange('west')}/>
          )}
        </Fragment>
      )}

      {/* zoom controls */}
      <div style={{
        position: 'absolute', right: 16, bottom: 52, zIndex: 6,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <ZoomBtn label="Zoom in" onClick={() => centerZoom(1 / 1.3)}>
          <line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/>
        </ZoomBtn>
        <ZoomBtn label="Zoom out" onClick={() => centerZoom(1.3)}>
          <line x1="6" y1="12" x2="18" y2="12"/>
        </ZoomBtn>
        <ZoomBtn label="Reset view" onClick={() => animateTo(target)}>
          <path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 8 7 8"/>
        </ZoomBtn>
      </div>

      <div style={{
        position: 'absolute', bottom: 14, right: 16,
        fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: C.mid,
        background: 'rgba(237,233,225,.82)', padding: '5px 11px', borderRadius: 7,
        pointerEvents: 'none', border: `1px solid ${C.border}`,
      }}>
        {selectedState
          ? `${selectedState} — ${stateObj.districts.length} districts · scroll to zoom · drag to pan`
          : `${REGION_LABEL[region]} · click a state · scroll to zoom · drag to pan`}
      </div>
    </div>
  );
};

const ZoomBtn = ({ children, onClick, label }) => (
  <button onClick={onClick} title={label} aria-label={label} style={{
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.cream, border: `1px solid ${C.border}`, borderRadius: 9,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(44,57,48,.14)', color: C.deep,
  }}
    onMouseEnter={e => e.currentTarget.style.background = C.raised}
    onMouseLeave={e => e.currentTarget.style.background = C.cream}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  </button>
);

const EdgeArrow = ({ side, label, onClick }) => (
  <button onClick={onClick}
    title={`Go to ${label}`}
    style={{
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      [side]: 18,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      background: C.cream, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '16px 12px', cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(44,57,48,.16)', transition: 'transform .18s, box-shadow .18s',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = `translateY(-50%) translateX(${side === 'right' ? 4 : -4}px)`; e.currentTarget.style.boxShadow = '0 6px 22px rgba(44,57,48,.24)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(-50%)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(44,57,48,.16)'; }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.deep}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {side === 'right'
        ? <polyline points="9 6 15 12 9 18"/>
        : <polyline points="15 6 9 12 15 18"/>}
    </svg>
    <span style={{
      writingMode: 'vertical-rl', transform: side === 'left' ? 'rotate(180deg)' : 'none',
      fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700,
      letterSpacing: '.06em', color: C.deep, textTransform: 'uppercase',
    }}>{label}</span>
  </button>
);

export default MalaysiaMap
