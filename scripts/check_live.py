#!/usr/bin/env python3
"""Verify public Pages assets really exist after deployment."""
import json
import os
import sys
import time
import urllib.request
from urllib.error import URLError, HTTPError

BASE=os.environ.get("PAGES_URL","https://smartleo123.github.io/KFC-Deal-Radar/").rstrip("/")+"/"
PATHS={"index.html":"text/html","app.js":"javascript","data/official.json":"json","data/singles.json":"json"}

def get(path):
    req=urllib.request.Request(BASE+path+"?health="+str(int(time.time())),headers={"Cache-Control":"no-cache","User-Agent":"KFC-Deal-Radar-healthcheck/1.0"})
    with urllib.request.urlopen(req,timeout=15) as response:
        body=response.read(3_000_000)
        if response.status!=200:raise RuntimeError(f"HTTP {response.status}")
        return body

def main():
    errors=[]
    for attempt in range(6):
        errors.clear()
        for path in PATHS:
            try:
                body=get(path)
                if path.endswith(".json"):
                    data=json.loads(body)
                    if path.endswith("official.json") and not (isinstance(data.get("coupon_list"),list) and len(data["coupon_list"])>0):
                        raise ValueError("No official coupons")
                elif path=="app.js" and b"loadOfficialSnapshot" not in body:
                    raise ValueError("Stale app.js")
                elif path=="index.html" and b'<div id="grid"' not in body:
                    raise ValueError("Missing coupon grid")
                print(f"OK {path}: {len(body)} bytes",flush=True)
            except (URLError,HTTPError,ValueError,RuntimeError) as exc:
                errors.append(f"{path}: {exc}")
        if not errors:return 0
        print(f"Retry {attempt+1}: {'; '.join(errors)}",flush=True)
        if attempt<5:time.sleep(10)
    return 1
if __name__=="__main__":sys.exit(main())
