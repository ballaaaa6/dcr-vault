import {normalizeCert} from '../utils/cert.js';

export function home() {
  return `
    <main class="home-page">
      <section class="home-hero" aria-labelledby="home-title">
        <div class="home-copy">
          <div class="home-kicker"><span aria-hidden="true"></span>DCR CARD VAULT</div>
          <h1 class="home-title" id="home-title">Your collection,<br><span>kept together.</span></h1>
          <p class="home-description">Keep your DCR certified collection organized, then find a saved card with its certificate number.</p>
          <form class="home-search-form" onsubmit="window.__searchCertificate(event)">
            <label class="search-label" for="certificate-search">Search by certificate number</label>
            <div class="search-bar">
              <input id="certificate-search" name="cert" type="text" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{1,8}" placeholder="Enter 1 to 8 digits" aria-describedby="certificate-search-hint" required>
              <button class="search-button" type="submit">
                <span>Search</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m15.5 15.5 4.2 4.2"></path></svg>
              </button>
            </div>
            <p class="search-hint" id="certificate-search-hint">Sign in to search certificate numbers in your private collection.</p>
          </form>
        </div>
        <div class="home-art" aria-hidden="true">
          <div class="art-orbit"></div>
          <div class="art-card art-card-back"></div>
          <div class="art-card art-card-front">
            <div class="art-card-header"><span>DCR CERTIFIED</span><span class="art-seal">DCR</span></div>
            <div class="art-card-center"><img src="/assets/logo/dcr-mark.svg" alt=""></div>
            <div class="art-card-footer"><span>COLLECTION RECORD</span><strong>CARD VAULT</strong></div>
          </div>
        </div>
      </section>
    </main>`;
}

window.__searchCertificate = event => {
  event.preventDefault();
  const cert = normalizeCert(document.getElementById('certificate-search').value);
  location.href = '/verify?cert=' + encodeURIComponent(cert || document.getElementById('certificate-search').value.trim());
};
