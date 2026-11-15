#!/usr/bin/env python3
"""Download public upstream coupon scripts for a GitHub Pages fallback snapshot.

Data is fetched at deployment time, never embedded in the source code.
If upstream is unavailable, reuse the last successfully published snapshot.
Only fail deployment when neither source can provide valid data.
"""
import pathlib
import sys
import time
import urllib.request

SOURCE = "https://winedays.github.io/KCouper"
FILES = {"coupon.js": b"COUPON_DICT", "single.js": b"SINGLE_DICT"}

PUBLISHED = "https://smartleo123.github.io/KFC-Deal-Radar"

def download(url, name, marker, tries):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "KFC-Deal-Radar/1.0 (+https://github.com/smartleo123/KFC-Deal-Radar)",
                    "Cache-Control": "no-cache",
                },
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                data = response.read(8_000_001)
            if not 100 <= len(data) <= 8_000_000 or marker not in data:
                raise ValueError(f"unexpected {name} response; size={len(data)}")
            return data
        except (OSError, ValueError) as exc:
            if attempt + 1 >= tries:
                raise RuntimeError(f"Cannot download {name} from {url}") from exc
            time.sleep(2 ** attempt)

def fetch(name, marker):
    try:
        return download(f"{SOURCE}/{name}", name, marker, 3)
    except RuntimeError as exc:
        print(f"Upstream unavailable for {name}: {exc}; trying last published snapshot", flush=True)
        return download(f"{PUBLISHED}/{name}", name, marker, 1)

def main():
    dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    dest.mkdir(parents=True, exist_ok=True)
    for name, marker in FILES.items():
        data = fetch(name, marker)
        (dest / name).write_bytes(data)
        print(f"Downloaded {name}: {len(data)} bytes")

if __name__ == "__main__":
    main()
