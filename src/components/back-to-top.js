export function initializeBackToTop() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'back-to-top';
  button.setAttribute('aria-label', 'Back to top');
  button.title = 'Back to top';
  button.innerHTML = '<span class="back-to-top-art"><img src="/assets/rocket-return.png" alt=""><span class="back-to-top-label" aria-hidden="true">TOP</span></span>';
  document.body.append(button);

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
