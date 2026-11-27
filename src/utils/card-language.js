const languages = {en: 'English', ja: 'Japanese', th: 'Thai', ko: 'Korean', 'zh-tw': 'Chinese (Traditional)',
  'zh-cn': 'Chinese (Simplified)', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese',
  id: 'Indonesian', nl: 'Dutch', pl: 'Polish', ru: 'Russian'};

export function languageCode(value) {
  const text = String(value || '').trim().normalize('NFKC').toLocaleLowerCase();
  return Object.entries(languages).find(([code, label]) => text === code || text === label.toLocaleLowerCase())?.[0] || text;
}

export function languageName(value) {
  return languages[languageCode(value)] || value || '';
}
