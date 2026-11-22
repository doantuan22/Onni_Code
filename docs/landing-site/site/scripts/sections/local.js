/**
 * Section 08: Local-First & Zero Config (scripts/sections/local.js)
 * ES module · Zero-dependency · Contract: site/README.md & 04-review.md
 */

const localSection = document.getElementById('local');

if (localSection) {
  // Mini Cockpit UI tab switching on Plane 1
  const tabs = localSection.querySelectorAll('.local__ui-tab');
  const taskTitle = localSection.querySelector('.local__ui-task-title');
  const taskChip = localSection.querySelector('.local__ui-chip');

  const tabContentMap = {
    Overview: { title: 'Split settings into tabs', chip: '+142 -38' },
    'Worktree Diff': { title: 'settings-tabs.tsx · git diff', chip: '+142 -38' },
    'Live Telemetry': { title: '3 steps · 1.2k tokens · $0.00', chip: 'streaming' },
    Roster: { title: 'Manager: claude · Workers: codex, agy', chip: 'fenced' },
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      const name = tab.textContent?.trim() || '';
      const data = tabContentMap[name];
      if (data && taskTitle && taskChip) {
        taskTitle.textContent = data.title;
        taskChip.textContent = data.chip;
      }
    });
  });

  // Listen to stage progress events from choreographer
  localSection.addEventListener('stage:progress', (e) => {
    const { p } = e.detail;
    localSection.style.setProperty('--peel-ratio', String(p));
  });
}
