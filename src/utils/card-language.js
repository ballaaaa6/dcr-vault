const languages = {en: 'English', ja: 'Japanese', th: 'Thai', ko: 'Korean', 'zh-tw': 'Chinese (Traditional)',
  'zh-cn': 'Chinese (Simplified)', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese',
  id: 'Indonesian', nl: 'Dutch', pl: 'Polish', ru: 'Russian'};

export function languageName(value) {
  const text = String(value || '').trim();
  return languages[text.toLowerCase()] || text;
}

export function labelLanguage(value, legacyLabel = '') {
  const language = String(value || '').trim();
  const legacyCode = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(language);
  return (legacyCode && legacyLabel ? legacyLabel : languageName(language)).toUpperCase();
}
