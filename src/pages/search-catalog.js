import {intakeTooltip} from './intake-tooltip.js';
import {CARD_GAMES} from '../utils/card-games.js';

let roots = [];
let onEdit = () => {};
let mountVersion = 0;

export function catalogField(id, label, placeholder, {wide = false, required = true} = {}) {
  const maxLength = id === 'year' ? 4 : id === 'cardNumber' ? 30 : 120;
  return `<div class="form-field${wide ? ' intake-wide' : ''}"><div class="reading-label"><label for="m-${id}-input">${label}${required ? ' <span class="required-mark" aria-hidden="true">*</span>' : ''}</label>${intakeTooltip(id, label)}<span class="reading-help" hidden><button type="button" class="reading-help-button" aria-label="Why ${label} needs review" aria-describedby="reading-tooltip-${id}">i</button><span id="reading-tooltip-${id}" class="reading-tooltip" role="tooltip">Please review this detail to make sure it’s correct.</span></span></div><div class="catalog-control" data-catalog-control="${id}">
    <input type="hidden" id="m-${id}" ${required ? 'required' : ''} data-catalog-field="${id}">
    <div data-catalog-mount="${id}" data-label="${label}" data-placeholder="${placeholder}" data-maxlength="${maxLength}"></div>
  </div></div>`;
}

async function optionsFor(field, query) {
  const values = field === 'game' ? CARD_GAMES : field === 'language' ? ['English', 'Japanese', 'Thai', 'Korean', 'Chinese (Simplified)', 'Chinese (Traditional)', 'German', 'French', 'Italian', 'Portuguese', 'Spanish', 'Indonesian', 'Dutch', 'Polish', 'Russian'] : [];
  return values.filter(value => value.toLowerCase().includes(query.toLowerCase()));
}

async function warnIfUnmatched() {
  // Free-form values need no catalog match.
}

export function invalidateCatalogSuggestions() {
  window.dispatchEvent(new Event('intake-catalog-close'));
}

export function closeCatalogOnOutsideClick(target, root = document) {
  if (root.querySelector('.intake-page') && !target.closest('[data-catalog-control]')) invalidateCatalogSuggestions();
}

export function destroyCatalogSuggestions() {
  mountVersion += 1;
  roots.forEach(root => root.unmount());
  roots = [];
}

export async function initializeCatalogSuggestions() {
  destroyCatalogSuggestions();
  const version = mountVersion;
  const [{createRoot}, {createElement}, {catalogSelect}] = await Promise.all([
    import('react-dom/client'), import('react'), import('../components/catalog-select.js')
  ]);
  if (version !== mountVersion) return;
  document.querySelectorAll('[data-catalog-mount]').forEach(element => {
    const field = element.dataset.catalogMount;
    const root = createRoot(element);
    root.render(createElement(catalogSelect, {field, label: element.dataset.label, placeholder: element.dataset.placeholder,
      maxLength: Number(element.dataset.maxlength), optionsFor, onEdit, onBlur: warnIfUnmatched}));
    roots.push(root);
  });
}

export function installCatalogSuggestions(callback) { onEdit = callback; }
