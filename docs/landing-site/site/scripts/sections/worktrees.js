/* iife */ (() => {
// section: worktrees — ES module; see site/README.md contract

const section = document.getElementById('worktrees');

if (section) {
  const cards = Array.from(section.querySelectorAll('.worktree-card'));

  // Expose settled state flag once scroll stage reaches end
  section.addEventListener('stage:progress', (event) => {
    const p = event.detail?.p ?? 0;
    section.dataset.settled = p >= 0.85 ? 'true' : 'false';
  });

  // Allow keyboard/click focus to highlight a lane card gently
  for (const card of cards) {
    card.addEventListener('pointerenter', () => {
      for (const c of cards) c.classList.toggle('worktree-card--active', c === card);
    });
  }
}
})();
