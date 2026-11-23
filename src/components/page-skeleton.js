const bar = (kind = '') => `<span class="skeleton sk-bar ${kind}"></span>`;
const heading = () => `<div class="sk-heading">${bar('sk-title')}${bar('sk-subtitle')}</div>`;
const field = () => `<div class="sk-field">${bar('sk-label')}${bar('sk-input')}</div>`;
const panel = content => `<section class="surface-card sk-panel">${content}</section>`;
const paragraphs = () => `${bar('sk-section-title')}${bar()}${bar('sk-medium')}`;

function homeSkeleton() {
  const shortcuts = Array.from({length: 3}, () => panel(`${bar('sk-icon')}${bar()}${bar('sk-medium')}`)).join('');
  return `<main class="home-page sk-home-page"><div class="home-hero sk-home-hero"><div class="home-copy">${bar('sk-hero-title')}${bar('sk-hero-title')}${bar('sk-hero-title sk-medium')}${bar('sk-hero-description')}${field()}${bar('sk-medium')}<div class="home-benefits">${shortcuts}</div></div></div></main>`;
}

function intakeSkeleton() {
  const photos = Array.from({length: 2}, () => `<div>${bar('sk-label')}${bar('sk-upload')}</div>`).join('');
  const fields = Array.from({length: 12}, (_, index) => `<div class="${index === 0 || index === 9 ? 'sk-wide' : ''}">${field()}</div>`).join('');
  return `<main class="app-page intake-page sk-page">${heading()}<div class="intake-grid">${panel(`${paragraphs()}<div class="upload-grid">${photos}</div>${bar('sk-button')}${bar()}`)}${panel(`${paragraphs()}<div class="field-grid">${fields}</div>${bar('sk-button')}`)}</div></main>`;
}

function vaultSkeleton() {
  const rows = Array.from({length: 3}, () => `<div class="list-row sk-vault-row">${bar('sk-thumbnail')}<div>${bar('sk-medium')}${bar()}</div></div>`).join('');
  return `<main class="app-page vault-page sk-page">${heading()}<div class="vault-toolbar">${bar('sk-sort')}${bar('sk-input')}</div><div class="vault-layout"><div class="vault-list">${rows}</div>${panel(`${paragraphs()}${field()}${field()}${field()}`)}${panel(`${bar('sk-section-title')}${bar('sk-card-photo')}`)}</div></main>`;
}

function labelSkeleton() {
  return `<main class="app-page sk-page">${heading()}<div class="label-workspace">${panel(`${bar('sk-section-title')}${bar('sk-label')}${bar('sk-textarea')}${bar()}<div class="sk-actions">${bar('sk-button')}${bar('sk-button')}</div>`)}${panel(`${bar('sk-section-title')}${bar('sk-medium')}<div class="sk-label-space"></div><div class="sk-actions">${bar('sk-button')}${bar('sk-button')}</div>${bar()}`)}</div></main>`;
}

function profileSkeleton() {
  const rows = Array.from({length: 4}, () => `<div class="sk-profile-row">${bar('sk-label')}${bar('sk-medium')}</div>`).join('');
  return `<main class="app-page profile-page sk-page">${heading()}<div class="profile-form">${panel(`<div class="sk-profile-identity">${bar('sk-avatar')}<div>${bar('sk-section-title')}${bar()}${bar('sk-medium')}</div></div>`)}${panel(`${bar('sk-section-title')}${rows}`)}</div></main>`;
}

function certificateSkeleton(hasResult) {
  const result = hasResult ? panel(`${bar('sk-section-title')}${bar('sk-medium')}<div class="sk-cert-images">${bar('sk-cert-photo')}${bar('sk-cert-photo')}</div>${bar('sk-section-title')}${field()}${field()}`) : '';
  return `<main class="lookup-page sk-page"><section class="lookup-panel">${bar('sk-title')}${bar('sk-subtitle')}${bar('sk-input')}${result}</section></main>`;
}

function importSkeleton() {
  return `<main class="app-page import-page sk-page">${heading()}${panel(`${bar()}${bar('sk-medium')}${field()}${field()}${bar('sk-textarea')}<div class="sk-actions">${bar('sk-button')}${bar('sk-button')}</div>`)}</main>`;
}

function privacySkeleton() {
  const sections = Array.from({length: 4}, () => `<div class="sk-privacy-section">${bar('sk-section-title')}${bar()}${bar()}${bar('sk-medium')}</div>`).join('');
  return `<main class="sk-page sk-privacy">${panel(heading())}${panel(sections)}</main>`;
}

function billingSkeleton() {
  const cards = Array.from({length: 3}, () => `<div class="billing-card">${bar('sk-section-title')}${bar()}${bar('sk-title')}${bar()}${bar()}${bar('sk-medium')}${bar('sk-button')}</div>`).join('');
  return `<main class="app-page billing-page sk-page"><div class="billing-heading">${bar('sk-title')}${bar('sk-subtitle')}</div><div class="billing-grid">${cards}</div>${bar('sk-label')}</main>`;
}

function genericSkeleton() {
  return `<main class="app-page sk-page">${heading()}${panel(paragraphs())}</main>`;
}

const pageSkeletons = {
  '/': homeSkeleton,
  '/archive': intakeSkeleton,
  '/vault': vaultSkeleton,
  '/label': labelSkeleton,
  '/profile': profileSkeleton,
  '/billing': billingSkeleton,
  '/import': importSkeleton,
  '/privacy': privacySkeleton,
  '/privacy/': privacySkeleton,
};

export function pageSkeleton(path, isCertificate, hasQuery) {
  const content = path === '/verify' || isCertificate
    ? certificateSkeleton(isCertificate || hasQuery)
    : (pageSkeletons[path] || genericSkeleton)();
  return `<div role="status" aria-live="polite"><span class="sr-only">Loading page…</span><div aria-hidden="true">${content}</div></div>`;
}
