#!/usr/bin/env python3
"""Verify my migrated pages preserve the original Webflow structure and design."""
from html.parser import HTMLParser
import html
import base64
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "webflow/manifest.json").read_text())
DIST = ROOT / "dist"
mapping = {"/" + record["file"]: url for url, record in MANIFEST["assets"].items()}


class Structure(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.structure, self.text, self.references = [], [], []
        self.in_script = False
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        self.in_script = tag == "script" or self.in_script
        preserved = []
        for name, value in attributes:
            if name == "integrity":
                continue
            if name in ("href", "action", "src", "srcset", "poster", "data-poster-url"):
                if value:
                    self.references.append((tag, name, value))
            else:
                # Asset URLs may change inside inline styles; every other style stays identical.
                if name == "style" and value:
                    for local, original in mapping.items():
                        value = value.replace(local, original)
                preserved.append((name, value))
        self.structure.append((tag, preserved))

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_script = False

    def handle_data(self, data):
        if not self.in_script:
            self.text.append(data)


for route, record in MANIFEST["pages"].items():
    original = Structure((ROOT / "webflow/raw-pages" / record["file"]).read_text())
    hosted_source = (DIST / record["file"]).read_text()
    hosted = Structure(hosted_source)
    for tag in re.findall(r'<(?:link|script)\b[^>]*>', hosted_source):
        reference = re.search(r'(?:href|src)="(/assets/[^"]+)"', tag)
        integrity = re.search(r'integrity="([^"]+)"', tag)
        if reference and integrity:
            data = (DIST / reference.group(1).lstrip("/")).read_bytes()
            for entry in integrity.group(1).split():
                algorithm, expected = entry.split("-", 1)
                actual = base64.b64encode(hashlib.new(algorithm, data).digest()).decode()
                assert actual == expected, "Asset integrity mismatch: " + reference.group(1)
    assert hosted.structure == original.structure, "Original markup, classes, styles or interaction IDs changed: " + route
    assert hosted.text == original.text, "Original text changed: " + route
    for tag, attribute, value in hosted.references:
        refs = [item.strip().split()[0] for item in value.split(",")] if attribute == "srcset" else [value]
        for ref in refs:
            parts = urlsplit(html.unescape(ref))
            if parts.scheme or parts.netloc or not parts.path or parts.path.startswith("#"):
                continue
            route_path = unquote(parts.path)
            file = DIST / route_path.lstrip("/")
            exists = file.is_file() or file.with_suffix(".html").is_file() or route_path in MANIFEST["redirects"] or route_path == "/"
            assert exists, f"Missing local reference {ref} in {route}"
    assert not re.search(r"(?:sk_live_|sk_test_|-----BEGIN (?:RSA )?PRIVATE KEY-----)", hosted_source), "Unexpected private credential"
for file in DIST.rglob("*.css"):
    for ref in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", file.read_text()):
        if ref.startswith("/assets/"):
            assert (DIST / ref.lstrip("/")).is_file(), "Missing CSS dependency: " + ref
for record in MANIFEST["assets"].values():
    if record["file"].endswith(".css"):
        hosted = (DIST / record["file"]).read_text()
        for local, original in mapping.items():
            hosted = hosted.replace(local, original)
        source = (ROOT / "webflow/raw-css" / Path(record["file"]).name).read_text()
        assert hosted == source, "Original CSS changed beyond asset URLs: " + record["file"]
config = json.loads((ROOT / "vercel.json").read_text())
redirects = {rule["source"]: rule["destination"] for rule in config.get("redirects", [])}
assert redirects == MANIFEST["redirects"], "Vercel must preserve observed source redirects"
assert "/log-in" not in redirects and "/sign-up" not in redirects, "Original account pages must not redirect to the dashboard"
print(f"Verified {len(MANIFEST['pages'])} pages preserve original text, markup, classes, styles and interaction IDs; all local assets and source redirects resolve.")
