/**
 * OnniCode Landing Site — Scroll, Reveal, Pointer & Theme Choreographer
 * Zero-dependency ES module (~200 lines). Works from file:// and static servers.
 *
 * Contract:
 * - [data-reveal]           -> IntersectionObserver adds .is-in once
 * - [data-stage]            -> writes --p in [0..1], dispatches 'stage:progress' { p, step }
 * - [data-steps="N"]        -> writes data-step="0..N-1" and --step on [data-stage]
 * - .hairline-card          -> pointer tracker writes --mx / --my (px) on hover
 * - [data-theme-toggle]     -> flips html[data-theme] dark <-> light, persists, swaps img[data-scene]
 */

const STORAGE_KEY = 'onni-landing-theme';
const root = document.documentElement;
root.classList.add('js-ready');

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let isReducedMotion = reducedMotionQuery.matches;

const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

/* ---------- Theme Toggle & Scenery Variant Swapper ---------- */

function readStoredTheme() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* file:// or private mode with blocked storage degrades gracefully */
  }
}

function swapSceneImages(theme) {
  const targetSuffix = theme === 'light' ? '-light.' : '-dark.';
  const scenes = document.querySelectorAll('img[data-scene]');
  for (const img of scenes) {
    const explicit = img.getAttribute(`data-src-${theme}`);
    if (explicit) {
      if (img.getAttribute('src') !== explicit) img.setAttribute('src', explicit);
      continue;
    }
    const currentSrc = img.getAttribute('src') || '';
    const nextSrc = currentSrc.replace(/-(dark|light)\.(png|webp|jpg|svg)$/i, `${targetSuffix}$2`);
    if (nextSrc && nextSrc !== currentSrc) {
      img.setAttribute('src', nextSrc);
    }
  }
}

function applyTheme(theme, persist = false) {
  const resolved = theme === 'light' ? 'light' : 'dark';
  root.dataset.theme = resolved;
  root.classList.toggle('light', resolved === 'light');
  if (persist) writeStoredTheme(resolved);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', resolved === 'light' ? '#fafafa' : '#090909');
  }

  const toggles = document.querySelectorAll('[data-theme-toggle]');
  for (const btn of toggles) {
    btn.setAttribute('aria-pressed', String(resolved === 'light'));
    const label = btn.querySelector('[data-theme-label]');
    if (label) label.textContent = resolved === 'light' ? 'Daylight' : 'Night';
  }

  swapSceneImages(resolved);
}

const initialTheme = root.dataset.theme || readStoredTheme() || 'dark';
applyTheme(initialTheme, false);

document.addEventListener('click', (event) => {
  const toggleBtn = event.target.closest('[data-theme-toggle]');
  if (toggleBtn) {
    const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme, true);
    return;
  }

  const stepBtn = event.target.closest('[data-step-target]');
  if (stepBtn) {
    const stageEl = stepBtn.closest('[data-stage]');
    const targetStep = Number.parseInt(stepBtn.dataset.stepTarget || '0', 10);
    if (stageEl && !Number.isNaN(targetStep)) {
      scrollToStageStep(stageEl, targetStep);
    }
  }
});

/* ---------- One-shot Reveal Observer ([data-reveal]) ---------- */

const revealEls = Array.from(document.querySelectorAll('[data-reveal], .reveal'));

if (isReducedMotion || !('IntersectionObserver' in window)) {
  for (const el of revealEls) el.classList.add('is-in');
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );
  for (const el of revealEls) revealObserver.observe(el);
}

/* ---------- Pinned Stage Playhead ([data-stage]) ---------- */

const headerEl = document.querySelector('.site-header, header');
const stageRecords = [];

function measureLayout() {
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const stageNodes = document.querySelectorAll('[data-stage]');
  stageRecords.length = 0;

  for (const el of stageNodes) {
    const rect = el.getBoundingClientRect();
    const stepsRaw = Number.parseInt(el.dataset.steps || '0', 10);
    stageRecords.push({
      el,
      start: rect.top + scrollY,
      height: rect.height,
      steps: Number.isFinite(stepsRaw) && stepsRaw > 0 ? stepsRaw : 0,
      lastP: -1,
      lastStep: -1,
    });
  }
}

