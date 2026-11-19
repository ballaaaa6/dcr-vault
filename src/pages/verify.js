import {findByCert} from '../store/cards.js';
import {escapeHTML} from '../utils/format.js';
import {normalizeCert} from '../utils/cert.js';

function resultMarkup(cert, cards) {
  const normalized = normalizeCert(cert);
  if (!normalized) {
    return `<div class="lookup-result lookup-error" role="status"><strong>Enter 1 to 8 digits for the certificate number.</strong><p>Check the number on your DCR label and try again.</p></div>`;
  }

  const card = findByCert(cards, normalized);
  if (!card) {
    return `<div class="lookup-result lookup-error" role="status"><strong>No record found</strong><p>Certificate ${escapeHTML(normalized)} is not in your account's collection.</p></div>`;
  }

  const details = [card.setName, card.year, card.cardNumber, card.rarity].map(escapeHTML).filter(Boolean).join(' • ');
  return `
    <section class="lookup-result lookup-found" aria-label="Certificate record">
      <div class="lookup-result-heading">
        <span class="record-status">Certificate record found</span>
        <img src="/assets/logo/dcr-mark.svg" alt="DCR">
      </div>
      <h2>${escapeHTML(card.name)}</h2>
      <p class="record-details">${details}</p>
      <div class="record-cert"><span>Grade</span><strong>${escapeHTML(card.gradeLabel)}</strong><span>Cert</span><strong>${escapeHTML(card.certNumber)}</strong></div>
    </section>`;
}

export function verify(cards = []) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const hasCert = params.has('cert');
  const rawCert = params.get('cert') || '';
  const cert = normalizeCert(rawCert) || rawCert;
  const result = hasCert ? resultMarkup(cert, cards) : '';

  return `
    <main class="lookup-page">
      <section class="lookup-panel" aria-labelledby="lookup-title">
        <div class="lookup-kicker">DCR CARD VAULT</div>
        <h1 id="lookup-title">Certificate lookup</h1>
        <p class="lookup-description">Search with 1 to 8 digits; matching records display the full 8-digit Cert number.</p>
        <form class="search-bar lookup-search" onsubmit="window.__searchCertificate(event)">
          <input id="certificate-search" name="cert" type="text" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{1,8}" placeholder="Enter 1 to 8 digits" value="${escapeHTML(cert)}" required>
          <button class="search-button" type="submit">Search</button>
        </form>
        ${result}
      </section>
    </main>`;
}
