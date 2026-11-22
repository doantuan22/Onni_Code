/* iife */ (() => {
const flow = document.querySelector('#automations [data-automation-flow]');

if (flow && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let timer;
  let pulseTimer;
  const observer = new IntersectionObserver(([entry]) => {
    window.clearInterval(timer);
    if (!entry.isIntersecting) {
      flow.classList.remove('is-pulsing');
      return;
    }
    const pulse = () => {
      flow.classList.remove('is-pulsing');
      // Restart CSS animations without a frame loop; the observer pauses this timer off-screen.
      void flow.offsetWidth;
      flow.classList.add('is-pulsing');
      window.clearTimeout(pulseTimer);
      pulseTimer = window.setTimeout(() => flow.classList.remove('is-pulsing'), 1800);
    };
    pulse();
    timer = window.setInterval(pulse, 4000);
  }, { threshold: 0.25 });
  observer.observe(flow);
}
})();
