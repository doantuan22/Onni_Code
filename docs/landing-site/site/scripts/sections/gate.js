/* iife */ (() => {
const demo = document.querySelector('#gate [data-gate-state]');

if (demo) {
  const status = demo.querySelector('[data-gate-status]');
  const decision = demo.querySelector('[data-gate-decision]');
  const merge = demo.querySelector('[data-gate-merge]');
  const reset = demo.querySelector('[data-gate-reset]');
  const toast = demo.querySelector('[data-gate-toast]');

  demo.querySelector('[data-gate-pr]')?.addEventListener('click', () => {
    toast.textContent = 'draft PR via gh — illustration';
  });
  merge?.addEventListener('click', () => {
    demo.dataset.gateState = 'merged';
    status.innerHTML = '<span class="led led--done" aria-hidden="true"></span>merged';
    decision.hidden = false;
    reset.hidden = false;
    merge.hidden = true;
    toast.textContent = '';
  });
  reset?.addEventListener('click', () => {
    demo.dataset.gateState = 'waiting';
    status.innerHTML = '<span class="led led--review" aria-hidden="true"></span>review';
    decision.hidden = true;
    reset.hidden = true;
    merge.hidden = false;
  });
}
})();
