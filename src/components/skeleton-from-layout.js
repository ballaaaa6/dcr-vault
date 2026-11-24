const cachePrefix = 'dcr-skeleton-v1:';
const discard = 'dialog,script,style,template,iframe,object,embed,link,meta';
const emptyTags = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function cacheKey(path, userId) {
  const build = document.querySelector('script[type="module"][src]')?.getAttribute('src') || '';
  return `${cachePrefix}${build}:${userId || 'guest'}:${path}`;
}

function placeholder(documentRef) {
  const span = documentRef.createElement('span');
  span.className = 'skeleton sk-auto-text';
  return span;
}

function cleanElement(element) {
  if (element.matches(discard) || element.hidden || element.classList.contains('sr-only')) {
    element.remove();
    return;
  }
  const inputType = element.tagName === 'INPUT' && ['checkbox', 'radio'].includes(element.type) ? element.type : '';
  for (const attribute of [...element.attributes]) {
    if (attribute.name !== 'class') element.removeAttribute(attribute.name);
  }
  if (inputType) element.setAttribute('type', inputType);
  if (element.tagName === 'IMG') element.setAttribute('alt', '');
  if (emptyTags.has(element.tagName)) element.replaceChildren();
  if (element.matches('input,textarea,select,button,summary,img,svg')) element.classList.add('sk-auto-control');
  for (const child of [...element.childNodes]) {
    if (child.nodeType === 3) {
      if (child.nodeValue.trim()) child.replaceWith(placeholder(element.ownerDocument));
      else child.remove();
    } else if (child.nodeType === 1) cleanElement(child);
    else child.remove();
  }
}

export function skeletonFromElement(element) {
  if (!element) return '';
  const clone = element.cloneNode(true);
  cleanElement(clone);
  clone.classList.add('sk-auto');
  return clone.outerHTML;
}

export function savePageSkeleton(path, userId, main) {
  try {
    const markup = skeletonFromElement(main);
    if (markup && markup.length <= 100000) sessionStorage.setItem(cacheKey(path, userId), markup);
  } catch {}
}

export function cachedPageSkeleton(path, userId) {
  try {
    const markup = sessionStorage.getItem(cacheKey(path, userId));
    if (!markup) return '';
    const template = document.createElement('template');
    template.innerHTML = markup;
    const main = template.content.querySelector('main');
    if (!main) return '';
    return skeletonFromElement(main);
  } catch { return ''; }
}
