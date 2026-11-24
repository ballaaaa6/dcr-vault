const bar = (kind = '') => `<span class="skeleton sk-bar ${kind}"></span>`;
const heading = () => `<div class="sk-heading">${bar('sk-title')}${bar('sk-subtitle')}</div>`;
const field = () => `<div class="sk-field">${bar('sk-label')}${bar('sk-input')}</div>`;
const panel = (content, className = '') => `<section class="surface-card sk-panel ${className}">${content}</section>`;
const paragraphs = () => `${bar('sk-section-title')}${bar()}${bar('sk-medium')}`;

function homeSkeleton() {
  const shortcuts = Array.from({length: 3}, () => `<div class="home-benefit">${bar('sk-icon')}${bar()}${bar('sk-medium')}</div>`).join('');
  return `<main class="home-page sk-home-page"><div class="home-hero sk-home-hero"><div class="home-copy">${bar('sk-hero-title')}${bar('sk-hero-title')}${bar('sk-hero-title sk-medium')}${bar('sk-hero-description')}${field()}${bar('sk-medium')}<div class="home-benefits">${shortcuts}</div></div><div class="home-art skeleton sk-home-art"></div></div></main>`;
}

function intakeSkeleton() {
  const photos = Array.from({length: 2}, () => `<div class="upload-item">${bar('sk-label')}<div class="upload-frame">${bar('sk-upload')}</div></div>`).join('');
  const fields = Array.from({length: 10}, (_, index) => `<div class="${[0, 5, 6, 7].includes(index) ? 'sk-wide' : ''}">${field()}</div>`).join('');
  return `<main class="app-page intake-page sk-page">${heading()}<div class="intake-grid">${panel(`<div class="section-heading"><div>${bar('sk-section-title')}${bar()}</div></div><div class="upload-grid">${photos}</div><div class="identification-actions">${bar('identification-notice')}${bar('sk-button')}</div>`, 'intake-card')}${panel(`<div class="section-heading"><div>${bar('sk-section-title')}${bar()}</div></div><div class="field-grid">${fields}${bar('sk-button manual-submit')}</div>`, 'intake-card')}</div></main>`;
}

function vaultSkeleton() {
  const rows = Array.from({length: 3}, () => `<div class="list-row sk-vault-row">${bar('sk-thumbnail')}<div>${bar('sk-medium')}${bar()}</div></div>`).join('');
  return `<main class="app-page vault-page sk-page">${heading()}<div class="vault-toolbar">${bar('sk-sort')}${bar('sk-sort')}${bar('sk-input')}</div><div class="vault-layout"><div class="vault-list">${rows}</div><div class="vault-selected">${panel(`${paragraphs()}${field()}${field()}${field()}`)}${panel(`${bar('sk-section-title')}${bar('sk-card-photo')}`)}</div></div></main>`;
}

function labelSkeleton() {
  return `<main class="app-page label-page sk-page">${heading()}<div class="label-workspace">${panel(`${bar('sk-section-title')}${bar('sk-label')}${bar('sk-textarea')}${bar()}<div class="sk-actions">${bar('sk-button')}${bar('sk-button')}</div>`)}${panel(`${bar('sk-section-title')}${bar('sk-medium')}<div class="sk-label-space"></div><div class="sk-actions">${bar('sk-button')}${bar('sk-button')}</div>${bar()}`)}</div></main>`;
}

function collectionsSkeleton() {
  const items = Array.from({length: 3}, () => panel(`<div class="collections-cover">${bar('sk-card-photo')}</div><div class="collections-item-body">${bar('sk-section-title')}${bar('sk-medium')}</div>`, 'collections-item')).join('');
  return `<main class="app-page collections-page sk-page">${heading()}<div class="collections-list-toolbar">${bar('sk-input')}${bar('sk-sort')}</div><div class="collections-list">${items}</div></main>`;
}

function profileSkeleton() {
  const rows = Array.from({length: 4}, () => `<div class="sk-profile-row">${bar('sk-label')}${bar('sk-medium')}</div>`).join('');
  return `<main class="app-page profile-page sk-page">${heading()}<div class="profile-form">${panel(`${bar('sk-avatar')}<div>${bar('sk-section-title')}${bar()}${bar('sk-medium')}</div>`, 'profile-identity sk-profile-identity')}${panel(`${bar('sk-section-title')}<div class="sk-profile-details">${rows}</div>`, 'profile-section')}</div></main>`;
}

