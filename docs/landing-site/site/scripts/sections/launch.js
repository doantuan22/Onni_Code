/* iife */ (() => {
/**
 * Section 09: Desktop & CLI (scripts/sections/launch.js)
 * ES module · Zero-dependency · Copy-to-clipboard, boot log & dawn horizon
 * Contract: site/README.md & 04-review.md
 */

const launchSection = document.getElementById('launch');

if (launchSection) {
  // 1. Copy command & boot log
  const copyBtn = document.getElementById('launch-copy-btn');
  const cmdCode = document.getElementById('launch-cmd');
  const copyLabel = copyBtn?.querySelector('[data-copy-label]');
  const bootLog = document.getElementById('launch-boot-log');

  const COMMAND_TEXT = 'ONNI_DRY_RUN=1 npm run dev';

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback below
      }
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    } finally {
      textArea.remove();
    }
    return ok;
  }

  let resetTimer = 0;

  copyBtn?.addEventListener('click', async () => {
    const ok = await copyToClipboard(cmdCode?.textContent?.trim() || COMMAND_TEXT);
    if (!ok) return;

    copyBtn.classList.add('is-copied');
    if (copyLabel) copyLabel.textContent = 'copied!';

    // Ensure boot log is visibly animated
    if (bootLog) {
      bootLog.style.opacity = '1';
      bootLog.style.borderColor = 'color-mix(in srgb, var(--done) 40%, var(--border))';
    }

    clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      if (copyLabel) copyLabel.textContent = 'copy';
      if (bootLog) {
        bootLog.style.borderColor = '';
      }
    }, 2200);
  });

  // 2. Pixel-art Dawn Horizon illumination tracking
  const horizonEl = document.getElementById('launch-horizon');
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (horizonEl) {
    if (isReducedMotion) {
      horizonEl.style.setProperty('--dawn-p', '0.9');
    } else {
      let dawnRaf = 0;

      function updateDawnProgress() {
        dawnRaf = 0;
        const rect = horizonEl.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // Center of horizon relative to viewport center
        const horizonCenter = rect.top + rect.height / 2;
        const vhCenter = vh / 2;
        const dist = Math.abs(horizonCenter - vhCenter);
        const maxRange = vh * 0.75;
        const rawDawn = Math.max(0, Math.min(1, 1 - dist / maxRange));
        const dawn = Math.round(rawDawn * 1000) / 1000;

        horizonEl.style.setProperty('--dawn-p', String(dawn));
      }

      function scheduleDawnUpdate() {
        if (dawnRaf === 0) {
          dawnRaf = window.requestAnimationFrame(updateDawnProgress);
        }
      }

      window.addEventListener('scroll', scheduleDawnUpdate, { passive: true });
      window.addEventListener('resize', scheduleDawnUpdate, { passive: true });
      scheduleDawnUpdate();
    }
  }
}
})();
