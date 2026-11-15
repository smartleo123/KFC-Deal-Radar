#!/usr/bin/env python3
"""Stamp static assets with the deployment version to avoid stale browser JS/CSS."""
from pathlib import Path
import re
import sys

def stamp(path, version):
    file=Path(path)
    text=file.read_text(encoding="utf-8")
    if not re.fullmatch(r"[A-Za-z0-9._-]{6,80}",version):
        raise ValueError("Invalid deployment version")
    for asset in ("style.css","app.js"):
        text,count=re.subn(r'((?:href|src)="\./'+re.escape(asset)+r')(?:\?v=[^"]*)?(")',lambda match: match.group(1)+"?v="+version+match.group(2),text)
        if count!=1:
            raise ValueError(f"Expected one {asset} reference, got {count}")
    file.write_text(text,encoding="utf-8")
    print(f"Versioned static assets: {version}")

if __name__=="__main__":
    stamp(sys.argv[1],sys.argv[2])
