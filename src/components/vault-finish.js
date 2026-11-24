import {vaultTooltip} from './vault-tooltip.js';
import {dropdown} from './dropdown.js';
import {prepareNestedDropdown, openNestedDropdown} from './nested-dropdown.js';
import {escapeHTML} from '../utils/format.js';

const patterns = {
  Holofoil: ['Standard', 'Starlight', 'Cosmos', 'Tinsel', 'Sheen', 'Water Web', 'Vertical Lines', 'Mirage', 'Cracked Ice'],
  'Reverse Holofoil': ['Standard', 'Poké Ball', 'Great Ball', 'Ultra Ball', 'Master Ball', 'Friend Ball', 'Love Ball', 'Dusk Ball', 'Quick Ball', 'Energy Symbol', 'Team Rocket', 'Fireworks', 'Cosmos'],
  'Other Foil': ['Textured Foil']
};
const choices = ['', 'Normal', ...Object.keys(patterns), 'Unknown', 'Other'];
const display = value => value.replace(/\s+—\s+/g, ' - ') || 'Not selected';

export function vaultFinishInput(value = '') {
  if (value.trim() === '— 454') value = '';
  return `<div class="form-field" data-vault-finish><div><span>Finish</span>${vaultTooltip('sourceFinish', 'Finish')}</div><input type="hidden" name="sourceFinish" value="${escapeHTML(value)}"><div data-finish-control></div></div>`;
}

function renderDropdown(mount, value) {
  mount.innerHTML = dropdown({id: 'vault-finish-choice', label: 'Finish',
    options: choices.map(choice => [choice, choice || 'Not selected']), value: choices.includes(value) ? value : ''});
  const summary = mount.querySelector('summary');
  summary.querySelector('[data-dropdown-current]').textContent = display(value);
  summary.dataset.empty = String(!value);
  summary.setAttribute('aria-label', `Finish: ${display(value)}`);
  prepareNestedDropdown(mount, patterns);
}

export function initializeVaultFinish(form) {
  const row = form.querySelector('[data-vault-finish]');
  const saved = row.querySelector('[name="sourceFinish"]');
  const mount = row.querySelector('[data-finish-control]');
  function save(value) {
    saved.value = value;
    saved.dispatchEvent(new Event('change', {bubbles: true}));
  }
  function custom(category = '') {
    const prefix = category ? `${category} - ` : '';
    mount.innerHTML = `<div class="vault-finish-custom form-control"><button type="button" data-finish-back aria-label="Return to finish choices">←</button>${category ? `<span class="vault-finish-prefix">${escapeHTML(category)} -</span>` : ''}<input aria-label="${escapeHTML(category ? `${category} other pattern` : 'Other finish')}" placeholder="Enter finish" maxlength="${80 - prefix.length}"></div>`;
    const input = mount.querySelector('input');
    input.addEventListener('input', () => save(input.value.trim() ? prefix + input.value.trim() : ''));
    input.focus();
  }
  function choose(category, pattern) {
    if (pattern === 'Other') { save(''); custom(category); return; }
    save(`${category} - ${pattern}`);
    renderDropdown(mount, saved.value);
    mount.querySelector('summary').focus();
  }
  mount.addEventListener('click', event => {
    if (event.target.closest('[data-finish-back]')) { renderDropdown(mount, saved.value); mount.querySelector('summary').focus(); return; }
    const button = event.target.closest('[data-dropdown-value]');
    if (!button) return;
    const value = button.dataset.dropdownValue;
    if (patterns[value]) { event.stopPropagation(); openNestedDropdown(mount, button, `${value} pattern`, [...patterns[value], 'Unknown', 'Other'].map(item => [item, item]), pattern => choose(value, pattern)); }
    else if (value === 'Other') { event.stopPropagation(); save(''); custom(); }
  }, true);
  mount.addEventListener('change', event => {
    if (event.target.id !== 'vault-finish-choice') return;
    save(event.target.value);
    renderDropdown(mount, saved.value);
    mount.querySelector('summary').focus();
  });
  renderDropdown(mount, saved.value);
}
