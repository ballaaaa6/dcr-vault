export function searchClearButton() {
  return '<button class="search-clear" type="button" aria-label="Clear search" title="Clear search" onclick="window.__clearSearch(this)">×</button>';
}

if (typeof window !== 'undefined') window.__clearSearch = button => {
  const bar = button.closest('.search-bar');
  const input = bar.querySelector('input');
  input.value = '';
  if (input.id === 'vault-q') window.__filterVault();
  if (bar.classList.contains('lookup-search')) {
    document.querySelector('.lookup-result, .cert-record')?.remove();
    document.querySelector('.lookup-background')?.remove();
    history.replaceState(history.state, '', '/verify');
  }
  input.focus();
};