function writeStageState(rec, p) {
  const roundedP = Math.round(p * 10000) / 10000;
  const step = rec.steps > 0 ? Math.min(rec.steps - 1, Math.floor(roundedP * rec.steps)) : 0;

  if (roundedP === rec.lastP && step === rec.lastStep) return;
  rec.lastP = roundedP;
  rec.lastStep = step;

  rec.el.style.setProperty('--p', String(roundedP));
  if (rec.steps > 0) {
    rec.el.dataset.step = String(step);
    rec.el.style.setProperty('--step', String(step));
    const pills = rec.el.querySelectorAll('[data-step-target]');
    for (const pill of pills) {
      const idx = Number.parseInt(pill.dataset.stepTarget || '-1', 10);
      pill.setAttribute('aria-current', idx === step ? 'true' : 'false');
    }
  }

  rec.el.dispatchEvent(
    new CustomEvent('stage:progress', {
      bubbles: false,
      detail: { p: roundedP, step },
    })
  );
}

let rafId = 0;

function updateScrollFrame() {
  rafId = 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const vh = window.innerHeight || 1;
  const docHeight = Math.max(1, document.documentElement.scrollHeight - vh);
  const pageP = clamp(scrollY / docHeight, 0, 1);

  root.style.setProperty('--page-p', pageP.toFixed(4));
  if (headerEl) {
    const scrolled = scrollY > 80;
    headerEl.dataset.scrolled = scrolled ? 'true' : 'false';
    headerEl.classList.toggle('is-scrolled', scrolled);
  }

  for (const rec of stageRecords) {
    if (isReducedMotion) {
      writeStageState(rec, 1);
      continue;
    }
    const scrollable = Math.max(1, rec.height - vh);
    const p = clamp((scrollY - rec.start) / scrollable, 0, 1);
    writeStageState(rec, p);
  }
}

function scheduleScrollFrame() {
  if (rafId === 0) {
    rafId = window.requestAnimationFrame(updateScrollFrame);
  }
}

function scrollToStageStep(stageEl, targetStep) {
  const rec = stageRecords.find((r) => r.el === stageEl);
  if (!rec || rec.steps <= 0) return;
  const clampedStep = clamp(targetStep, 0, rec.steps - 1);
  if (isReducedMotion) {
    rec.lastP = -1;
    const p = rec.steps > 1 ? clampedStep / (rec.steps - 1) : 1;
    writeStageState(rec, p);
    return;
  }
  const vh = window.innerHeight || 1;
  const scrollable = Math.max(0, rec.height - vh);
  const ratio = (clampedStep + 0.05) / rec.steps;
  window.scrollTo({ top: rec.start + scrollable * ratio, behavior: 'smooth' });
}

window.addEventListener('scroll', scheduleScrollFrame, { passive: true });

if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(() => {
    measureLayout();
    scheduleScrollFrame();
  });
  ro.observe(document.body);
  for (const el of document.querySelectorAll('[data-stage]')) ro.observe(el);
} else {
  window.addEventListener('resize', () => {
    measureLayout();
    scheduleScrollFrame();
  });
}

reducedMotionQuery.addEventListener?.('change', (e) => {
  isReducedMotion = e.matches;
  if (isReducedMotion) {
    for (const el of document.querySelectorAll('[data-reveal], .reveal')) el.classList.add('is-in');
  }
  measureLayout();
  scheduleScrollFrame();
});

/* ---------- Pointer Tracker for .hairline-card (--mx / --my) ---------- */

let activeCard = null;
let activeCardRect = null;
let pointerRaf = 0;
let lastClientX = 0;
let lastClientY = 0;

function flushPointer() {
  pointerRaf = 0;
  if (!activeCard || !activeCardRect) return;
  const x = Math.round(lastClientX - activeCardRect.left);
  const y = Math.round(lastClientY - activeCardRect.top);
  activeCard.style.setProperty('--mx', `${x}px`);
  activeCard.style.setProperty('--my', `${y}px`);
}

document.addEventListener(
  'pointermove',
  (event) => {
    if (isReducedMotion || event.pointerType === 'touch') return;
    const card = event.target.closest?.('.hairline-card');
    if (card !== activeCard) {
      activeCard = card;
      activeCardRect = card ? card.getBoundingClientRect() : null;
    }
    if (!activeCard) return;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    if (pointerRaf === 0) {
      pointerRaf = window.requestAnimationFrame(flushPointer);
    }
  },
  { passive: true }
);

window.addEventListener(
  'scroll',
  () => {
    if (activeCard) activeCardRect = activeCard.getBoundingClientRect();
  },
  { passive: true }
);

/* ---------- Initial Boot Measurement ---------- */

measureLayout();
updateScrollFrame();

window.OnniChoreographer = {
  refresh() {
    measureLayout();
    updateScrollFrame();
  },
  setTheme(theme) {
    applyTheme(theme, true);
  },
  getTheme() {
    return root.dataset.theme || 'dark';
  },
  scrollToStageStep,
};
