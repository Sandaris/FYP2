/* eslint-disable no-undef */
/* ScrollGlobe.jsx — the "unroll sphere" intro, scroll-scrubbed.
   Ports the d3 globe→equirectangular mutator from the original Intro, but the
   unroll progress `p` is driven by the user's scroll through a target section
   instead of a timeline. At rest (top) the globe idles with a slow spin; as you
   scroll it unrolls into a flat map, gently zooms toward Malaysia, and fades out
   so the hero can land on top. Degrades silently without d3. */
const { useEffect: useGlobeEffect, useRef: useGlobeRef } = React;

const ScrollGlobe = ({ targetId, lineLand = '#C49A7A', lineGrid = 'rgba(220,215,201,0.12)' }) => {
  const svgRef = useGlobeRef(null);

  useGlobeEffect(() => {
    if (!window.d3) return;
    const svg = d3.select(svgRef.current);
    let W = 0, H = 0, R0 = 1, land = null, raf;
    let spin = -101.69 - 34;            // idle longitude (near SE Asia)
    const tilt = -10;

    const clamp = (t, a = 0, b = 1) => (t < a ? a : t > b ? b : t);
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeInOut = t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    const easeInCubic = t => t * t * t;
    const smooth = t => t * t * (3 - 2 * t);

    const gGrid = svg.append('path').attr('fill', 'none');
    const gLand = svg.append('path').attr('fill', 'none').attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
    const gEdge = svg.append('circle').attr('fill', 'none');

    const _grat = d3.geoGraticule().step([12, 12]).lines();
    const meridians = _grat.filter(l => l.coordinates[0][0] === l.coordinates[1][0]);
    const parallels = _grat.filter(l => l.coordinates[0][1] === l.coordinates[1][1]);
    const angDist = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
    function gratFeature(alpha, rot) {
      if (alpha < 0.55) {
        const cl = -rot[0];
        const keep = meridians.filter(m => {
          const lng = m.coordinates[0][0];
          return angDist(lng, cl) > 7 && angDist(lng, cl + 180) > 7;
        });
        return { type: 'MultiLineString', coordinates: parallels.map(l => l.coordinates).concat(keep.map(m => m.coordinates)) };
      }
      return { type: 'MultiLineString', coordinates: _grat.map(l => l.coordinates) };
    }

    function interp(raw0, raw1) {
      const mutate = d3.geoProjectionMutator(t => (x, y) => {
        const [x0, y0] = raw0(x, y); const [x1, y1] = raw1(x, y);
        return [x0 + t * (x1 - x0), y0 + t * (y1 - y0)];
      });
      let t = 0;
      return Object.assign(mutate(t), { alpha(_) { return arguments.length ? mutate((t = +_)) : t; } });
    }

    function stateAt(p) {
      const alpha = easeInOut(clamp(p / 0.7));
      const rotT  = easeInOut(clamp(p / 0.72));
      const zoomT = easeInCubic(clamp(p / 0.9));
      const scale = R0 * (1 + 0.55 * zoomT);
      const rot = [lerp(spin, -101.69, rotT), lerp(tilt, -4, rotT)];
      const opacity = 1 - smooth(clamp((p - 0.6) / 0.33));
      return { alpha, scale, rot, opacity };
    }

    function render(p) {
      if (!W) return;
      const s = stateAt(p);
      svgRef.current.style.opacity = String(s.opacity);
      const proj = interp(d3.geoOrthographicRaw, d3.geoEquirectangularRaw)
        .scale(s.scale).translate([W / 2, H / 2]).rotate(s.rot).precision(0.5);
      proj.alpha(s.alpha);
      const path = d3.geoPath(proj);
      gGrid.attr('d', path(gratFeature(s.alpha, s.rot)) || '').attr('stroke', lineGrid).attr('stroke-width', 0.7);
      if (land) gLand.attr('d', path(land) || '').attr('stroke', lineLand).attr('stroke-width', 1).attr('opacity', 0.82);
      gEdge.attr('cx', W / 2).attr('cy', H / 2).attr('r', s.scale)
        .attr('stroke', 'rgba(220,215,201,0.18)').attr('stroke-width', 1.1)
        .attr('opacity', (1 - clamp(s.alpha * 1.8)) * 0.75);
    }

    let targetP = 0;
    function compute() {
      const el = document.getElementById(targetId); if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const runway = el.offsetHeight - window.innerHeight;
      return clamp(-rect.top / (runway || 1));
    }
    let ticking = false;
    function onScroll() { targetP = compute(); if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; render(targetP); }); } }
    function resize() { const el = svgRef.current; W = el.clientWidth; H = el.clientHeight; R0 = Math.min(W, H) * 0.42; render(targetP); }

    fetch('https://unpkg.com/world-atlas@2/land-110m.json')
      .then(r => r.json())
      .then(t => { land = window.topojson.feature(t, t.objects.land); render(targetP); })
      .catch(() => {});

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // idle spin only while parked at the top
    let last = performance.now();
    const idle = (now) => {
      const dt = (now - last) / 1000; last = now;
      if (targetP < 0.015) { spin += dt * 3.4; render(0); }
      raf = requestAnimationFrame(idle);
    };
    raf = requestAnimationFrame(idle);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      svg.selectAll('*').remove();
    };
  }, [targetId]);

  return <svg ref={svgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 1, pointerEvents: 'none' }}/>;
};

Object.assign(window, { ScrollGlobe });
