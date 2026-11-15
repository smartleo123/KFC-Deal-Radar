import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "collector", Path(__file__).resolve().parents[1] / "scripts" / "collect_official.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CollectorRotationTests(unittest.TestCase):
    def test_window_follows_observed_new_series(self):
        with patch.object(module, "discovery_codes", return_value=[50510, 50511, 50512]), patch.object(module, "MAX_CHECKS", 35):
            codes, meta = module.seed_codes({"50510": {}, "50511": {}, "_scan_cursor": 24021})
        self.assertTrue(all(code > 48000 for code in codes))
        self.assertGreater(meta["window_end"], 50512)
        self.assertEqual(len(codes), len(set(codes)))
        self.assertLessEqual(len(codes), 35)

    def test_discovered_codes_rotate_between_runs(self):
        candidates = list(range(50000, 50120))
        with patch.object(module, "discovery_codes", return_value=candidates), patch.object(module, "MAX_CHECKS", 20):
            first, meta = module.seed_codes({"_scan_cursor": None})
            second, _ = module.seed_codes({
                "_scan_cursor": meta["cursor"],
                "_discovery_offset": meta["discovery_offset"],
                "_known_offset": meta["known_offset"],
            })
        self.assertNotEqual(first, second)
        self.assertIn(50000, first)
        self.assertIn(50010, second)

    def test_scan_advances_without_discovery_source(self):
        with patch.object(module, "discovery_codes", return_value=[]), patch.object(module, "MAX_CHECKS", 10):
            first, meta = module.seed_codes({"_scan_cursor": None})
            second, _ = module.seed_codes({"_scan_cursor": meta["cursor"]})
        self.assertEqual(len(first), 10)
        self.assertTrue(set(first).isdisjoint(second))


if __name__ == "__main__":
    unittest.main()
