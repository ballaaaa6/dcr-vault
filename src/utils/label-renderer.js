import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import {formatRarity} from './rarity.js';
import {publicCertificateUrl} from './cert.js';
import frontMasterUrl from '../../dcr-tag-70x20/source/dcr-tag-front.svg?url';
import backMasterUrl from '../../dcr-tag-70x20/source/dcr-tag-back.svg?url';
import sheetMasterUrl from '../../dcr-tag-70x20/source/a4-40up-portrait.svg?url';
import {hasNonLatinScript} from './language.js';
import {CONDITION_OPTIONS} from './label-options.js';
import {cardLabelMetadata, cardSeries} from './label-metadata.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const FONT_SIZE_MM = 2.57;
const TEXT_GAP_MM = 2;
const frontMaster = loadTemplate(frontMasterUrl);
const backMaster = loadTemplate(backMasterUrl);
const sheetMaster = loadTemplate(sheetMasterUrl);

export {CONDITION_OPTIONS};

async function loadTemplate(url) {
  const response = await fetch(url, {credentials: 'same-origin'});
  if (!response.ok) throw new Error('An approved label SVG template could not be loaded.');
  return response.text();
}

export const normalizeRarity = formatRarity;

function normalizeCardNumber(value) {
  const first = String(value ?? '').trim().split('/')[0].trim();
  if (!first) return '';
  return first.startsWith('#') ? first : `#${first}`;
}

function conditionFromGrade(value) {
  const grade = String(value ?? '').trim().toLocaleUpperCase('en-US');
  const condition = grade.replace(/\s+\d+(?:\.\d+)?$/, '');
  return CONDITION_OPTIONS.includes(condition) ? condition : '';
}

export function cardLabelData(card) {
  const metadata = cardLabelMetadata(card);
  return {
    year: String(card.year ?? '').trim(),
    cardType: String(card.cardTypeLabel || (String(card.game || '').toLowerCase() === 'pokemon' ? 'POKÉMON' : card.game || '')).trim(),
    series: String(card.series || cardSeries(card)).trim(),
    language: String(card.sourceLanguage || card.language || '').toLowerCase(),
    languageLabel: String(card.languageLabel || '').trim(),
    name: String(card.name ?? '').trim(),
    setName: metadata.setName,
    cardNumber: normalizeCardNumber(card.cardNumber),
    condition: conditionFromGrade(card.gradeLabel),
    rarity: normalizeRarity(card.rarity),
    certNumber: String(card.certNumber ?? '').trim(),
  };
}

function cleanLabelData(data) {
  return {
    year: String(data.year ?? '').trim(),
    cardType: String(data.cardType ?? '').trim().toLocaleUpperCase('en-US'),
    series: String(data.series ?? '').trim().toLocaleUpperCase('en-US'),
    language: String(data.language ?? '').trim().toLowerCase(),
    languageLabel: String(data.languageLabel ?? '').trim().toLocaleUpperCase('en-US'),
    name: String(data.name ?? '').trim().toLocaleUpperCase('en-US'),
    setName: String(data.setName ?? '').trim().toLocaleUpperCase('en-US'),
    cardNumber: normalizeCardNumber(data.cardNumber).toLocaleUpperCase('en-US'),
    condition: String(data.condition ?? '').trim().toLocaleUpperCase('en-US'),
    rarity: normalizeRarity(data.rarity),
    certNumber: String(data.certNumber ?? '').trim(),
  };
}

function measureTextMm(value) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return Infinity;
  context.font = `${FONT_SIZE_MM * 96 / 25.4}px Arial`;
  return context.measureText(value).width * 25.4 / 96;
}

function pairFitError(left, right, leftValue, rightValue) {
  if (!leftValue || !rightValue) return '';
  const available = 66.6 - 3.4 - measureTextMm(rightValue) - TEXT_GAP_MM;
  return measureTextMm(leftValue) <= available
    ? ''
    : `${left} is too long for the approved label width.`;
}

function shortenToFit(value, rightValue) {
  const words = [...value.matchAll(/\p{L}{2,}/gu)];
  let result = value;
  for (let index = words.length - 1; index >= 0; index -= 1) {
    if (!pairFitError('Text', 'value', result, rightValue)) break;
    const word = words[index];
    result = `${result.slice(0, word.index)}${Array.from(word[0])[0]}.${result.slice(word.index + word[0].length)}`;
  }
  return result;
}

export function rarityFitsLabel(setName, rarity) {
  return !pairFitError('Set name', 'rarity', String(setName || '').toLocaleUpperCase('en-US'), rarity);
}

