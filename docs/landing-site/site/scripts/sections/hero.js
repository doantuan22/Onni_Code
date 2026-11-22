/**
 * Section 01: Hero (scripts/sections/hero.js)
 * Implements the 3-second boot choreography from 02-concept.md ("Hero, in detail"):
 * - 0.0-0.4s: mark breathe + 1px violet bar crosses hairline (phase="mark")
 * - 0.4-1.1s: grid hairlines draw out from center; tilted cockpit twin rises 24px;
 *             pixel horizon fades in (phase="grid")
 * - 1.1-2.2s: headline lines stagger in; prompt types "Split the settings page into tabs and add tests";
 *             roster chip settles (phase="copy")
 * - 2.2-3.0s: status dot turns green; badge prints ".ai/onni/worktrees/3f2a91c4 · onni/3f2a91c4";
 *             spine emits its first downward pulse (phase="settle" -> state="settled")
 * Also listens to 'stage:progress' on #hero to update tabular token/cost telemetry smoothly.
 */

const heroEl = document.getElementById('hero');

if (heroEl) {
  const promptEl = heroEl.querySelector('[data-hero-prompt]');
  const statusLed = heroEl.querySelector('[data-hero-status-led]');
  const runLed = heroEl.querySelector('[data-hero-run-led]');
  const bootLabel = heroEl.querySelector('[data-hero-boot-label]');
  const tokensEl = heroEl.querySelector('[data-hero-tokens]');
  const costEl = heroEl.querySelector('[data-hero-cost]');
  const replayBtns = heroEl.querySelectorAll('[data-hero-replay]');

  const FULL_PROMPT =
    promptEl?.getAttribute('data-full-text') ||
    'Split the settings page into tabs and add tests';

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let bootTimers = [];
  let typingRaf = 0;

  function clearBootTimers() {
    for (const id of bootTimers) window.clearTimeout(id);
    bootTimers = [];
    if (typingRaf) {
      window.cancelAnimationFrame(typingRaf);
      typingRaf = 0;
    }
  }

  function setLedsPending(isPending) {
    for (const led of [statusLed, runLed]) {
      if (!led) continue;
      led.classList.toggle('led--pending', isPending);
      led.classList.toggle('led--done', !isPending);
    }
  }

  function settleHeroImmediate() {
    clearBootTimers();
    heroEl.dataset.bootState = 'settled';
    heroEl.dataset.bootPhase = 'settle';
    if (promptEl) promptEl.textContent = FULL_PROMPT;
    setLedsPending(false);
    if (bootLabel) bootLabel.textContent = 'cockpit ready';
  }

  function runPromptTypewriter(durationMs) {
    if (!promptEl) return;
    const start = performance.now();
    const totalChars = FULL_PROMPT.length;

    function tick(now) {
      const elapsed = now - start;
      const ratio = Math.min(1, Math.max(0, elapsed / durationMs));
      const count = Math.max(1, Math.round(ratio * totalChars));
      promptEl.textContent = FULL_PROMPT.slice(0, count);
      if (ratio < 1) {
        typingRaf = window.requestAnimationFrame(tick);
      } else {
        typingRaf = 0;
        promptEl.textContent = FULL_PROMPT;
      }
    }

    promptEl.textContent = '';
    typingRaf = window.requestAnimationFrame(tick);
  }

  function startBootSequence() {
    if (reducedMotionQuery.matches) {
      settleHeroImmediate();
      return;
    }

    clearBootTimers();

    // 0.0-0.4s: Mark breathe + 1px violet bar
    heroEl.dataset.bootState = 'booting';
    heroEl.dataset.bootPhase = 'mark';
    setLedsPending(true);
    if (bootLabel) bootLabel.textContent = 'booting local engine…';
    if (promptEl) promptEl.textContent = '';

    // 0.4-1.1s: Grid hairlines draw out, tilted cockpit twin rises 24px, window fades in
    bootTimers.push(
      window.setTimeout(() => {
        heroEl.dataset.bootPhase = 'grid';
        if (bootLabel) bootLabel.textContent = 'mounting worktree…';
      }, 400)
    );

    // 1.1-2.2s: Headline lines stagger in, prompt types itself
    bootTimers.push(
      window.setTimeout(() => {
        heroEl.dataset.bootPhase = 'copy';
        if (bootLabel) bootLabel.textContent = 'dispatching roster…';
        runPromptTypewriter(980);
      }, 1100)
    );

    // 2.2-3.0s: Status dot turns green, worktree badge prints, spine pulse
    bootTimers.push(
      window.setTimeout(() => {
        heroEl.dataset.bootPhase = 'settle';
        if (promptEl) promptEl.textContent = FULL_PROMPT;
        setLedsPending(false);
        if (bootLabel) bootLabel.textContent = 'worktree 3f2a91c4 live';
      }, 2200)
    );

    // 3.0s: Everything rests in settled state
    bootTimers.push(
      window.setTimeout(() => {
        settleHeroImmediate();
      }, 3000)
    );
  }

  // Scroll stage telemetry updates
  const TOKEN_STEPS = [
    '4,120 / 980',
    '9,640 / 2,310',
    '14,880 / 3,740',
    '18,420 / 4,910',
  ];
  const COST_STEPS = ['$0.03', '$0.07', '$0.11', '$0.14'];

  heroEl.addEventListener('stage:progress', (event) => {
    const step = event.detail?.step ?? 0;
    const p = event.detail?.p ?? 0;
    if (p > 0.08 && heroEl.dataset.bootState === 'booting') {
      settleHeroImmediate();
    }
    if (tokensEl && TOKEN_STEPS[step]) {
      tokensEl.textContent = TOKEN_STEPS[step];
    }
    if (costEl && COST_STEPS[step]) {
      costEl.textContent = COST_STEPS[step];
    }
  });

  for (const btn of replayBtns) {
    btn.addEventListener('click', () => {
      startBootSequence();
    });
  }

  reducedMotionQuery.addEventListener?.('change', (e) => {
    if (e.matches) settleHeroImmediate();
  });

  // Launch the 3-second boot choreography on load
  startBootSequence();
}
