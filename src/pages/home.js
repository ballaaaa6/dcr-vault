import {certificatePath} from '../utils/cert.js';

export function home() {
  return `
    <main class="home-page">
      <section class="home-hero" aria-labelledby="home-title">
        <div class="home-copy">
          <div class="home-eyebrow">Your collection, organized</div>
          <h1 class="home-title" id="home-title">Your cards.<br>Your collection.<br><span>All in one place.</span></h1>
          <p class="home-description">Organize your DCR-certified cards and find certificate details in seconds.</p>
          <form class="home-search-form" onsubmit="window.__searchCertificate(event)">
            <label class="search-label" for="certificate-search">Search by certificate number</label>
            <div class="search-bar">
              <input id="certificate-search" name="cert" type="text" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{1,8}" placeholder="Enter a Cert Number" aria-describedby="certificate-search-hint" required>
              <button class="search-button" type="submit">
                <span>Search</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m15.5 15.5 4.2 4.2"></path></svg>
              </button>
            </div>
            <p class="search-hint" id="certificate-search-hint">Search any DCR certificate without signing in.<br>Enter the certificate number to view its details.</p>
          </form>
          <nav class="home-benefits" aria-label="Vault shortcuts">
            <a class="home-benefit" href="/register"><img src="/assets/home/add-card.png" alt=""><strong>Add Card</strong><span>Find and add cards to your vault</span></a>
            <a class="home-benefit" href="/vault"><img src="/assets/home/my-vault.png" alt=""><strong>My Vault</strong><span>View and manage your collection</span></a>
            <a class="home-benefit" href="/label"><img src="/assets/home/labels.png" alt=""><strong>Labels</strong><span>Create and print card labels</span></a>
          </nav>
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
  location.href = certificatePath(document.getElementById('certificate-search').value);
};
