#!/usr/bin/env python3
"""Preview the generated site with Vercel-style clean URLs."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1] / "dist"
REDIRECTS = json.loads((ROOT.parent / "vercel.json").read_text()).get("redirects", [])


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        route = urlsplit(self.path).path
        for rule in REDIRECTS:
            if rule["source"] == route:
                self.send_response(307)
                self.send_header("Location", rule["destination"])
                self.end_headers()
                return
        super().do_GET()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, url):
        destination = Path(super().translate_path(url))
        if not destination.exists() and destination.with_suffix(".html").is_file():
            return str(destination.with_suffix(".html"))
        return str(destination)


if __name__ == "__main__":
    print("Course preview: http://127.0.0.1:4173", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 4173), Handler).serve_forever()
