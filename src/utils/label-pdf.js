import {jsPDF} from 'jspdf';
import 'svg2pdf.js';

function inlineSheetImages(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  for (const [index, image] of [...document.querySelectorAll('image[data-sheet-side]')].entries()) {
    const source = decodeURIComponent(image.getAttribute('href').split(',').slice(1).join(','));
    const label = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    for (const group of label.querySelectorAll('[filter="url(#silver-mark)"]')) {
      group.removeAttribute('filter');
      for (const node of group.querySelectorAll('[fill]')) {
        if (node.getAttribute('fill') !== 'none') node.setAttribute('fill', '#d4d4d4');
      }
    }
    const ids = new Map([...label.querySelectorAll('[id]')].map(node => [node.id, `label-${index}-${node.id}`]));
    for (const node of label.querySelectorAll('*')) {
      for (const attribute of [...node.attributes]) {
        let value = attribute.value.replace(/url\(\s*#([^\s)]+)\s*\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
        if (attribute.localName === 'id' && ids.has(value)) value = ids.get(value);
        if (attribute.localName === 'href' && value.startsWith('#') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
        if (value !== attribute.value) node.setAttributeNS(attribute.namespaceURI, attribute.name, value);
      }
    }
    label.setAttribute('x', '0');
    label.setAttribute('y', '0');
    label.setAttribute('width', '70');
    label.setAttribute('height', '20');
    image.replaceWith(document.importNode(label, true));
  }
  return document.documentElement;
}

async function rasterSheet(svg) {
  const source = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([source], {type: 'image/svg+xml;charset=utf-8'}));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Label sheet could not be rendered.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 2480; canvas.height = 3508;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Label sheet could not be rendered.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

export async function createLabelPdf(labels, api) {
  const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4', compress: true});
  let page = 0;
  for (let index = 0; index < labels.length; index += 40) {
    const sheet = labels.slice(index, index + 40);
    for (const side of ['front', 'back']) {
      const svg = inlineSheetImages(await api.renderSheetSvg(sheet, side));
      if (page++) pdf.addPage();
      if (/[^\u0000-\u024f]/u.test(svg.textContent || '')) pdf.addImage(await rasterSheet(svg), 'PNG', 0, 0, 210, 297);
      else await pdf.svg(svg, {x: 0, y: 0, width: 210, height: 297});
    }
  }
  return pdf;
}

export async function downloadLabelPdf(labels, api) {
  const pdf = await createLabelPdf(labels, api);
  pdf.save('dcr-label-sheets.pdf');
}
