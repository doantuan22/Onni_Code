/* iife */ (() => {
/**
 * Section 00: Sticky Navigation (scripts/sections/nav.js)
 * Tracks the currently visible section (#worktrees, #live, #orchestration, #local)
 * and marks the matching anchor link in #nav with aria-current="true" and .is-active.
 */

const navEl = document.getElementById('nav');

if (navEl) {
  const linkMap = new Map();
  const navLinks = navEl.querySelectorAll('[data-nav-link]');

  for (const link of navLinks) {
    const targetId = link.getAttribute('data-nav-link');
    if (targetId) linkMap.set(targetId, link);
  }

  function setActiveLink(activeId) {
    for (const [id, link] of linkMap.entries()) {
      const isCurrent = id === activeId;
      link.classList.toggle('is-active', isCurrent);
      if (isCurrent) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  if ('IntersectionObserver' in window && linkMap.size > 0) {
    const visibleSections = new Set();
    const sectionOrder = ['worktrees', 'live', 'orchestration', 'local'];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visibleSections.add(id);
          } else {
            visibleSections.delete(id);
          }
        }
        const firstActive = sectionOrder.find((id) => visibleSections.has(id)) || '';
        setActiveLink(firstActive);
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: 0.01,
      }
    );

    for (const id of linkMap.keys()) {
      const sectionEl = document.getElementById(id);
      if (sectionEl) observer.observe(sectionEl);
    }
  }
}
})();
