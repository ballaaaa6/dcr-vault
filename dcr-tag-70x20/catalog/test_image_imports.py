import json
import unittest

from import_cardcorpus_images import matched_cards
from import_pokemon_tcg_images import candidates


class ImageImportMatchingTest(unittest.TestCase):
    def test_english_rejects_ambiguous_or_different_prints(self):
        record = {'local_id': 'SV001', 'card_name': 'Rowlet'}
        card = {'number': 'SV001', 'name': 'Rowlet', 'images': {'small': 'https://images.pokemontcg.io/set/card.png'}}
        self.assertEqual(len(list(candidates([record], [card]))), 1)
        self.assertEqual(list(candidates([record], [card, card])), [])
        self.assertEqual(list(candidates([record], [{**card, 'number': 'SV002'}])), [])
        self.assertEqual(list(candidates([record], [{**card, 'name': 'Dartrix'}])), [])

    def test_japanese_requires_species_artist_and_unique_number(self):
        record = {'local_id': '001', 'raw_json': json.dumps({'dexId': [495], 'illustrator': 'Susumu Maeya'})}
        card = {'number': {'numerator': '001'}, 'species': [{'species': 495}], 'credit': 'Susumu Maeya',
                'picture': {'front': {'image': 'a' * 32}}}
        self.assertEqual(len(list(matched_cards([record], [card]))), 1)
        self.assertEqual(list(matched_cards([record], [card, card])), [])
        self.assertEqual(list(matched_cards([record], [{**card, 'species': [{'species': 1}]}])), [])
        self.assertEqual(list(matched_cards([record], [{**card, 'credit': 'Someone else'}])), [])


if __name__ == '__main__':
    unittest.main()
