/* iife */ (() => {
/**
 * Section 04: Live Evidence & Cockpit Twin (#live)
 * Direction: "Parallel Light" · Zero-dep classic deferred script (IIFE)
 * Binds to stage:progress event from choreographer.js,
 * interpolates telemetry counters (tok · $ · mm:ss) with --p,
 * syncs full-height code diff viewer to active step, and supports
 * direct clicking of step pills on mobile & desktop.
 */

const liveSection = document.getElementById('live');

if (liveSection) {
  const tokensEl = liveSection.querySelector('[data-counter="tokens"]');
  const costEl = liveSection.querySelector('[data-counter="cost"]');
  const durationEl = liveSection.querySelector('[data-counter="duration"]');
  const progressBarEl = liveSection.querySelector('.live-cockpit__progress-bar');
  const diffFilenameEl = liveSection.querySelector('[data-diff-filename]');
  const diffStatsEl = liveSection.querySelector('[data-diff-stats]');
  const stepRows = Array.from(liveSection.querySelectorAll('.live-step-row'));
  const diffPanels = Array.from(liveSection.querySelectorAll('.live-diff-panel'));
  const stepButtons = Array.from(liveSection.querySelectorAll('.chip--step-btn'));

  const STEP_METADATA = [
    {
      step: 0,
      filename: 'packages/web/src/routes/settings.tsx',
      statsHtml: '<span class="live-diff__stat-add">312 lines</span> <span class="live-diff__stat-del">inspect</span>',
      tokens: 2840,
      cost: 0.03,
      durationSec: 8,
    },
    {
      step: 1,
      filename: 'packages/web/src/routes/settings.tsx',
      statsHtml: '<span class="live-diff__stat-add">+18</span> <span class="live-diff__stat-del">-24</span>',
      tokens: 8450,
      cost: 0.11,
      durationSec: 24,
    },
    {
      step: 2,
      filename: 'packages/web/src/routes/settings.test.tsx',
      statsHtml: '<span class="live-diff__stat-add">+64</span> <span class="live-diff__stat-del">-0</span> <span style="color:var(--done)">· 12 passed</span>',
      tokens: 14820,
      cost: 0.18,
      durationSec: 42,
    },
    {
      step: 3,
      filename: 'packages/web/src/routes/settings-tabs.tsx',
      statsHtml: '<span class="live-diff__stat-add">+142</span> <span class="live-diff__stat-del">-38</span> <span style="color:var(--review)">· review</span>',
      tokens: 18240,
      cost: 0.23,
      durationSec: 54,
    },
  ];

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function updateTelemetry(p, step) {
    const clampedP = Math.max(0, Math.min(1, p));
    const activeStep = Math.max(0, Math.min(3, step));

    // Continuous smooth interpolation across the run:
    // tok: 2,840 -> 18,240
    // cost: $0.03 -> $0.23
    // duration: 00:08 -> 00:54
    const tokens = Math.round(2840 + clampedP * (18240 - 2840));
    const cost = (0.03 + clampedP * 0.20).toFixed(2);
    const durationSec = Math.round(8 + clampedP * 46);

    if (tokensEl) tokensEl.textContent = tokens.toLocaleString('en-US');
    if (costEl) costEl.textContent = `$${cost}`;
    if (durationEl) durationEl.textContent = formatTime(durationSec);
    if (progressBarEl) progressBarEl.style.width = `${(clampedP * 100).toFixed(1)}%`;

    // Update active diff file info based on step
    const meta = STEP_METADATA[activeStep];
    if (meta) {
      if (diffFilenameEl && diffFilenameEl.textContent !== meta.filename) {
        diffFilenameEl.textContent = meta.filename;
      }
      if (diffStatsEl) {
        diffStatsEl.innerHTML = meta.statsHtml;
      }
    }

    // Update active step row & diff panel classes
    for (let i = 0; i < stepRows.length; i++) {
      const row = stepRows[i];
      const isActive = i === activeStep;
      row.classList.toggle('is-active', isActive);
    }

    for (let i = 0; i < diffPanels.length; i++) {
      const panel = diffPanels[i];
      const isActive = i === activeStep;
      panel.classList.toggle('is-active', isActive);
    }

    for (let i = 0; i < stepButtons.length; i++) {
      const btn = stepButtons[i];
      const idx = Number.parseInt(btn.dataset.stepTarget || '-1', 10);
      btn.setAttribute('aria-current', idx === activeStep ? 'true' : 'false');
    }
  }

  // Allow direct step clicking (especially when stage is unpinned on mobile)
  for (let i = 0; i < stepButtons.length; i++) {
    const btn = stepButtons[i];
    btn.addEventListener('click', () => {
      const idx = Number.parseInt(btn.dataset.stepTarget || '-1', 10);
      if (idx >= 0 && idx <= 3) {
        liveSection.dataset.step = String(idx);
        liveSection.style.setProperty('--step', String(idx));
        updateTelemetry(idx / 3, idx);
      }
    });
  }

  // Listen to stage:progress fired by choreographer.js
  liveSection.addEventListener('stage:progress', (e) => {
    const { p, step } = e.detail;
    updateTelemetry(p, step);
  });

  // Handle reduced motion initial state
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReducedMotion) {
    updateTelemetry(1, 3);
  } else {
    // Initial check from current stage state
    const initialStep = Number.parseInt(liveSection.dataset.step || '0', 10);
    const initialP = Number.parseFloat(liveSection.style.getPropertyValue('--p') || '0');
    updateTelemetry(Number.isNaN(initialP) ? 0 : initialP, Number.isNaN(initialStep) ? 0 : initialStep);
  }
}
})();