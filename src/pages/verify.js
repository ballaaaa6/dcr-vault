import {findByCert} from '../store/cards.js';
import {escapeHTML} from '../utils/format.js';
import {certificateFromPath, normalizeCert} from '../utils/cert.js';

export function certificateImages(card) {
  const actual = [['Front', card.frontImage], ['Back', card.backImage]].filter(([, url]) => url);
  return actual.length ? actual : (card.referenceImage ? [['Front · catalog reference', card.referenceImage]] : []);
}

function imageGallery(card) {
  const images = certificateImages(card);
  if (!images.length) return '';
  return `<section class="cert-gallery" aria-label="Card images">${images.map(([label, url]) => `
    <button class="cert-image" type="button" aria-label="Enlarge ${escapeHTML(label)} image">
      <img src="${escapeHTML(url)}" alt="${escapeHTML(card.name)} — ${escapeHTML(label)}" referrerpolicy="no-referrer">
      <span>${escapeHTML(label)}</span></button>`).join('')}</section>
    <dialog class="cert-viewer" aria-label="Enlarged card image"><div class="cert-viewer-toolbar"><span data-viewer-label></span><button type="button" data-viewer-close aria-label="Close image viewer">×</button></div>
      <div class="cert-viewer-body"><div class="cert-viewer-thumbs"></div><div class="cert-viewer-image"><img alt="" referrerpolicy="no-referrer"><span class="cert-zoom" aria-hidden="true"></span></div></div>
      <p class="cert-viewer-hint">Move over the image to magnify. On touch screens, tap the image to zoom.</p></dialog>`;
}

function languageName(value) {
  if (!value) return '';
  try {
    return new Intl.DisplayNames(['en'], {type: 'language'}).of(value) || value;
  } catch {
    return value;
  }
}

function itemInformation(card) {
  const fields = [['Cert Number', card.certNumber], ['Condition', card.gradeLabel], ['Year', card.year],
    ['Brand/Title', card.game], ['Set', card.setName], ['Card Name', card.name], ['Card Number', card.cardNumber],
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
  return `<article class="cert-record"><h2>${escapeHTML(card.name)}</h2><p class="cert-subtitle">${subtitle}</p>${imageGallery(card)}${itemInformation(card)}</article>`;
}

export function verify(cards = []) {
  const params = new URLSearchParams(location.search);
  const pathCert = certificateFromPath(location.pathname);
  const rawCert = pathCert ?? params.get('cert') ?? '';
  const cert = normalizeCert(rawCert) || rawCert;
  return `<main class="lookup-page"><section class="lookup-panel" aria-labelledby="lookup-title">
    <div class="lookup-kicker">DCR CARD VAULT</div><h1 id="lookup-title">Certificate lookup</h1>
    <p class="lookup-description">Search any DCR certificate by number.</p>
    <form class="search-bar lookup-search" onsubmit="window.__searchCertificate(event)">
      <label class="sr-only" for="certificate-search">Certificate number</label>
      <input id="certificate-search" name="cert" type="text" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{1,8}" placeholder="Enter 1 to 8 digits" value="${escapeHTML(cert)}" required>
      <button class="search-button" type="submit">Search</button></form>
    ${pathCert !== null || params.has('cert') ? resultMarkup(cert, cards) : ''}</section></main>`;
}
