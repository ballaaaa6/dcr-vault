import {searchIcon} from '../components/search-icon.js';
import {searchClearButton} from '../components/search-clear.js';
import {certificatePath} from '../utils/cert.js';

export function home() {
  return `
    <main class="home-page">
      <section class="home-hero" aria-labelledby="home-title">
        <div class="home-copy">

          <h1 class="home-title" id="home-title">Your cards.<br>Your collection.<br><span>All in one place.</span></h1>
          <p class="home-description">Organize your DCR-certified cards and find certificate details in seconds.</p>
          <form class="home-search-form" onsubmit="window.__searchCertificate(event)">
            <label class="search-label" for="certificate-search">Search by certificate number</label>
            <div class="search-bar">
              <input id="certificate-search" name="cert" type="text" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{1,8}" oninput="this.value = this.value.replace(/[^0-9]/g, '')" placeholder="Enter a Cert Number" aria-describedby="certificate-search-hint" required>
              ${searchClearButton()}
              <button class="search-button" type="submit">
                ${searchIcon()}
                <span>Search</span>
              </button>
            </div>
            <p class="search-hint" id="certificate-search-hint">Search any DCR certificate without signing in.<br>Enter the certificate number to view its details.</p>
          </form>
          <nav class="home-benefits" aria-label="Vault shortcuts">
            <a class="home-benefit" href="/archive"><img src="/assets/home/add-card.png" alt=""><strong>Add Card</strong><span>Find and add cards to your vault</span></a>
            <a class="home-benefit" href="/vault"><img src="/assets/home/my-vault.png" alt=""><strong>Vault</strong><span>View and manage your collection</span></a>
            <a class="home-benefit" href="/label"><img src="/assets/home/labels.png" alt=""><strong>Labels</strong><span>Create and print card labels</span></a>
          </nav>
        </div>
        <div class="home-art" aria-hidden="true"><iframe class="home-glitter" src="https://benrilab.com/en/app/movie-particle/?mode=obs#v1;p=glitter;n=40;z=75;v=70" title="" tabindex="-1" loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe></div>
      </section>
    </main>`;
}

window.__searchCertificate = event => {
  event.preventDefault();
  location.href = certificatePath(document.getElementById('certificate-search').value);
};
