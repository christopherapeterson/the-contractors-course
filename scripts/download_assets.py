#!/usr/bin/env python3
"""Preserve media referenced by the original course HTML."""

import csv
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
ALLOWED_HOSTS = {
    "uploads-ssl.webflow.com", "uploads.webflow.com", "cdn.prod.website-files.com",
    "assets.website-files.com", "contractorsischool.s3-us-west-1.amazonaws.com",
}
MEDIA_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp3", ".mp4", ".pdf", ".wav", ".ogg", ".m4a"}


def main():
    urls = set()
    for source in (CONTENT / "source").glob("*.csv"):
        with source.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                for value in row.values():
                    for match in re.findall(r'https?://[^\s<>"\']+', value or ""):
                        url = html.unescape(match)
                        parsed = urllib.parse.urlsplit(url)
                        if parsed.hostname in ALLOWED_HOSTS and Path(parsed.path).suffix.lower() in MEDIA_EXTENSIONS:
                            urls.add(url)
    directory = CONTENT / "assets"
    directory.mkdir(exist_ok=True)
    results = []
    for url in sorted(urls):
        extension = Path(urllib.parse.urlsplit(url).path).suffix.lower()
        filename = hashlib.sha256(url.encode()).hexdigest()[:20] + extension
        destination = directory / filename
        entry = {"sourceUrl": url, "localPath": str(destination.relative_to(ROOT))}
        try:
            if not destination.exists():
                request = urllib.request.Request(url, headers={"User-Agent": "CourseMigration/1.0"})
                with urllib.request.urlopen(request, timeout=30) as response:
                    if urllib.parse.urlsplit(response.url).hostname not in ALLOWED_HOSTS:
                        raise ValueError("Redirected to an unexpected host")
                    data = response.read(50 * 1024 * 1024 + 1)
                    if len(data) > 50 * 1024 * 1024:
                        raise ValueError("Asset exceeds the 50 MB download limit")
                    destination.write_bytes(data)
            data = destination.read_bytes()
            entry.update(status="downloaded", bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        except Exception as error:
            entry.update(status="failed", error=str(error))
        results.append(entry)
    (CONTENT / "assets-manifest.json").write_text(json.dumps({"assets": results}, indent=2) + "\n")
    print(json.dumps({"discovered": len(results), "downloaded": sum(x["status"] == "downloaded" for x in results), "failed": sum(x["status"] == "failed" for x in results)}))


if __name__ == "__main__":
    main()