function certificateSkeleton(hasResult) {
  const result = hasResult ? `<div class="sk-cert-result">${bar('sk-section-title')}${bar('sk-medium')}<div class="sk-actions sk-cert-actions">${bar('sk-button')}${bar('sk-button')}</div><div class="sk-cert-images">${bar('sk-cert-photo')}${bar('sk-cert-photo')}</div>${bar('sk-section-title')}${field()}${field()}</div>` : '';
  return `<main class="lookup-page sk-page"><section class="lookup-panel">${bar('sk-title')}${bar('sk-subtitle')}${bar('sk-input')}${result}</section></main>`;
}

function importSkeleton() {
  const rows = Array.from({length: 3}, () => `<li class="sk-import-row">${bar('sk-medium')}${bar('sk-label')}</li>`).join('');
  return `<main class="app-page import-page sk-page">${heading()}${panel(`${bar()}${bar('sk-medium')}<ul class="import-list">${rows}</ul>${bar('sk-section-title')}${bar()}${bar('sk-medium')}<div class="sk-actions">${bar('sk-button')}${bar('sk-button')}</div>`)}</main>`;
}

function privacySkeleton() {
  const sections = Array.from({length: 4}, () => `<div class="sk-privacy-section">${bar('sk-section-title')}${bar()}${bar()}${bar('sk-medium')}</div>`).join('');
  return `<main class="sk-page sk-privacy">${panel(heading())}${panel(sections)}</main>`;
}

function billingSkeleton() {
  const cards = Array.from({length: 3}, (_, index) => `<div class="billing-card ${index === 1 ? 'billing-card-featured' : ''}">${bar('sk-section-title')}${bar()}${bar('sk-title')}${bar()}${bar()}${bar()}${bar()}${bar('sk-medium')}${bar('sk-button')}${bar('sk-button sk-billing-purchase')}</div>`).join('');
  return `<main class="app-page billing-page sk-page"><div class="billing-heading">${bar('sk-title')}${bar('sk-subtitle')}</div><div class="billing-grid">${cards}</div>${bar('sk-label')}</main>`;
}

function usageSkeleton() {
  return `<main class="app-page sk-page">${heading()}${panel(`<div class="form-toolbar"><div class="form-field">${field()}</div><div class="form-field">${field()}</div>${bar('sk-button')}</div>${usageResultsSkeleton()}`)}</main>`;
}

const pageSkeletons = {
  '/': homeSkeleton,
  '/archive': intakeSkeleton,
  '/vault': vaultSkeleton,
  '/collections': collectionsSkeleton,
  '/label': labelSkeleton,
  '/profile': profileSkeleton,
  '/billing': billingSkeleton,
  '/gemini-usage': usageSkeleton,
  '/import': importSkeleton,
  '/privacy': privacySkeleton,
  '/privacy/': privacySkeleton,
};

export function usageResultsSkeleton() {
  return `<span class="sr-only">Loading usage…</span><div aria-hidden="true" class="sk-usage-results">${Array.from({length: 2}, () => `<div class="list-row"><div>${bar('sk-section-title')}${bar()}${bar('sk-medium')}</div></div>`).join('')}</div>`;
}

export function pageSkeleton(path, isCertificate) {
  const content = path === '/verify' || isCertificate
    ? certificateSkeleton(isCertificate)
    : (pageSkeletons[path] || homeSkeleton)();
  return `<div role="status" aria-live="polite"><span class="sr-only">Loading page…</span><div aria-hidden="true" inert>${content}</div></div>`;
}

export function sheetPreviewSkeleton(sheetCount) {
  const sheets = Array.from({length: sheetCount}, () => `<figure class="sheet-page">${bar('sk-sheet-caption')}<div class="skeleton sk-sheet-image"></div></figure>`).join('');
  return `<div role="status" aria-live="polite"><span class="sr-only">Loading preview…</span><div class="sheet-preview-pages sk-sheet-preview" aria-hidden="true">${sheets}</div></div>`;
}
