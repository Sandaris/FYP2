/* eslint-disable no-undef */
/* HeroGlobe.jsx — ambient line-art globe with meteorite streaks.
   Idle eastward spin, cream/earth SVG strokes on a transparent backdrop.
   A canvas overlay adds periodic meteor streaks for a space-debris feel.
   Degrades silently if d3 is unavailable. */
const { useEffect, useRef } = React;

const HeroGlobe = ({ land = '#C49A7A', grid = 'rgba(220,215,201,0.14)', edge = 'rgba(220,215,201,0.22)' }) => {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!window.d3) return;
    const svg = d3.select(svgRef.current);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0, R = 1, world = null, raf, last = performance.now();
    let spin = -101.69 - 12;
    const tilt = -8;

    const gGrid = svg.append('path').attr('fill', 'none').attr('stroke', grid).attr('stroke-width', 0.7);
    const gLand = svg.append('path').attr('fill', 'none').attr('stroke', land)
      .attr('stroke-width', 1).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round').attr('opacity', 0.85);
    const gEdge = svg.append('circle').attr('fill', 'none').attr('stroke', edge).attr('stroke-width', 1.1);
    const graticule = d3.geoGraticule().step([15, 15])();

    function render() {
      if (!W) return;
      const proj = d3.geoOrthographic().scale(R).translate([W / 2, H / 2]).rotate([spin, tilt]).clipAngle(90).precision(0.4);
      const path = d3.geoPath(proj);
      gGrid.attr('d', path(graticule) || '');
      if (world) gLand.attr('d', path(world) || '');
      gEdge.attr('cx', W / 2).attr('cy', H / 2).attr('r', R);
    }

    function resize() {
      const el = svgRef.current; if (!el) return;
      W = el.clientWidth; H = el.clientHeight; R = Math.min(W, H) * 0.46;
      canvas.width = W; canvas.height = H;
      render();
    }

    fetch('https://unpkg.com/world-atlas@2/land-110m.json')
      .then(r => r.json())
      .then(t => { world = window.topojson.feature(t, t.objects.land); render(); })
      .catch(() => {});

    resize();
    window.addEventListener('resize', resize);

    /* ── meteorite system ── */
    const meteors = [];
    let nextSpawn = 2.2; // seconds

    function spawnMeteor() {
      // Travel from upper-right toward lower-left at ~145–165° in canvas coords
      const angleDeg = 155 + (Math.random() - 0.5) * 22;
      const angle = (angleDeg * Math.PI) / 180;
      const speed = 120 + Math.random() * 100;
      const tailLen = 50 + Math.random() * 80;
      const diag = Math.hypot(W, H);

      // Spawn from right edge (upper portion) or top edge (right portion)
      let x, y;
      if (Math.random() < 0.6) {
        x = W + 6;
        y = -12 + Math.random() * H * 0.65;
      } else {
        x = W * 0.25 + Math.random() * W * 0.8;
        y = -6;
      }

      meteors.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tailLen,
        age: 0,
        maxLife: (tailLen + diag * 0.7) / speed,
        warm: Math.random() < 0.35, // earth-tinted vs cream
      });
    }

    function drawMeteors(dt) {
      ctx.clearRect(0, 0, W, H);

      nextSpawn -= dt;
      if (nextSpawn <= 0) {
        spawnMeteor();
        nextSpawn = 2.0 + Math.random() * 2.8;
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.age += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;

        if (m.age > m.maxLife) { meteors.splice(i, 1); continue; }

        // fade in over first 0.22s, fade out over last 38% of life
        const fadeIn = Math.min(1, m.age / 0.22);
        const fadeOut = m.age > m.maxLife * 0.62
          ? 1 - (m.age - m.maxLife * 0.62) / (m.maxLife * 0.38)
          : 1;
        const alpha = fadeIn * Math.max(0, fadeOut);
        if (alpha <= 0.01) continue;

        const dir = Math.atan2(m.vy, m.vx);
        const tx = m.x - Math.cos(dir) * m.tailLen;
        const ty = m.y - Math.sin(dir) * m.tailLen;

        // gradient tail: transparent → bright at head
        const grad = ctx.createLinearGradient(tx, ty, m.x, m.y);
        if (m.warm) {
          grad.addColorStop(0, `rgba(196,154,122,0)`);
          grad.addColorStop(0.55, `rgba(210,180,155,${alpha * 0.38})`);
          grad.addColorStop(1, `rgba(237,233,225,${alpha * 0.95})`);
        } else {
          grad.addColorStop(0, `rgba(220,215,201,0)`);
          grad.addColorStop(0.55, `rgba(220,215,201,${alpha * 0.42})`);
          grad.addColorStop(1, `rgba(237,233,225,${alpha * 1.0})`);
        }

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // soft glow at the head
        const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 5);
        glow.addColorStop(0, `rgba(237,233,225,${alpha * 0.95})`);
        glow.addColorStop(0.45, `rgba(220,215,201,${alpha * 0.45})`);
        glow.addColorStop(1, `rgba(220,215,201,0)`);
        ctx.beginPath();
        ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }
    }

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      spin += dt * 4.2;
      render();
      drawMeteors(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let drag = null;
    const dom = svgRef.current;
    const down = e => { drag = { x: e.clientX, s: spin }; };
    const move = e => { if (drag) { spin = drag.s + (e.clientX - drag.x) * 0.3; } };
    const up = () => { drag = null; };
    dom.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dom && dom.removeEventListener('pointerdown', down);
      svg.selectAll('*').remove();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg ref={svgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor: 'grab' }}/>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'block' }}/>
    </div>
  );
};

Object.assign(window, { HeroGlobe });
