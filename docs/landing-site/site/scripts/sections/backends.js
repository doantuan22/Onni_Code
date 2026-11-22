/* iife */ (() => {
// section: backends — ES module; see site/README.md contract

const section = document.getElementById('backends');

if (section) {
  const tiles = Array.from(section.querySelectorAll('.backend-tile'));
  const noteEl = section.querySelector('[data-backends-note]');
  const primaryValEl = section.querySelector('[data-yaml-primary]');
  const commentEl = section.querySelector('[data-yaml-comment]');
  const primaryLine = section.querySelector('[data-yaml-step="primary"]');
  const verifyLine = section.querySelector('[data-yaml-step="verify"]');

  tiles.forEach((tile, idx) => {
    tile.style.setProperty('--tile-index', String(idx));
  });

  let selectedId = 'agy';

  function applyBackendPreview(id, isInstalled) {
    for (const tile of tiles) {
      const match = tile.dataset.backend === id;
      tile.classList.toggle('is-active', match);
      tile.setAttribute('aria-pressed', match ? 'true' : 'false');
    }

    if (noteEl) {
      noteEl.textContent = isInstalled
        ? `# backend: ${id}`
        : `# ${id}: not installed on PATH`;
      noteEl.dataset.missing = isInstalled ? 'false' : 'true';
    }

    if (id === 'agy') {
      if (primaryValEl) primaryValEl.textContent = 'claude';
      if (commentEl) commentEl.textContent = '';
      primaryLine?.classList.remove('is-highlighted');
      verifyLine?.classList.add('is-highlighted');
    } else {
      if (primaryValEl) primaryValEl.textContent = id;
      if (commentEl) {
        commentEl.textContent = isInstalled ? '' : '# not installed';
      }
      verifyLine?.classList.remove('is-highlighted');
      primaryLine?.classList.add('is-highlighted');
    }
  }

  for (const tile of tiles) {
    const id = tile.dataset.backend || 'claude';
    const isInstalled = tile.dataset.installed !== 'false';

    tile.addEventListener('pointerenter', () => {
      applyBackendPreview(id, isInstalled);
    });

    tile.addEventListener('focus', () => {
      applyBackendPreview(id, isInstalled);
    });

    tile.addEventListener('click', () => {
      selectedId = id;
      applyBackendPreview(id, isInstalled);
    });
  }

  const grid = section.querySelector('.backends__grid');
  grid?.addEventListener('pointerleave', () => {
    const selectedTile = tiles.find((t) => t.dataset.backend === selectedId);
    const isInstalled = selectedTile ? selectedTile.dataset.installed !== 'false' : true;
    applyBackendPreview(selectedId, isInstalled);
  });
}
})();
