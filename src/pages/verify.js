import {searchClearButton} from '../components/search-clear.js';
import {findByCert} from '../store/cards.js';
import {escapeHTML} from '../utils/format.js';
import {certificateFromPath, normalizeCert} from '../utils/cert.js';
import {classificationLabel} from '../utils/card-classification.js';
import {vaultBackground} from '../utils/vault-background.js';
import {cardImageVariant} from '../utils/card-image-variant.js';

export function certificateImages(card) {
  const actual = [['Front', card.frontImage], ['Back', card.backImage]].filter(([, url]) => url);
  return actual.length ? actual : (card.referenceImage ? [['Front · catalog reference', card.referenceImage]] : []);
}

function imageGallery(card) {
  const images = certificateImages(card);
  if (!images.length) return '';
  return `<section class="cert-gallery" aria-label="Card images">${images.map(([label, url]) => `
    <button class="cert-image" type="button" data-side="${label.startsWith('Back') ? 'back' : 'front'}" aria-label="Enlarge ${escapeHTML(label)} image">
      <img src="${escapeHTML(cardImageVariant(url, 'medium'))}" data-original="${escapeHTML(url)}" alt="${escapeHTML(card.name)} — ${escapeHTML(label)}" referrerpolicy="no-referrer" decoding="async">
      <span>${escapeHTML(label)}</span></button>`).join('')}</section>
    <dialog class="cert-viewer" data-cert="${escapeHTML(card.certNumber)}" aria-label="Enlarged card image"><div class="cert-viewer-toolbar"><span data-viewer-label></span><div class="cert-viewer-actions"><button type="button" data-viewer-download aria-label="Download image" title="Download image"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/></svg></button><button type="button" data-viewer-close aria-label="Close image viewer">×</button></div></div>
      <div class="cert-viewer-body"><div class="cert-viewer-thumbs"></div><div class="cert-viewer-stage"><div class="cert-viewer-image"><img alt="" referrerpolicy="no-referrer"><span class="cert-zoom" aria-hidden="true"></span></div></div></div>
      <p class="cert-viewer-download-status" role="status"></p><p class="cert-viewer-hint">All images created by DCR Card Vault at <a href="/">DCR Card Vault</a> and are copyrights of DCR Card Vault, all rights reserved.</p></dialog>`;
}

function languageName(value) {
  if (!value) return '';
  try {
    return new Intl.DisplayNames(['en'], {type: 'language'}).of(value) || value;
  } catch {
    return value;
  }
}

