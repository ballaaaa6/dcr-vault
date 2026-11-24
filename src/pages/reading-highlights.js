const aliases = {
  game: 'game', cardtype: 'game', cardtypelabel: 'game',
  language: 'language', sourcelanguage: 'language', languagelabel: 'language',
  year: 'year', printedyear: 'year', series: 'series',
  set: 'setName', setname: 'setName', englishsetname: 'setName', expansion: 'setName',
  cardnumber: 'cardNumber', collectornumber: 'cardNumber', number: 'cardNumber',
  name: 'name', cardname: 'name', englishname: 'name', rarity: 'rarity'
};

export function uncertainIntakeFields(fields) {
  return [...new Set((fields?.uncertainFields || []).map(value => aliases[String(value).toLowerCase().replace(/[^a-z]/g, '')]).filter(Boolean))];
}

export function clearReadingHighlights() {
  document.querySelectorAll('.reading-help').forEach(help => {
    help.hidden = true;
  });
}

export function showReadingHighlights(fields) {
  clearReadingHighlights();
  uncertainIntakeFields(fields).forEach(field => {
    const help = document.querySelector(`[data-catalog-control="${field}"]`)?.parentElement.querySelector('.reading-help');
    if (help) help.hidden = false;
  });
}

document.addEventListener('input', event => {
  const field = event.target.closest('[data-catalog-control]')?.parentElement;
  const help = field?.querySelector('.reading-help');
  if (help && !help.hidden) help.hidden = true;
});
