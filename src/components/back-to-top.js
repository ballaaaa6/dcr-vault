export function initializeBackToTop() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'back-to-top';
  button.setAttribute('aria-label', 'Back to top');
  button.title = 'Back to top';
  button.innerHTML = '<span class="back-to-top-art"><img src="/assets/rocket-return.png" alt=""><span class="back-to-top-label" aria-hidden="true">TOP</span></span>';
  document.body.append(button);

  const stack = document.getElementById('toast-stack');
  if (stack) {
    const updateToastClearance = () => {
      const clearance = stack.childElementCount ? window.innerHeight - stack.getBoundingClientRect().top + 10 : 0;
      button.style.setProperty('--toast-clearance', `${clearance}px`);
    };
    new ResizeObserver(updateToastClearance).observe(stack);
    window.addEventListener('resize', updateToastClearance);
    updateToastClearance();
  }

  function updateVisibility() {
    const visible = window.scrollY > 0;
    button.classList.toggle('is-visible', visible);
    button.tabIndex = visible ? 0 : -1;
    button.setAttribute('aria-hidden', String(!visible));
  }

  window.addEventListener('scroll', updateVisibility, {passive: true});
  button.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top: 0, behavior: reduced ? 'instant' : 'smooth'});
  });
  updateVisibility();
}
