(function () {
"use strict";

const doc = document.documentElement;
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

doc.classList.add('js');

/* -------------------------------------------------------------------------
   Reveals: IntersectionObserver flips data-shown; CSS owns the resolve.
   ------------------------------------------------------------------------- */
function reveals() {
  const items = Array.from(document.querySelectorAll('[data-resolve]'));
  if (!items.length) return;

  if (reduce() || !('IntersectionObserver' in window)) {
    items.forEach((el) => {
      el.dataset.shown = 'true';
      el.style.opacity = '1';
    });
    return;
  }

  items.forEach((el) => {
    el.style.opacity = '0';
    el.dataset.shown = 'pending';
  });

  const show = (el) => {
    const group = el.closest('[data-resolve-group]');
    const list = group ? Array.from(group.querySelectorAll('[data-resolve]')) : [el];
    const i = Math.max(0, list.indexOf(el));
    el.style.setProperty('--delay', `${Math.min(i, 5) * 45}ms`);
    el.dataset.shown = 'true';
    requestAnimationFrame(() => {
      el.style.opacity = '1';
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        show(entry.target);
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 }
  );

  items.forEach((el) => io.observe(el));

  // Everything above the fold resolves immediately, in reading order, so the first
  // frame after load is the composed frame: no waiting for a scroll that may never come.
  const above = items.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.92 && r.bottom > 0;
  });
  above.forEach(show);

  // Absolute guarantee: content is never permanently invisible. The observer handles
  // normal scrolling; this timed sweep catches anything already in view that it has
  // not reported, which covers a throttled tab, a restored scroll position and an
  // engine quirk. Four passes, cheap, then it stops.
  let sweeps = 0;
  const sweep = () => {
    items.forEach((el) => {
      if (el.dataset.shown === 'true') return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) show(el);
    });
    if (++sweeps < 4) setTimeout(sweep, 700);
  };
  setTimeout(sweep, 400);

  // Anything else already visible (a restored scroll position, an instant jump) is
  // shown on load; print and a long-idle tab reveal everything rather than risk a
  // blank page.
  const settle = () => {
    items.forEach((el) => {
      if (el.dataset.shown === 'true') return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) show(el);
    });
  };
  window.addEventListener('load', () => setTimeout(settle, 300), { once: true });
  window.addEventListener('beforeprint', () => items.forEach(show));
  setTimeout(() => items.forEach(show), 20000);
}

/* -------------------------------------------------------------------------
   Primary links: the rule sweeps in from the pointer's side.
   ------------------------------------------------------------------------- */
function ruleSweep() {
  document.querySelectorAll('.link-rule').forEach((el) => {
    el.addEventListener('pointerenter', (e) => {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      el.style.setProperty('--x', `${x}%`);
    });
  });
}

/* -------------------------------------------------------------------------
   Header: solid once you leave the top, tucked away going down, back going up.
   ------------------------------------------------------------------------- */
function header() {
  const head = document.querySelector('[data-head]');
  if (!head) return;
  let last = window.scrollY;
  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    head.dataset.solid = y > 24 ? 'true' : 'false';
    const goingDown = y > last + 6;
    const goingUp = y < last - 6;
    if (goingDown && y > 240) head.dataset.tucked = 'true';
    if (goingUp || y < 120) head.dataset.tucked = 'false';
    last = y;
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
  update();
}


