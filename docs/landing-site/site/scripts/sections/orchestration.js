/* iife */ (() => {
/**
 * Section 05: Manager / Worker Orchestration (#orchestration)
 * Direction: "Parallel Light" · Zero-dep classic deferred script (IIFE)
 * Coordinates 6px capsule packets traveling down along SVG filaments,
 * 4th packet bouncing off the dashed roster fence with amber '409 · not in roster',
 * green report capsules traveling back up to the manager node,
 * and handles the interactive 'Replay' trigger and reduced-motion fallback.
 */

const orchSection = document.getElementById('orchestration');

if (orchSection) {
  const replayBtn = orchSection.querySelector('.orch-replay-btn');
  const bounceTag = orchSection.querySelector('#orch-bounce-tag, .orch-bounce-tag');
  const managerStatusEl = orchSection.querySelector('[data-manager-status]');
  const workerCards = Array.from(orchSection.querySelectorAll('.orch-worker-card:not(.orch-worker-card--ghost)'));
  const svgCanvas = orchSection.querySelector('.orch-svg-canvas');

  // SVG Paths & Packet Elements
  const pathD1 = svgCanvas?.querySelector('#track-claude');
  const pathD2 = svgCanvas?.querySelector('#track-codex');
  const pathD3 = svgCanvas?.querySelector('#track-agy');
  const pathD4 = svgCanvas?.querySelector('#track-cursor');
  const pathBounce = svgCanvas?.querySelector('#track-bounce');

  const packetD1 = svgCanvas?.querySelector('#packet-down-1');
  const packetD2 = svgCanvas?.querySelector('#packet-down-2');
  const packetD3 = svgCanvas?.querySelector('#packet-down-3');
  const packetD4 = svgCanvas?.querySelector('#packet-down-4');

  const packetU1 = svgCanvas?.querySelector('#packet-up-1');
  const packetU2 = svgCanvas?.querySelector('#packet-up-2');
  const packetU3 = svgCanvas?.querySelector('#packet-up-3');

  let animationRafId = 0;
  let activeTimers = [];
  let isPlaying = false;

  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

  function clearPending() {
    if (animationRafId) {
      window.cancelAnimationFrame(animationRafId);
      animationRafId = 0;
    }
    for (const timer of activeTimers) {
      clearTimeout(timer);
    }
    activeTimers = [];
    isPlaying = false;
  }

  function hidePacket(el) {
    if (el) {
      el.style.opacity = '0';
    }
  }

  function showPacket(el) {
    if (el) {
      el.style.opacity = '1';
    }
  }

  function setPacketPosition(packetEl, pathEl, progress, reverse = false) {
    if (!packetEl || !pathEl) return;
    const totalLen = pathEl.getTotalLength ? pathEl.getTotalLength() : 100;
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const effectiveProgress = reverse ? 1 - clampedProgress : clampedProgress;
    const pt = pathEl.getPointAtLength(effectiveProgress * totalLen);
    packetEl.setAttribute('transform', `translate(${pt.x - 7}, ${pt.y - 3})`);
  }

  function animatePacketAlongPath(packetEl, pathEl, durationMs, delayMs, reverse = false, onComplete = null) {
    const timer = setTimeout(() => {
      showPacket(packetEl);
      const startTime = performance.now();

      function stepFrame(now) {
        const elapsed = now - startTime;
        const rawProgress = Math.min(1, elapsed / durationMs);
        const eased = easeInOutCubic(rawProgress);

        setPacketPosition(packetEl, pathEl, eased, reverse);

        if (rawProgress < 1) {
          animationRafId = window.requestAnimationFrame(stepFrame);
        } else {
          hidePacket(packetEl);
          if (onComplete) onComplete();
        }
      }

      animationRafId = window.requestAnimationFrame(stepFrame);
    }, delayMs);

    activeTimers.push(timer);
  }

  function setSettledState() {
    clearPending();

    hidePacket(packetD1);
    hidePacket(packetD2);
    hidePacket(packetD3);
    hidePacket(packetD4);
    hidePacket(packetU1);
    hidePacket(packetU2);
    hidePacket(packetU3);

    if (bounceTag) bounceTag.classList.add('is-visible');
    if (managerStatusEl) {
      managerStatusEl.textContent = '3/3 subtasks reported · review diff ready';
      managerStatusEl.style.color = 'var(--done)';
    }

    for (const card of workerCards) {
      card.classList.add('is-settled');
      const statusEl = card.querySelector('[data-worker-status]');
      if (statusEl) statusEl.textContent = 'verified branch · reported';
    }
  }

  function playDispatchSequence() {
    clearPending();
    isPlaying = true;

    // Reset initial visual state
    if (bounceTag) bounceTag.classList.remove('is-visible');
    if (managerStatusEl) {
      managerStatusEl.textContent = 'dispatching subtasks...';
      managerStatusEl.style.color = 'var(--violet)';
    }

    for (const card of workerCards) {
      card.classList.remove('is-settled');
      const statusEl = card.querySelector('[data-worker-status]');
      if (statusEl) statusEl.textContent = 'waiting for order...';
    }

    hidePacket(packetD1);
    hidePacket(packetD2);
    hidePacket(packetD3);
    hidePacket(packetD4);
    hidePacket(packetU1);
    hidePacket(packetU2);
    hidePacket(packetU3);

    const DURATION = 520; // 520ms ease-in-out per spec
    const STAGGER = 120;  // 120ms stagger

    // 1. Violet capsules travel down to workers 1..3
    animatePacketAlongPath(packetD1, pathD1, DURATION, 0, false, () => {
      if (workerCards[0]) {
        workerCards[0].classList.add('is-settled');
        const st = workerCards[0].querySelector('[data-worker-status]');
        if (st) st.textContent = 'working...';
      }
    });

    animatePacketAlongPath(packetD2, pathD2, DURATION, STAGGER, false, () => {
      if (workerCards[1]) {
        workerCards[1].classList.add('is-settled');
        const st = workerCards[1].querySelector('[data-worker-status]');
        if (st) st.textContent = 'working...';
      }
    });

    animatePacketAlongPath(packetD3, pathD3, DURATION, STAGGER * 2, false, () => {
      if (workerCards[2]) {
        workerCards[2].classList.add('is-settled');
        const st = workerCards[2].querySelector('[data-worker-status]');
        if (st) st.textContent = 'working...';
      }
    });

    // 2. 4th packet toward Cursor (starts at 360ms)
    const cursorDispatchDelay = STAGGER * 3;
    const timer4 = setTimeout(() => {
      showPacket(packetD4);
      const startTime = performance.now();
      const fenceImpactDuration = 380;

      function stepCursor(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / fenceImpactDuration);
        const eased = easeInOutCubic(progress);

        setPacketPosition(packetD4, pathD4, eased, false);

        if (progress < 1) {
          animationRafId = window.requestAnimationFrame(stepCursor);
        } else {
          // Impact on roster fence! Bounce deflects
          hidePacket(packetD4);
          if (bounceTag) bounceTag.classList.add('is-visible');

          // Deflection bounce
          if (packetD4 && pathBounce) {
            packetD4.classList.add('orch-packet--bounce');
            showPacket(packetD4);
            const bounceStart = performance.now();
            const bounceDur = 240;

            function stepBounce(bNow) {
              const bElapsed = bNow - bounceStart;
              const bProg = Math.min(1, bElapsed / bounceDur);
              setPacketPosition(packetD4, pathBounce, easeInOutCubic(bProg), false);
              if (bProg < 1) {
                animationRafId = window.requestAnimationFrame(stepBounce);
              } else {
                hidePacket(packetD4);
                packetD4.classList.remove('orch-packet--bounce');
              }
            }
            animationRafId = window.requestAnimationFrame(stepBounce);
          }
        }
      }

      animationRafId = window.requestAnimationFrame(stepCursor);
    }, cursorDispatchDelay);

    activeTimers.push(timer4);

    // 3. Green report capsules travel back UP to manager (staggered from 950ms)
    const reportBaseDelay = 950;

    animatePacketAlongPath(packetU1, pathD1, DURATION, reportBaseDelay, true, () => {
      if (workerCards[0]) {
        const st = workerCards[0].querySelector('[data-worker-status]');
        if (st) st.textContent = 'branch verified · reported';
      }
    });

    animatePacketAlongPath(packetU2, pathD2, DURATION, reportBaseDelay + STAGGER, true, () => {
      if (workerCards[1]) {
        const st = workerCards[1].querySelector('[data-worker-status]');
        if (st) st.textContent = 'branch verified · reported';
      }
    });

    animatePacketAlongPath(packetU3, pathD3, DURATION, reportBaseDelay + STAGGER * 2, true, () => {
      if (workerCards[2]) {
        const st = workerCards[2].querySelector('[data-worker-status]');
        if (st) st.textContent = 'branch verified · reported';
      }

      // Final settlement at manager
      if (managerStatusEl) {
        managerStatusEl.textContent = '3/3 subtasks reported · review diff ready';
        managerStatusEl.style.color = 'var(--done)';
      }
      isPlaying = false;
    });
  }

  // Bind Replay Button
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      playDispatchSequence();
    });
  }

  // Reduced motion check
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReducedMotion) {
    setSettledState();
  } else {
    // IntersectionObserver to auto-play on reveal
    let hasPlayed = false;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !hasPlayed) {
              hasPlayed = true;
              playDispatchSequence();
              observer.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(orchSection);
    } else {
      playDispatchSequence();
    }
  }
}
})();