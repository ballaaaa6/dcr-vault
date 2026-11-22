import {jsPDF} from 'jspdf';

async function sheetImage(svg, api) {
  const image = new Image();
  image.src = api.labelSvgDataUri(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 2480;
  canvas.height = 3508;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export async function downloadLabelPdf(labels, api) {
  const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4', compress: true});
  let page = 0;
  for (let index = 0; index < labels.length; index += 40) {
    const sheet = labels.slice(index, index + 40);
    for (const side of ['front', 'back']) {
      const svg = await api.renderSheetSvg(sheet, side);
      const image = await sheetImage(svg, api);
      if (page++) pdf.addPage();
      pdf.addImage(image, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    }
  }
  pdf.save('dcr-label-sheets.pdf');
}