export function itemInformation(card, {showClassification = false} = {}) {
  const fields = [['Cert Number', card.certNumber], ['Condition', card.gradeLabel], ['Brand/Title', card.game],
    ['Year', card.year], ['Card Name', card.name], ['Set Name', card.setName], ...(showClassification ? [['Type', classificationLabel(card) || '—']] : []), ['Card Number', card.cardNumber],
    ['Rarity', card.rarity], ['Finish', card.sourceFinish], ['Language', languageName(card.sourceLanguage)]];
  return `<section class="cert-information"><h2>Item Information</h2><dl>${fields.filter(([, value]) => value).map(([label, value]) =>
    `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl></section>`;
}

function resultMarkup(cert, cards) {
  const normalized = normalizeCert(cert);
  if (!normalized) return '<div class="lookup-result lookup-error" role="status"><strong>Enter 1 to 8 digits for the certificate number.</strong></div>';
  const card = findByCert(cards, normalized);
  if (!card) return `<div class="lookup-result lookup-error" role="status"><strong>No record found</strong><p>Certificate ${escapeHTML(normalized)} was not found.</p></div>`;
  const subtitle = [card.year, card.setName, card.cardNumber].filter(Boolean).map(escapeHTML).join(' · ');
  return `<article class="cert-record" data-cert="${escapeHTML(normalized)}"><h2>${escapeHTML(card.name)}</h2><p class="cert-subtitle">${subtitle}</p><div class="cert-actions"><button class="btn btn-primary" type="button" data-cert-save><svg aria-hidden="true" width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M183.39 115.06A8 8 0 0 0 170.34 106.34L136 140.69V40A8 8 0 0 0 120.61 36.94A8 8 0 0 0 120 40V140.69L85.66 106.34A8 8 0 0 0 72.61 115.06A8 8 0 0 0 74.34 117.66L122.34 165.66A8 8 0 0 0 133.66 165.66L181.66 117.66A8 8 0 0 0 183.39 115.06ZM45.66 162.34A8 8 0 0 0 32 168V208A16 16 0 0 0 48 224H208A16 16 0 0 0 224 208V168A8 8 0 0 0 208.61 164.94A8 8 0 0 0 208 168V208H48V168A8 8 0 0 0 45.66 162.34Z"/></svg><span>Save</span></button><button class="btn btn-ghost" type="button" data-cert-share><svg aria-hidden="true" width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M154.62 40.44A8 8 0 0 0 144 48V72.19Q98.66 74.41 69.48 102.21Q32 137.9 32 208A8 8 0 0 0 46.66 212.44Q69.11 178.76 93.89 164.99Q114.53 153.53 144 152.18V176A8 8 0 0 0 157.31 181.98L229.31 117.98A8 8 0 0 0 229.31 106.02L157.31 42.02A8 8 0 0 0 154.62 40.44ZM159.39 140.94A8 8 0 0 0 152 136Q113.13 136 86.11 151.01Q67.01 161.62 49.54 182.02Q55.07 138.03 80.52 113.79Q107.6 88 152 88A8 8 0 0 0 160 80V65.81L211.96 112L160 158.19V144A8 8 0 0 0 159.39 140.94Z"/></svg><span>Share</span></button></div><dialog class="two-choice-dialog cert-share-dialog" aria-labelledby="cert-share-title" aria-describedby="cert-share-description"><button class="dialog-close" type="button" data-cert-share-close aria-label="Close" title="Close">×</button><h2 id="cert-share-title">Share Certificate</h2><p id="cert-share-description" class="two-choice-description">Anyone with the link can view these card details and available images.</p><div class="two-choice-actions cert-share-options"><button class="cert-share-icon" type="button" data-cert-copy aria-label="Copy link" data-tooltip="Copy link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13.5a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1l-1.4 1.4M14 10.5a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7.1 7.1l1.4-1.4"/></svg></button><a class="cert-share-icon" data-share-platform="line" target="_blank" rel="noopener noreferrer" aria-label="Share on LINE" data-tooltip="LINE"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg></a><a class="cert-share-icon" data-share-platform="facebook" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" data-tooltip="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg></a><a class="cert-share-icon" data-share-platform="x" target="_blank" rel="noopener noreferrer" aria-label="Share on X" data-tooltip="X"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg></a><button class="cert-share-icon" type="button" data-cert-native-share hidden aria-label="More sharing options" data-tooltip="More"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button></div></dialog>${imageGallery(card)}${itemInformation(card)}</article>`;
}

export function verify(cards = []) {
  const pathCert = certificateFromPath(location.pathname);
  const rawCert = pathCert ?? '';
  const cert = normalizeCert(rawCert) || rawCert;
  const card = normalizeCert(cert) ? findByCert(cards, normalizeCert(cert)) : null;
  const background = card ? vaultBackgroundFromCertificate(card) : '';
  return `<main class="lookup-page"><section class="lookup-panel" aria-labelledby="lookup-title">
    ${background ? `<img class="lookup-background" src="/assets/cert-background/${background}.webp" alt="" aria-hidden="true">` : ''}
    <div class="lookup-content">
    <h1 id="lookup-title">Certificate Verification</h1>
    <p class="lookup-description">Search any DCR certificate by number.</p>
    <form class="search-bar lookup-search" onsubmit="window.__searchCertificate(event)">
      <label class="sr-only" for="certificate-search">Certificate number</label>
      <input id="certificate-search" name="cert" type="text" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{1,8}" placeholder="Enter a Cert Number" value="${escapeHTML(cert)}" required>
      ${searchClearButton()}
      <button class="search-button" type="submit">Search</button></form>
    ${pathCert !== null ? resultMarkup(cert, cards) : ''}</div></section></main>`;
}

function vaultBackgroundFromCertificate(card) {
  const allowed = new Set(['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'dragon', 'fairy', 'colorless', 'item', 'pokemon-tool', 'supporter', 'stadium', 'basic-energy', 'special-energy', 'unknown']);
  return allowed.has(card.backgroundType) ? card.backgroundType : vaultBackground(card);
}
