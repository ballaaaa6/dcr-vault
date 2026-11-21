import importlib.util
import unittest
from pathlib import Path

path = Path(__file__).with_name("validate-metadata-evidence.py")
spec = importlib.util.spec_from_file_location("metadata_validation", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EvidenceValidationTest(unittest.TestCase):
    def test_accepts_known_and_unknown_fields(self):
        data = {"schemaVersion": 1, "reviewedAt": "2026-11-22", "records": [{"id": "a",
            "source": "https://example.org/a", "fields": {"name": {"value": "Mew", "status": "verified"},
            "hp": {"value": "", "status": "unknown"}}}]}
        self.assertEqual(module.validate(data), [])

    def test_rejects_invalid_field_source(self):
        data = {"schemaVersion": 1, "reviewedAt": "2026-11-22", "records": [{"id": "a",
            "source": "https://example.org/a", "fields": {"hp": {"value": "70",
            "status": "source-only", "source": "http://example.org/b"}}}]}
        self.assertTrue(any("field source" in error for error in module.validate(data)))

    def test_rejects_duplicate_identity_invalid_source_and_missing_value(self):
        record = {"id": "a", "source": "http://example.org", "fields": {"name": {"value": "", "status": "verified"}}}
        errors = module.validate({"schemaVersion": 1, "reviewedAt": "2026-11-22", "records": [record, record]})
        self.assertTrue(any("duplicate" in error for error in errors))
        self.assertTrue(any("source" in error for error in errors))
        self.assertTrue(any("empty" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
