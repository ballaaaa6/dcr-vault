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
  return `<article class="cert-record" data-cert="${escapeHTML(normalized)}"><h2>${escapeHTML(card.name)}</h2><p class="cert-subtitle">${subtitle}</p><div class="cert-actions"><button class="btn btn-primary" type="button" data-cert-save>↓ Save</button><button class="btn btn-ghost" type="button" data-cert-share>↗ Share</button></div><dialog class="two-choice-dialog cert-share-dialog" aria-labelledby="cert-share-title" aria-describedby="cert-share-description"><h2 id="cert-share-title">Share Certificate</h2><p id="cert-share-description" class="two-choice-description">Anyone with the link can view these card details and available images.</p><div class="two-choice-actions"><button class="btn btn-primary" type="button" data-cert-copy>Copy link</button><button class="btn btn-ghost" type="button" data-cert-native-share hidden>Share</button><button class="btn btn-ghost" type="button" data-cert-share-close>Close</button></div></dialog>${imageGallery(card)}${itemInformation(card)}</article>`;
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