function survey() {
  const host = document.querySelector('[data-survey]');
  const canvas = host && host.querySelector('canvas');
  const readout = document.querySelector('[data-readout]');
  if (!host || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const css = getComputedStyle(doc);
  const accent = css.getPropertyValue('--accent').trim() || '#e83c3c';
  const ink = css.getPropertyValue('--line').trim() || '#e7dcdc';
  const hexToRgb = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgb = (hex, a) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  let w = 0;
  let h = 0;
  let dpr = 1;
  let cols = 0;
  let rows = 0;
  const cell = { w: 0, h: 0 };
  let field = null;

  // Pointer state, normalised to the canvas.
  const ptr = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45, inside: false };
  const time = { t: 0 };

  function resize() {
    const rect = host.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = w < 640 ? 13 : w < 1100 ? 18 : 24;
    cols = target;
    cell.w = w / cols;
    rows = Math.ceil(h / (cell.w * 1.15));
    cell.h = h / rows;
    field = new Float32Array(cols * rows);
  }

  function valueAt(cx, cy, t) {
    const nx = cx / cols;
    const ny = cy / rows;
    const wave =
      Math.sin(nx * 2.6 + t * 0.19) * 0.5 +
      Math.sin(ny * 3.4 - t * 0.14) * 0.4 +
      Math.sin((nx + ny) * 1.9 + t * 0.09) * 0.3;
    let v = 0.46 + wave * 0.3;

    const scan = (t % 8) / 8;
    const diag = nx * 0.68 + ny * 0.32;
    const d = Math.abs(diag - scan);
    v += Math.exp(-d * d * 210) * 0.78;

    if (ptr.inside) {
      const dx = nx - ptr.x;
      const dy = (ny - ptr.y) * (cols / rows);
      const dd = Math.sqrt(dx * dx + dy * dy);
      v += Math.exp(-dd * dd * 7) * 0.55;
    }
    return Math.max(0, Math.min(1, v));
  }

  // Discrete banding: what a model's confidence map actually looks like.
  // Most of the field is empty so the marks that are present mean something.
  function band(v) {
    return v < 0.34 ? 0 : v < 0.52 ? 1 : v < 0.68 ? 2 : v < 0.82 ? 3 : v < 0.93 ? 4 : 5;
  }

  // Light and transparent: printed annotations on white paper, not emitted light.
  // The grid is the picture; the red bands sit on it like a second pass of ink.
  const BAND_FILL = [0, 0.04, 0.075, 0.12, 0.2, 0.32];
  const BAND_EDGE = [0, 0.08, 0.14, 0.22, 0.34, 0.6];

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Hairline grid, always.
    ctx.strokeStyle = rgb(ink, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < cols; c++) {
      const x = Math.round(c * cell.w) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let r = 1; r < rows; r++) {
      const y = Math.round(r * cell.h) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Cells: faint fill, and a mark on the cells that matter.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = valueAt(c + 0.5, r + 0.5, time.t);
        field[r * cols + c] = v;
        const b = band(v);
        if (!b) continue;
        const x = c * cell.w;
        const y = r * cell.h;
        if (b >= 2) {
          ctx.fillStyle = rgb(accent, BAND_FILL[b]);
          ctx.fillRect(x + 1, y + 1, cell.w - 2, cell.h - 2);
        }
        // The three hottest bands get a corner mark, like a sample flag.
        if (b >= 3) {
          const len = Math.min(cell.w, cell.h) * 0.34;
          ctx.strokeStyle = rgb(accent, BAND_EDGE[b]);
          ctx.beginPath();
          ctx.moveTo(x + 1.5, y + 1.5 + len);
          ctx.lineTo(x + 1.5, y + 1.5);
          ctx.lineTo(x + 1.5 + len, y + 1.5);
          ctx.stroke();
        }
        // The hottest cells get a centred value tick.
        if (b === 5) {
          ctx.fillStyle = rgb(accent, 0.9);
          ctx.fillRect(x + cell.w / 2 - 1.5, y + cell.h / 2 - 1.5, 3, 3);
        }
      }
    }

    // Crosshair follows the pointer (or the drift when there is no pointer).
    const cx = ptr.x * w;
    const cy = ptr.y * h;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(Math.round(cx) + 0.5, 0);
    ctx.lineTo(Math.round(cx) + 0.5, h);
    ctx.moveTo(0, Math.round(cy) + 0.5);
    ctx.lineTo(w, Math.round(cy) + 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // A ring at the measured point.
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Corner ticks, so the frame reads as an instrument. They sweep gently while
    // the field runs, which keeps the survey visibly alive at rest.
    const sweep = Math.sin(time.t * 0.9) * 0.28 + 0.72;
    const t = 18 * sweep;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.55 + sweep * 0.35;
    ctx.beginPath();
    [
      [0, 0, 1, 1],
      [w, 0, -1, 1],
      [0, h, 1, -1],
      [w, h, -1, -1],
    ].forEach(([x, y, sx, sy]) => {
      ctx.moveTo(x + sx * 1, y + sy * t);
      ctx.lineTo(x + sx * 1, y + sy * 1);
      ctx.lineTo(x + sx * t, y + sy * 1);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // A visible frame state while the pointer is over the hero: the survey is an
  // instrument, so approaching it changes what the instrument shows.
  function setLifting(on) {
    host.toggleAttribute('data-lifting', on);
  }

  // The readout: coordinates as a position inside the field, and the value there.
  let lastRead = 0;
  function readoutUpdate() {
    if (!readout) return;
    const now = performance.now();
    if (now - lastRead < 70) return;
    lastRead = now;

    const c = Math.min(cols - 1, Math.max(0, Math.floor(ptr.x * cols)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(ptr.y * rows)));
    const v = field && field.length ? field[r * cols + c] : valueAt(ptr.x * cols, ptr.y * rows, time.t);

    const set = (sel, text) => {
      const el = readout.querySelector(sel);
      if (el && el.textContent !== text) el.textContent = text;
    };
    set('[data-read-x]', String(Math.round(ptr.x * 1000)).padStart(4, '0'));
    set('[data-read-y]', String(Math.round(ptr.y * 1000)).padStart(4, '0'));
    set('[data-read-v]', v.toFixed(2));
    const state = readout.querySelector('[data-read-state]');
    if (state) {
      const next = band(v) >= 4 ? 'Reference' : band(v) >= 2 ? 'Sampling' : 'Idle';
      if (state.textContent !== next) state.textContent = next;
    }
  }

  // One clock.
  let raf = 0;
  let visible = false;
  let paused = false;
  let last = 0;

  // Pause control: the concept's ambient motion is pausable (WCAG 2.2.2). When
  // paused the field holds its last frame; the pointer still steers it, because
  // that motion is the visitor's own, not the site's.
  const toggle = document.querySelector('[data-survey-toggle]');
  const setPaused = (next) => {
    paused = next;
    if (!toggle || toggle.hidden) return;
    toggle.setAttribute('aria-pressed', String(paused));
    const label = toggle.querySelector('[data-survey-label]');
    if (label) label.textContent = paused ? 'Resume survey' : 'Pause survey';
    if (paused) stop();
    else if (visible || !raf) start();
  };
  if (toggle) toggle.addEventListener('click', () => setPaused(!paused));

  function tick(ts) {
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
    last = ts;
    time.t += dt;

    // Idle drift: with no pointer the crosshair rides the scan line itself, so
    // the crosshair and the hot cells always agree. It is one instrument, not two
    // moving things. Over a full sweep it reads as sampling the field.
    let tx = ptr.tx;
    let ty = ptr.ty;
    if (!ptr.inside) {
      const scan = (time.t % 8) / 8;
      tx = Math.min(0.9, Math.max(0.08, (scan - 0.32 * 0.3) / 0.68));
      ty = Math.min(0.72, Math.max(0.14, (scan - 0.68 * (scan - 0.32 * 0.3) / 0.68) / 0.32));
    }
    const k = 1 - Math.pow(0.001, dt);
    ptr.x += (tx - ptr.x) * k;
    ptr.y += (ty - ptr.y) * k;

    draw();
    readoutUpdate();
  }

  function start() {
    if (raf || reduce() || paused) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // Draw the resting frame (this is also the reduced-motion frame).
  resize();
  field = new Float32Array(cols * rows);
  ptr.x = 0.62;
  ptr.y = 0.44;
  time.t = 1.4;
  draw();
  readoutUpdate();

  if (reduce()) {
    // A single still frame, composed on purpose. No loop, no observers needed.
    let rT;
    window.addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => {
        resize();
        ptr.x = 0.62;
        ptr.y = 0.44;
        draw();
        readoutUpdate();
      }, 150);
    });
    return;
  }

  // The pause control exists only where there is motion to pause. Hiding it in CSS
  // is not enough: it would stay in the tab order while no motion runs.
  const motionOn = !reduce() && window.matchMedia('(hover: hover)').matches;
  if (toggle && !motionOn) {
    toggle.hidden = true;
  }

  // Primary targets answer in motion, not colour. Where the pointer enters from,
  // decides which side the rule grows from and which way the glyph travels.
  document.querySelectorAll('.link-rule').forEach((el) => {
    el.addEventListener('pointerenter', (e) => {
      const r = el.getBoundingClientRect();
      const fromLeft = e.clientX - r.left < r.width / 2;
      el.toggleAttribute('data-from-right', !fromLeft);
    });
  });

  // Pointer input (fine pointers only; touch keeps the idle survey). The hero is
  // the listening surface, so moving anywhere over it steers the survey, not just
  // the slivers where the canvas is exposed.
  const surface = host.parentElement;
  if (fine()) {
    surface.addEventListener(
      'pointermove',
      (e) => {
        const r = canvas.getBoundingClientRect();
        ptr.tx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        ptr.ty = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        ptr.inside = true;
      },
      { passive: true }
    );
    surface.addEventListener('pointerenter', () => setLifting(true));
    surface.addEventListener('pointerleave', () => {
      ptr.inside = false;
      setLifting(false);
    });
  }

  // Run only while on screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0.01 }
    );
    io.observe(host);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  let rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      resize();
      if (!raf) draw();
    }, 150);
  });
}

/* ------------------------------------------------------------------------- */
function init() {
  header();
  reveals();
  ruleSweep();
  survey();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

})();