const LANGUAGE_LABELS = {en: '', th: 'THAI', ja: 'JAPANESE'};
const SERIES_SHORT = {'SCARLET & VIOLET': 'SV', 'SWORD & SHIELD': 'SWSH', 'SUN & MOON': 'SM',
  'MEGA EVOLUTION': 'MEGA', 'BLACK & WHITE': 'BW', 'DIAMOND & PEARL': 'DP',
  'HEARTGOLD & SOULSILVER': 'HGSS', 'ADVANCED GENERATION': 'ADV'};

export function firstLine(value) {
  const language = value.language === 'en' ? '' : value.languageLabel || LANGUAGE_LABELS[value.language];
  if (language === undefined || !value.year || !value.cardType || !value.series) return '';
  const build = series => [value.year, value.cardType, language, series].filter(Boolean).join(' ');
  const full = build(value.series);
  if (!pairFitError('First line', 'card number', full, value.cardNumber)) return full;
  const shortenedSeries = SERIES_SHORT[value.series] ? build(SERIES_SHORT[value.series]) : full;
  return shortenToFit(shortenedSeries, value.cardNumber);
}

export function validateLabelData(data) {
  const value = cleanLabelData(data);
  const required = ['year', 'cardType', 'series', 'language', 'name', 'setName', 'cardNumber', 'condition', 'rarity', 'certNumber'];
  const missing = required.find(key => !value[key]);
  if (missing) return [`${missing.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`)} is required.`];
  if (!(value.language in LANGUAGE_LABELS)) return ['Card language must be English, Thai, or Japanese.'];
  if (value.language !== 'en' && value.languageLabel && value.languageLabel !== LANGUAGE_LABELS[value.language]) return ['Language label must match the card language.'];
  if ([value.name, value.setName].some(hasNonLatinScript)) return ['Card name and set must use English text.'];
  if (!/^\d{8}$/.test(value.certNumber)) return ['Cert number must contain exactly 8 digits.'];
  if (!CONDITION_OPTIONS.includes(value.condition)) return ['Choose a condition from the DCR list.'];

  return [
    pairFitError('First line', 'card number', firstLine(value), value.cardNumber),
    pairFitError('Card name', 'condition', shortenToFit(value.name, value.condition), value.condition),
    pairFitError('Set name', 'rarity', shortenToFit(value.setName, value.rarity), value.rarity)
  ].filter(Boolean);
}

function parseSvg(source) {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('A label SVG template could not be read.');
  return document;
}

function svgText(document, elementId, value) {
  const element = document.getElementById(elementId);
  if (!element || element.localName !== 'text') throw new Error(`Missing label text field: ${elementId}`);
  element.textContent = value;
}

function makeBarcodePattern(serial) {
  const result = {};
  JsBarcode(result, serial, {format: 'CODE128', width: 1, height: 1, displayValue: false, margin: 0});
  const pattern = (result.encodings || []).map(encoding => encoding.data).join('');
  if (!pattern || /[^01]/.test(pattern)) throw new Error('The Code 128 barcode could not be generated.');
  return pattern;
}

function elementBounds(elements) {
  const edges = elements.map(element => {
    const x = Number(element.getAttribute('x'));
    const y = Number(element.getAttribute('y'));
    const width = Number(element.getAttribute('width'));
    const height = Number(element.getAttribute('height'));
    return {x, y, right: x + width, bottom: y + height};
  });
  return {
    x: Math.min(...edges.map(edge => edge.x)), y: Math.min(...edges.map(edge => edge.y)),
    right: Math.max(...edges.map(edge => edge.right)), bottom: Math.max(...edges.map(edge => edge.bottom))
  };
}

function drawBarcode(group, pattern, bounds) {
  const width = bounds.right - bounds.x;
  const height = bounds.bottom - bounds.y;
  const moduleWidth = width / pattern.length;
  group.replaceChildren();
  group.setAttribute('aria-label', 'Code 128 certificate number');
  for (let index = 0; index < pattern.length;) {
    if (pattern[index] === '0') { index += 1; continue; }
    let end = index + 1;
    while (pattern[end] === '1') end += 1;
    const bar = group.ownerDocument.createElementNS(SVG_NS, 'rect');
    bar.setAttribute('x', (bounds.x + index * moduleWidth).toFixed(6));
    bar.setAttribute('y', bounds.y.toFixed(6));
    bar.setAttribute('width', ((end - index) * moduleWidth).toFixed(6));
    bar.setAttribute('height', height.toFixed(6));
    bar.setAttribute('fill', '#101010');
    group.appendChild(bar);
    index = end;
  }
}

function replaceFrontBarcode(document, pattern) {
  const group = document.getElementById('front-barcode-placeholder');
  const bounds = elementBounds([...group.querySelectorAll(':scope > rect')]);
  drawBarcode(group, pattern, bounds);
}

function replaceBackBarcode(document, pattern) {
  const bars = [...document.querySelectorAll('rect[fill="#101010"]')].filter(element =>
    Math.abs(Number(element.getAttribute('y')) - 16.725) < 0.001 && Number(element.getAttribute('x')) < 22.5
  );
  const bounds = elementBounds(bars);
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('id', 'back-barcode');
  document.getElementById('back-serial').before(group);
  bars.forEach(bar => bar.remove());
  drawBarcode(group, pattern, bounds);
}

function replaceQrCode(document, serial) {
  const group = document.getElementById('qr-visual-placeholder');
  const frame = group.previousElementSibling;
  const bounds = elementBounds([frame]);
  const url = publicCertificateUrl(serial);
  const qr = QRCode.create(url, {errorCorrectionLevel: 'M'});
  const moduleSize = (bounds.right - bounds.x) / (qr.modules.size + 8);
  const startX = bounds.x + 4 * moduleSize;
  const startY = bounds.y + 4 * moduleSize;
  group.replaceChildren();
  group.setAttribute('aria-label', `Certificate URL: ${url}`);
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let col = 0; col < qr.modules.size; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      const module = document.createElementNS(SVG_NS, 'rect');
      module.setAttribute('x', (startX + col * moduleSize).toFixed(6));
      module.setAttribute('y', (startY + row * moduleSize).toFixed(6));
      module.setAttribute('width', moduleSize.toFixed(6));
      module.setAttribute('height', moduleSize.toFixed(6));
      group.appendChild(module);
    }
  }
}

export async function renderLabelSvgPair(data) {
  const value = cleanLabelData(data);
  const [frontSource, backSource] = await Promise.all([frontMaster, backMaster]);
  const front = parseSvg(frontSource);
  svgText(front, 'front-year-series', firstLine(value));
  svgText(front, 'front-card-name', shortenToFit(value.name, value.condition));
  svgText(front, 'front-collection', shortenToFit(value.setName, value.rarity));
  svgText(front, 'front-card-number', value.cardNumber);
  svgText(front, 'front-condition', value.condition);
  svgText(front, 'front-rarity', value.rarity);
  svgText(front, 'front-serial', value.certNumber);
  replaceFrontBarcode(front, makeBarcodePattern(value.certNumber));

  const back = parseSvg(backSource);
  svgText(back, 'back-serial', value.certNumber);
  replaceBackBarcode(back, makeBarcodePattern(value.certNumber));
  replaceQrCode(back, value.certNumber);
  const serializer = new XMLSerializer();
  return {frontSvg: serializer.serializeToString(front.documentElement), backSvg: serializer.serializeToString(back.documentElement)};
}

function svgDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function appendLabelImage(document, slot, svg, side) {
  const image = document.createElementNS(SVG_NS, 'image');
  const data = svgDataUri(svg);
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', '70');
  image.setAttribute('height', '20');
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('data-sheet-side', side);
  image.setAttribute('href', data);
  image.setAttributeNS(XLINK_NS, 'xlink:href', data);
  slot.appendChild(image);
}

export async function renderSheetSvg(labels, side) {
  const document = parseSvg(await sheetMaster);
  const slots = [...document.querySelectorAll('[data-slot="true"]')];
  if (slots.length !== 40) throw new Error('The A4 master must contain exactly 40 label positions.');
  const slotByPosition = new Map(slots.map(slot => [`${slot.dataset.row}:${slot.dataset.col}`, slot]));
  labels.forEach((label, index) => {
    const row = Math.floor(index / 10) + 1;
    const frontCol = (index % 10) + 1;
    const col = side === 'back' ? 11 - frontCol : frontCol;
    const slot = slotByPosition.get(`${row}:${col}`);
    slot.setAttribute('transform', `translate(${Number(slot.dataset.xMm) + 20} ${slot.dataset.yMm}) rotate(90)`);
    appendLabelImage(document, slot, side === 'back' ? label.backSvg : label.frontSvg, side);
  });
  const title = document.querySelector('title');
  if (title) title.textContent = `DCR 70 × 20 mm A4 ${side} label sheet`;
  return new XMLSerializer().serializeToString(document.documentElement);
}

export function labelSvgDataUri(svg) {
  return svgDataUri(svg);
}
