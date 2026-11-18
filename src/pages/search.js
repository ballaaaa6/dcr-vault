import {addCard} from '../store/cards.js';

export function search() {
  return `
    <main class="app-page">
      <header class="page-heading"><div class="page-eyebrow">COLLECTION INTAKE</div><h1>Add a card to your vault</h1><p class="page-description">Card details are saved privately to your signed-in account.</p></header>
      <div class="intake-grid">
        <section class="surface-card intake-card" aria-labelledby="scan-title">
          <div class="section-heading"><span class="section-number">01</span><div><h2 id="scan-title">Card images</h2><p>Image recognition is not connected yet.</p></div></div>
          <div class="upload-grid"><label class="upload-field"><span>Front image</span><input type="file" accept="image/*" disabled></label><label class="upload-field"><span>Back image</span><input type="file" accept="image/*" disabled></label></div>
          <p class="import-privacy">Photos are not uploaded or stored. Add a card using its printed details in the form.</p>
        </section>
        <section class="surface-card intake-card" aria-labelledby="manual-title">
          <div class="section-heading"><span class="section-number">02</span><div><h2 id="manual-title">Card details</h2><p>Enter the Cert number printed on your DCR label.</p></div></div>
          <div class="field-grid">
            <label class="form-field"><span>Name</span><input class="form-control" id="m-name" maxlength="120" placeholder="e.g. Charizard" required></label>
            <label class="form-field"><span>Cert number</span><input class="form-control" id="m-cert" inputmode="numeric" maxlength="8" pattern="[0-9]{8}" placeholder="8 digits" required></label>
            <label class="form-field"><span>Set</span><input class="form-control" id="m-set" maxlength="120" placeholder="e.g. Base Set"></label>
            <label class="form-field"><span>Year</span><input class="form-control" id="m-year" maxlength="4" placeholder="e.g. 1999"></label>
            <label class="form-field"><span>Card number</span><input class="form-control" id="m-num" maxlength="30" placeholder="e.g. #4"></label>
            <label class="form-field"><span>Grade</span><input class="form-control" id="m-grade" maxlength="60" placeholder="e.g. GEM MT 10"></label>
          </div>
          <button class="btn btn-primary manual-submit" id="manual-submit" type="button" onclick="window.__manual()">Add to Vault</button>
          <p id="manual-status" class="import-status" role="status" aria-live="polite"></p>
        </section>
      </div>
    </main>`;
}

window.__manual = async () => {
  const status = document.getElementById('manual-status');
  const button = document.getElementById('manual-submit');
  const name = document.getElementById('m-name').value.trim();
  const certNumber = document.getElementById('m-cert').value.trim();
  if (!name || !/^[0-9]{8}$/.test(certNumber)) {
    status.textContent = 'Enter a card name and its 8-digit Cert number.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Saving card…';
  try {
    await addCard({game: 'other', name, certNumber, setName: document.getElementById('m-set').value,
      year: document.getElementById('m-year').value, cardNumber: document.getElementById('m-num').value,
      gradeLabel: document.getElementById('m-grade').value, status: 'in-vault'});
    location.hash = '#/vault';
  } catch (error) {
    status.textContent = error.message || 'This card could not be saved.';
    button.disabled = false;
  }
};
