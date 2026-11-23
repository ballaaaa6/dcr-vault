export function readingConflict(fields, selectedLanguage, languageEdited) {
  const game = String(fields.cardTypeLabel || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (game && !/pokemon/i.test(game)) {
    return 'The image may not match the selected Pokémon card game. Review the image and enter the details manually.';
  }
  if (languageEdited && selectedLanguage && fields.language && selectedLanguage !== fields.language) {
    return 'The card language may differ from the selected language. Review the image and language before identifying again.';
  }
  return '';
}
