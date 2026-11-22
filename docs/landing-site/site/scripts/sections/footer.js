/**
 * Section: Footer (scripts/sections/footer.js)
 * ES module · Zero-dependency · Back-to-top handler
 * Contract: site/README.md & 04-review.md
 */

const backToTopBtn = document.getElementById('footer-back-to-top');

backToTopBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
});
