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
  return `<article class="cert-record" data-cert="${escapeHTML(normalized)}"><h2>${escapeHTML(card.name)}</h2><p class="cert-subtitle">${subtitle}</p><div class="cert-actions"><button class="btn btn-primary" type="button" data-cert-save><svg aria-hidden="true" width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M183.39 115.06A8 8 0 0 0 170.34 106.34L136 140.69V40A8 8 0 0 0 120.61 36.94A8 8 0 0 0 120 40V140.69L85.66 106.34A8 8 0 0 0 72.61 115.06A8 8 0 0 0 74.34 117.66L122.34 165.66A8 8 0 0 0 133.66 165.66L181.66 117.66A8 8 0 0 0 183.39 115.06ZM45.66 162.34A8 8 0 0 0 32 168V208A16 16 0 0 0 48 224H208A16 16 0 0 0 224 208V168A8 8 0 0 0 208.61 164.94A8 8 0 0 0 208 168V208H48V168A8 8 0 0 0 45.66 162.34Z"/></svg><span>Save</span></button><button class="btn btn-ghost" type="button" data-cert-share><svg aria-hidden="true" width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M154.62 40.44A8 8 0 0 0 144 48V72.19Q98.66 74.41 69.48 102.21Q32 137.9 32 208A8 8 0 0 0 46.66 212.44Q69.11 178.76 93.89 164.99Q114.53 153.53 144 152.18V176A8 8 0 0 0 157.31 181.98L229.31 117.98A8 8 0 0 0 229.31 106.02L157.31 42.02A8 8 0 0 0 154.62 40.44ZM159.39 140.94A8 8 0 0 0 152 136Q113.13 136 86.11 151.01Q67.01 161.62 49.54 182.02Q55.07 138.03 80.52 113.79Q107.6 88 152 88A8 8 0 0 0 160 80V65.81L211.96 112L160 158.19V144A8 8 0 0 0 159.39 140.94Z"/></svg><span>Share</span></button></div><dialog class="two-choice-dialog cert-share-dialog" aria-labelledby="cert-share-title" aria-describedby="cert-share-description"><h2 id="cert-share-title">Share Certificate</h2><p id="cert-share-description" class="two-choice-description">Anyone with the link can view these card details and available images.</p><div class="two-choice-actions"><button class="btn btn-primary" type="button" data-cert-copy>Copy link</button><a class="btn btn-ghost" data-share-platform="line" target="_blank" rel="noopener noreferrer">LINE</a><a class="btn btn-ghost" data-share-platform="facebook" target="_blank" rel="noopener noreferrer">Facebook</a><a class="btn btn-ghost" data-share-platform="x" target="_blank" rel="noopener noreferrer">X</a><button class="btn btn-ghost" type="button" data-cert-native-share hidden>More</button><button class="btn btn-ghost" type="button" data-cert-share-close>Close</button></div></dialog>${imageGallery(card)}${itemInformation(card)}</article>`;
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
