# Data Model

Card object (English keys only):
- id: string, e.g. dcr-000001
- game: pokemon | yugioh | other
- name, setName, year, cardNumber (#4), rarity (R)
- gradeLabel: GEM MT 10 | GEM MT 9 | RAW
- certNumber: 8 digits, unique, e.g. 01234567
- frontImage, backImage: dataURL or Oracle URL
- status: in-vault | for-sale | sold | grading
- buyPrice, sellPrice: numbers, Vault detail ONLY, never on label
- buyDate, soldDate, boughtFrom, soldTo, notes
- createdAt, updatedAt

Label object:
- certNumber, name, setName, year, cardNumber, rarity, gradeLabel

Search result:
- candidate cards + confidence 0-100. If <85, go to Review queue.
