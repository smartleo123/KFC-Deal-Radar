#!/usr/bin/env python3
"""Download public upstream coupon scripts for a GitHub Pages fallback snapshot.

Data is fetched at deployment time, never embedded in the source code.
If the upstream is unavailable, deployment fails and the previous published
snapshot remains live.
"""
import pathlib
import sys
import time
import urllib.request

SOURCE = "https://winedays.github.io/KCouper"
FILES = {"coupon.js": b"COUPON_DICT", "single.js": b"SINGLE_DICT"}

def fetch(name, marker):
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                f"{SOURCE}/{name}",
                headers={"User-Agent": "KFC-Deal-Radar/1.0 (+https://github.com/smartleo123/KFC-Deal-Radar)", "Cache-Control": "no-cache"},
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                data = response.read(8_000_001)
            if not 100 <= len(data) <= 8_000_000 or marker not in data:
                raise ValueError(f"unexpected {name} response; size={len(data)}")
            return data
        except (OSError, ValueError) as exc:
            if attempt == 2:
                raise RuntimeError(f"Cannot download {name} after three tries") from exc
            time.sleep(2 ** attempt)

def main():
    dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    dest.mkdir(parents=True, exist_ok=True)
    for name, marker in FILES.items():
        data = fetch(name, marker)
        (dest / name).write_bytes(data)
        print(f"Downloaded {name}: {len(data)} bytes")

if __name__ == "__main__":
    main()
