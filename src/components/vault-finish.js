import {dropdown} from './dropdown.js';
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
  return `<div class="form-field" data-vault-finish><span>Finish</span><input type="hidden" name="sourceFinish" value="${escapeHTML(value)}"><div data-finish-control></div></div>`;
}

function renderDropdown(mount, value) {
  mount.innerHTML = dropdown({id: 'vault-finish-choice', label: 'Finish',
    options: choices.map(choice => [choice, choice || 'Not selected']), value: choices.includes(value) ? value : ''});
  const summary = mount.querySelector('summary');
  summary.querySelector('[data-dropdown-current]').textContent = display(value);
  summary.dataset.empty = String(!value);
  summary.setAttribute('aria-label', `Finish: ${display(value)}`);
  for (const button of mount.querySelectorAll('[data-dropdown-value]')) {
    if (patterns[button.dataset.dropdownValue]) {
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      button.insertAdjacentHTML('beforeend', '<span aria-hidden="true">›</span>');
    }
  }
}

function openPatterns(mount, button, category, choose) {
  mount.querySelector('[data-finish-submenu]')?.remove();
  mount.querySelectorAll('[aria-haspopup="menu"]').forEach(item => item.setAttribute('aria-expanded', 'false'));
  button.setAttribute('aria-expanded', 'true');
  const submenu = document.createElement('div');
  submenu.className = 'dropdown-menu vault-finish-submenu';
  submenu.dataset.finishSubmenu = '';
  submenu.setAttribute('role', 'menu');
  submenu.setAttribute('aria-label', `${category} pattern`);
  submenu.innerHTML = [...patterns[category], 'Unknown', 'Other'].map(value =>
    `<button type="button" role="menuitem" data-finish-pattern="${escapeHTML(value)}">${escapeHTML(value)}</button>`).join('');
  mount.querySelector('.dropdown-control').append(submenu);
  const rect = button.getBoundingClientRect();
  submenu.style.left = `${rect.right + submenu.offsetWidth + 8 <= innerWidth ? rect.right + 4 : Math.max(4, rect.left - submenu.offsetWidth - 4)}px`;
  submenu.style.top = `${Math.max(4, Math.min(rect.top, innerHeight - submenu.offsetHeight - 4))}px`;
  submenu.addEventListener('click', event => {
    const item = event.target.closest('[data-finish-pattern]');
    if (!item) return;
    event.stopPropagation();
    choose(category, item.dataset.finishPattern);
  });
  submenu.querySelector('button').focus();
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
    mount.innerHTML = `<div class="vault-finish-custom"><button type="button" data-finish-back aria-label="Return to finish choices">←</button><input class="form-control" aria-label="Other finish" placeholder="Enter finish" maxlength="${80 - prefix.length}"></div>`;
    const input = mount.querySelector('input');
    input.addEventListener('input', () => save(input.value.trim() ? prefix + input.value.trim() : ''));
    input.focus();
  }
  function choose(category, pattern) {
    if (pattern === 'Other') { save(''); custom(category); return; }
    save(pattern === 'Standard' ? category : `${category} - ${pattern}`);
    renderDropdown(mount, saved.value);
    mount.querySelector('summary').focus();
  }
  mount.addEventListener('click', event => {
    if (event.target.closest('[data-finish-back]')) { renderDropdown(mount, saved.value); mount.querySelector('summary').focus(); return; }
    const button = event.target.closest('[data-dropdown-value]');
    if (!button) return;
    const value = button.dataset.dropdownValue;
    if (patterns[value]) { event.stopPropagation(); openPatterns(mount, button, value, choose); }
    else if (value === 'Other') { event.stopPropagation(); save(''); custom(); }
  }, true);
  mount.addEventListener('change', event => {
    if (event.target.id !== 'vault-finish-choice') return;
    save(event.target.value === 'Unknown' ? '' : event.target.value);
    renderDropdown(mount, saved.value);
    mount.querySelector('summary').focus();
  });
  renderDropdown(mount, saved.value);
}
