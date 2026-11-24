import test from 'node:test';
import assert from 'node:assert/strict';
import {skeletonFromElement} from '../components/skeleton-from-layout.js';

class TextNode {
  constructor(value) { this.nodeType = 3; this.nodeValue = value; }
  replaceWith(node) { this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 1, node); node.parent = this.parent; }
  remove() { this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 1); }
}
class Element {
  constructor(tag, attrs = {}, children = []) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = {...attrs}; this.childNodes = children;
    this.ownerDocument = {createElement: tagName => new Element(tagName)};
    for (const child of children) child.parent = this;
    this.classList = {
      contains: name => (this.attrs.class || '').split(' ').includes(name),
      add: name => { this.attrs.class = `${this.attrs.class || ''} ${name}`.trim(); }
    };
  }
  set className(value) { this.attrs.class = value; }
  get attributes() { return Object.keys(this.attrs).map(name => ({name})); }
  get hidden() { return 'hidden' in this.attrs; }
  get type() { return this.attrs.type || ''; }
  matches(selector) { return selector.split(',').includes(this.tagName.toLowerCase()); }
  removeAttribute(name) { delete this.attrs[name]; }
  setAttribute(name, value) { this.attrs[name] = value; }
  replaceChildren() { this.childNodes = []; }
  remove() { this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 1); }
  cloneNode() { return new Element(this.tagName, this.attrs, this.childNodes.map(child => child.nodeType === 3 ? new TextNode(child.nodeValue) : child.cloneNode(true))); }
  get outerHTML() { return `<${this.tagName} ${Object.entries(this.attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}>${this.childNodes.map(child => child.outerHTML || child.nodeValue).join('')}</${this.tagName}>`; }
}

test('generated skeleton preserves layout classes while removing private data and interactions', () => {
  const source = new Element('main', {class: 'vault-page', 'data-owner': 'private-owner'}, [
    new Element('section', {class: 'vault-list'}, [new TextNode('private card name'),
      new Element('input', {value: 'private value', oninput: 'alert(1)'}),
      new Element('img', {src: '/private-photo', alt: 'private name'}),
      new Element('a', {href: '/private-link'}, [new TextNode('private text')]),
      new Element('dialog', {}, [new TextNode('private dialog')])])]);
  const result = skeletonFromElement(source);
  assert.match(result, /vault-page sk-auto/);
  assert.match(result, /vault-list/);
  assert.match(result, /skeleton sk-auto-text/);
  assert.doesNotMatch(result, /private|oninput|href=|src=|DIALOG/);
  assert.match(source.outerHTML, /private card name/);
});
