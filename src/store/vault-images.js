import {loadCatalogCards} from './catalog.js';
import {findVaultImage} from '../utils/vault-images.js';

let sourcesPromise;

export async function addVaultImages(cards) {
  try {
    sourcesPromise ||= fetch('/data/card-image-sources.json').then(response => {
      if (!response.ok) throw new Error('Image index unavailable');
      return response.json();
    }).catch(error => { sourcesPromise = null; throw error; });
    const [catalog, sources] = await Promise.all([loadCatalogCards(), sourcesPromise]);
    return cards.map(card => ({...card, referenceImage: findVaultImage(card, catalog, sources)}));
  } catch {
    return cards;
  }
}
