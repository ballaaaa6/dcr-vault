# Label Spec 70x20mm

- Physical size: 70mm x 20mm
- Front: Use the approved SVG master. Print the recorded card year, card type, language on the first line, followed by card name, collection, card number, condition, rarity code, Code 128 serial, and the DCR logo in the master positions. Keep all front text at the approved size; block values that overlap instead of shrinking them.
- Back: Use the approved SVG master with its blue field, silver DCR marks, center shield, generated QR, lower Code 128 barcode, and matching serial. Keep the QR frame and quiet zone unchanged.
- Sheet: A4 portrait 210x297mm, 10 columns x 4 rows of 20 x 70mm slots. Rotate each 70 x 20mm label 90 degrees clockwise. Use 5mm left/right and 8.5mm top/bottom margins, external cut registration ticks, and long-edge duplex with the back columns mirrored.
- Codes: Browser previews and print sheets use a DCR-TEST QR payload and the same eight-digit serial in both Code 128 barcodes. These mockup codes do not verify a registry record.
- Print: Use @media print in print-label.css, hide app UI when printing, and print at Actual Size with long-edge duplex. Choose Save as PDF in the browser print dialog for a PDF copy.
