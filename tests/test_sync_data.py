"""Checks deployment snapshot fallback without making network requests."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("sync_data", Path(__file__).resolve().parents[1] / "scripts" / "sync_data.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SnapshotFallbackTests(unittest.TestCase):
    def test_uses_latest_upstream_when_available(self):
        with patch.object(module, "download", return_value=b"window.COUPON_DICT={};") as fetch:
            data = module.fetch("coupon.js", b"COUPON_DICT")
        self.assertIn(b"COUPON_DICT", data)
        self.assertEqual(fetch.call_count, 1)
        self.assertIn("winedays.github.io", fetch.call_args.args[0])

    def test_reuses_published_copy_after_upstream_failure(self):
        with patch.object(module, "download", side_effect=[RuntimeError("upstream offline"), b"window.COUPON_DICT={};"]) as fetch:
            data = module.fetch("coupon.js", b"COUPON_DICT")
        self.assertIn(b"COUPON_DICT", data)
        self.assertEqual(fetch.call_count, 2)
        self.assertIn("smartleo123.github.io", fetch.call_args.args[0])

    def test_fails_safely_if_both_sources_fail(self):
        with patch.object(module, "download", side_effect=RuntimeError("offline")):
            with self.assertRaises(RuntimeError):
                module.fetch("coupon.js", b"COUPON_DICT")

if __name__ == "__main__":
    unittest.main()
