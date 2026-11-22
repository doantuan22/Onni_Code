/* iife */ (() => {
const demo = document.querySelector('#gate [data-gate-state]');

if (demo) {
  const status = demo.querySelector('[data-gate-status]');
  const decision = demo.querySelector('[data-gate-decision]');
  const policy = demo.querySelector('[data-gate-policy]');
  const merge = demo.querySelector('[data-gate-merge]');
  const reset = demo.querySelector('[data-gate-reset]');
  const toast = demo.querySelector('[data-gate-toast]');
  const tabs = demo.querySelectorAll('[data-gate-tab]');
  const panels = demo.querySelectorAll('[data-gate-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-gate-tab');
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach((panel) => {
        panel.hidden = panel.getAttribute('data-gate-panel') !== target;
      });
    });
  });

  demo.querySelector('[data-gate-pr]')?.addEventListener('click', () => {
    if (toast) {
      toast.textContent = 'draft PR via gh — illustration';
    }
  });

  merge?.addEventListener('click', () => {
    demo.dataset.gateState = 'merged';
    if (status) {
      status.innerHTML = '<span class="led led--done" aria-hidden="true"></span>merged';
    }
    if (policy) {
      policy.textContent = 'merged locally into main · 0 conflicts';
    }
    if (decision) {
      decision.hidden = false;
    }
    if (reset) {
      reset.hidden = false;
    }
    merge.hidden = true;
    if (toast) {
      toast.textContent = '';
    }
  });

  reset?.addEventListener('click', () => {
    demo.dataset.gateState = 'waiting';
    if (status) {
      status.innerHTML = '<span class="led led--review" aria-hidden="true"></span>review';
    }
    if (policy) {
      policy.textContent = 'no auto-merge · awaiting click';
    }
    if (decision) {
      decision.hidden = true;
    }
    reset.hidden = true;
    if (merge) {
      merge.hidden = false;
    }
    if (toast) {
      toast.textContent = '';
    }
  });
}
})();
