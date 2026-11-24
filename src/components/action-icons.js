import settingsOriginal from './settings-original.json' with {type: 'json'};

// Switch: withicons (MIT); settings: useAnimations (MIT).
export const switchIcon = () => `<svg class="action-icon action-icon--switch" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 V10 A3.5 3.5 0 0 1 7.5 6.5 H20"/><path d="M16.5 3 L20 6.5 L16.5 10"/><path d="M20 12.5 V14 A3.5 3.5 0 0 1 16.5 17.5 H4"/><path d="M7.5 14 L4 17.5 L7.5 21"/></svg>`;

export const optionsIcon = () => `<span class="action-icon action-icon--options" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="action-icon__gear" d="M23.4 19 C23.128 19.617 23.258 20.338 23.73 20.82 C23.73 20.82 23.79 20.88 23.79 20.88 C24.571 21.66 24.572 22.927 23.792 23.708 C23.792 23.708 23.79 23.71 23.79 23.71 C23.009 24.491 21.743 24.492 20.962 23.712 C20.962 23.712 20.96 23.71 20.96 23.71 C20.96 23.71 20.9 23.65 20.9 23.65 C20.418 23.179 19.697 23.048 19.08 23.32 C18.475 23.579 18.083 24.172 18.08 24.83 C18.08 24.83 18.08 25 18.08 25 C18.08 26.104 17.184 27 16.08 27 C14.975 27 14.08 26.104 14.08 25 C14.08 25 14.08 24.91 14.08 24.91 C14.064 24.232 13.635 23.634 13 23.4 C12.382 23.128 11.662 23.259 11.18 23.73 C11.18 23.73 11.12 23.79 11.12 23.79 C10.339 24.571 9.073 24.572 8.291 23.792 C8.291 23.791 8.29 23.79 8.29 23.79 C7.508 23.01 7.507 21.743 8.288 20.962 C8.289 20.961 8.289 20.961 8.29 20.96 C8.29 20.96 8.35 20.9 8.35 20.9 C8.821 20.418 8.952 19.697 8.68 19.08 C8.421 18.476 7.827 18.083 7.17 18.08 C7.17 18.08 7 18.08 7 18.08 C5.895 18.08 5 17.185 5 16.08 C5 14.976 5.895 14.08 7 14.08 C7 14.08 7.089 14.08 7.089 14.08 C7.767 14.064 8.366 13.636 8.6 13 C8.872 12.383 8.741 11.662 8.27 11.18 C8.27 11.18 8.21 11.12 8.21 11.12 C7.428 10.339 7.427 9.073 8.208 8.292 C8.208 8.292 8.21 8.29 8.21 8.29 C8.99 7.508 10.256 7.508 11.038 8.289 C11.038 8.289 11.04 8.29 11.04 8.29 C11.04 8.29 11.1 8.35 11.1 8.35 C11.582 8.822 12.302 8.952 12.92 8.68 C12.92 8.68 13 8.68 13 8.68 C13.604 8.421 13.997 7.828 14 7.17 C14 7.17 14 7 14 7 C14 5.896 14.895 5 16 5 C17.104 5 18 5.896 18 7 C18 7 18 7.09 18 7.09 C18.003 7.748 18.395 8.341 19 8.6 C19.617 8.873 20.337 8.742 20.82 8.27 C20.82 8.27 20.879 8.21 20.879 8.21 C21.66 7.429 22.926 7.428 23.708 8.208 C23.709 8.209 23.71 8.209 23.71 8.21 C24.491 8.991 24.492 10.257 23.712 11.039 C23.711 11.039 23.711 11.04 23.71 11.04 C23.71 11.04 23.65 11.1 23.65 11.1 C23.178 11.582 23.047 12.303 23.32 12.92 C23.32 12.92 23.32 13 23.32 13 C23.579 13.604 24.171 13.998 24.83 14 C24.83 14 25 14 25 14 C26.104 14 27 14.896 27 16 C27 17.104 26.104 18 25 18 C25 18 24.91 18 24.91 18 C24.252 18.003 23.659 18.396 23.4 19 Z"/><circle cx="16" cy="16" r="3"/></svg></span>`;

const activeSettingsAnimations = new WeakMap();

async function animateSettingsIcon(icon) {
  const {default: lottie} = await import('lottie-web/build/player/lottie_light.js');
  activeSettingsAnimations.get(icon)?.destroy();
  const fallback = optionsIcon();
  const data = structuredClone(settingsOriginal);
  for (const group of data.layers[0].shapes) {
    for (const item of group.it || []) if (item.ty === 'st') item.c.k = [1, 1, 1, 1];
  }
  const animation = lottie.loadAnimation({container: icon, renderer: 'svg', loop: false, autoplay: false, animationData: data});
  icon.firstElementChild?.remove();
  activeSettingsAnimations.set(icon, animation);
  animation.addEventListener('DOMLoaded', () => animation.goToAndPlay(0, true));
  animation.addEventListener('complete', () => {
    animation.destroy();
    activeSettingsAnimations.delete(icon);
    icon.innerHTML = fallback.slice(fallback.indexOf('<svg'), fallback.lastIndexOf('</span>'));
  });
}


export function animateActionIcon(control) {
  if (!control) return;
  const settingsIcon = control.querySelector('.action-icon--options');
  if (settingsIcon && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) animateSettingsIcon(settingsIcon);
  control.classList.remove('action-icon-animate');
  void control.offsetWidth;
  control.classList.add('action-icon-animate');
}

export function initializeActionIcons() {
  document.addEventListener('click', event => {
    const control = event.target.closest('button, summary');
    if (!control || control.disabled || control.classList.contains('vault-detail-flip')) return;
    if (control.querySelector('.action-icon')) animateActionIcon(control);
  });
  document.addEventListener('animationend', event => {
    if (event.animationName === 'action-switch' || event.animationName === 'action-settings') {
      event.target.closest('.action-icon-animate')?.classList.remove('action-icon-animate');
    }
  });
}
