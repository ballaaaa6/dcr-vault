const line = (size = '') => `<span class="skeleton skeleton-line ${size}"></span>`;

function panel() {
  return `<div class="skeleton-panel">${line('short')}${line()}${line()}${line('medium')}</div>`;
}

export function pageSkeleton(path, isCertificate) {
  let content = `<div class="skeleton-grid">${panel()}${panel()}${panel()}</div>`;
  if (path === '/vault') content = `<div class="skeleton-vault"><div>${panel()}${panel()}${panel()}</div>${panel()}<div class="skeleton skeleton-photo"></div></div>`;
  else if (path === '/' ) content = `<div class="skeleton-home">${line('medium')}${line('medium')}${line('short')}${line()}${content}</div>`;
  else if (isCertificate || path === '/verify' || path === '/profile') content = `<div class="skeleton-detail">${panel()}${panel()}</div>`;
  return `<main class="app-page skeleton-page" role="status" aria-live="polite"><span class="sr-only">Loading page…</span><div aria-hidden="true">${line('heading')}${line('short')}${content}</div></main>`;
}
