#!/usr/bin/env python3
"""Capture my published Webflow pages and presentation assets without redesigning them."""
import concurrent.futures
import base64
import hashlib
import html
from html.parser import HTMLParser
import json
import mimetypes
from pathlib import Path
import re
import shutil
import time
from urllib.error import HTTPError
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://the-contractors-course.webflow.io"
SITE_ID = "6527313b854f07008c2d65a2"
SOURCE_HOSTS = {urlsplit(ORIGIN).netloc, "www.thecontractorscourse.com", "thecontractorscourse.com"}
DEST = ROOT / "webflow"
CSS_URL = re.compile(r"url\(\s*['\"]?([^)'\"\s]+)['\"]?\s*\)")
IMPORT = re.compile(r"@import\s+['\"]([^'\"]+)['\"]")
ASSET_HOSTS = {
    "cdn.prod.website-files.com", "assets.website-files.com",
    "uploads-ssl.webflow.com", "uploads.webflow.com",
    "d3e54v103j8qbb.cloudfront.net",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def update_integrity(source, site):
    def replace_tag(match):
        tag = match.group()
        reference = re.search(r'(?:href|src)="(/assets/[^"]+)"', tag)
        integrity = re.search(r'(integrity=")([^"]+)', tag)
        if not reference or not integrity:
            return tag
        data = (site / reference.group(1).lstrip("/")).read_bytes()
        hashes = []
        for entry in integrity.group(2).split():
            algorithm = entry.split("-", 1)[0]
            if algorithm not in ("sha256", "sha384", "sha512"):
                raise RuntimeError("Unsupported integrity algorithm")
            hashes.append(algorithm + "-" + base64.b64encode(hashlib.new(algorithm, data).digest()).decode())
        return tag[:integrity.start(2)] + " ".join(hashes) + tag[integrity.end(2):]
    return re.sub(r'<(?:link|script)\b[^>]*>', replace_tag, source)


def absolute(value, base):
    value = html.unescape(value).strip()
    if not value or value.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
        return None
    parts = urlsplit(urljoin(base, value))
    if parts.scheme not in ("http", "https"):
        return None
    return urlunsplit(parts._replace(fragment=""))


def route_of(url):
    return urlsplit(url).path.rstrip("/") or "/"


def page_file(route):
    parts = Path(unquote(route).lstrip("/"))
    if ".." in parts.parts or parts.is_absolute():
        raise ValueError("Unsafe route")
    return "index.html" if route == "/" else str(parts) + ".html"


def fetch(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": "TheContractorsCourseMigration/1.0"}), timeout=40) as response:
                return response.read(), response.url, response.headers.get("Content-Type", ""), response.status
        except HTTPError as error:
            if error.code < 500 or attempt == 2:
                raise
        except OSError:
            if attempt == 2:
                raise
        time.sleep(attempt + 1)


class Page(HTMLParser):
    def __init__(self, source, base):
        super().__init__(convert_charrefs=True)
        self.base, self.links, self.assets, self.services = base, set(), set(), set()
        self.forms = []
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "a" and (url := absolute(attrs.get("href", ""), self.base)):
            if urlsplit(url).netloc in SOURCE_HOSTS:
                parts = urlsplit(url)
                self.links.add(ORIGIN + parts.path + ("?" + parts.query if parts.query else ""))
        if tag == "form":
            self.forms.append({key: value for key, value in attrs.items() if key in ("id", "action", "method", "data-wf-user-form-type", "data-node-type", "data-ms-form")})
        references = []
        for attr in ("src", "poster", "data-poster-url"):
            if attrs.get(attr):
                references.append((attrs[attr], tag))
        if tag == "link" and attrs.get("href") and any(word in attrs.get("rel", "") for word in ("stylesheet", "icon", "preload")):
            references.append((attrs["href"], "style" if "stylesheet" in attrs.get("rel", "") else tag))
        if attrs.get("srcset"):
            references.extend((item.strip().split()[0], "img") for item in attrs["srcset"].split(",") if item.strip())
        references.extend((value, "style") for value in CSS_URL.findall(attrs.get("style", "")))
        for reference, kind in references:
            url = absolute(reference, self.base)
            if not url:
                continue
            if kind == "script" and urlsplit(url).netloc not in ASSET_HOSTS:
                self.services.add(url)
            elif kind == "iframe":
                self.services.add(url)
            else:
                self.assets.add(url)


def main():
    if DEST.exists():
        raise SystemExit("webflow/ already exists. Keep the previous snapshot before recapturing.")
    stage = ROOT / "work" / "webflow-capture"
    if stage.exists():
        shutil.rmtree(stage)
    site = stage / "site"
    raw = stage / "raw-pages"
    site.mkdir(parents=True)
    raw.mkdir()
    pages, redirects, failures = {}, {}, []
    pending, seen = {ORIGIN + "/"}, set()
    assets, services = set(), set()
    while pending:
        batch = sorted(pending - seen)
        pending = set()
        if not batch:
            break
        if len(seen) + len(batch) > 150:
            raise RuntimeError("Unexpectedly large crawl. Inspect the discovered routes.")
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            futures = {pool.submit(fetch, url): url for url in batch}
            for future in concurrent.futures.as_completed(futures):
                url = futures[future]
                seen.add(url)
                try:
                    data, final, content_type, status = future.result()
                    if "text/html" not in content_type:
                        assets.add(url)
                        continue
                    route, final_route = route_of(url), route_of(final)
                    if route != final_route:
                        redirects[route] = final_route + ("?" + urlsplit(final).query if urlsplit(final).query else "")
                        pending.add(ORIGIN + final_route)
                        continue
                    source = data.decode("utf-8")
                    if f'data-wf-site="{SITE_ID}"' not in source:
                        raise RuntimeError("Unexpected Webflow site identity at " + url)
                    info = Page(source, url)
                    file = page_file(route)
                    (raw / file).parent.mkdir(parents=True, exist_ok=True)
                    (raw / file).write_bytes(data)
                    pages[route] = {"file": file, "url": url, "sha256": digest(data), "bytes": len(data), "forms": info.forms}
                    assets.update(info.assets)
                    services.update(info.services)
                    for link in info.links:
                        link_route = route_of(link)
                        if not re.search(r"\.(?:png|jpe?g|svg|webp|pdf|zip|css|js|mp4)$", link_route, re.I) and not re.search(r"/(?:log-out|logout|delete|remove)(?:/|$)", link_route):
                            pending.add(ORIGIN + link_route)
                    print("Page:", route, flush=True)
                except HTTPError as error:
                    failures.append({"url": url, "status": error.code})
    homepage = (raw / "index.html").read_text()
    if "Build your career as a Certified Contractor" not in homepage:
        raise RuntimeError("The original landing page was not captured")
    records, data_by_url = {}, {}
    pending = set(assets)
    while pending:
        batch = sorted(pending - records.keys())
        pending = set()
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(fetch, url): url for url in batch}
            for future in concurrent.futures.as_completed(futures):
                url = futures[future]
                data, final, content_type, status = future.result()
                if "text/html" in content_type:
                    raise RuntimeError("An asset returned HTML: " + url)
                extension = Path(unquote(urlsplit(url).path)).suffix.lower()
                if not re.fullmatch(r"\.[a-z0-9]{1,6}", extension):
                    extension = mimetypes.guess_extension(content_type.split(";")[0]) or ".bin"
                file = "assets/webflow/" + digest(url.encode())[:24] + extension
                records[url] = {"file": file, "sha256": digest(data), "bytes": len(data), "content_type": content_type}
                data_by_url[url] = data
                if extension == ".css" or "text/css" in content_type:
                    css = data.decode("utf-8")
                    pending.update(value for ref in CSS_URL.findall(css) + IMPORT.findall(css) if (value := absolute(ref, url)))
        print("Presentation assets:", len(records), flush=True)
    mapping = {url: "/" + record["file"] for url, record in records.items()}

    def rewrite(source, base):
        replacements = dict(mapping)
        for match in CSS_URL.findall(source) + IMPORT.findall(source):
            url = absolute(match, base)
            if url in mapping:
                replacements[match] = mapping[url]
        for before in sorted(replacements, key=len, reverse=True):
            source = source.replace(html.escape(before, quote=True), replacements[before]).replace(before, replacements[before])
        # Keep Webflow-hosted service scripts on their original host.
        for service in services:
            if service.startswith(ORIGIN + "/"):
                source = source.replace('src="' + service.removeprefix(ORIGIN) + '"', 'src="' + service + '"')
        return source

    for url, record in records.items():
        data = data_by_url[url]
        if record["file"].endswith(".css"):
            raw_css = stage / "raw-css" / Path(record["file"]).name
            raw_css.parent.mkdir(exist_ok=True)
            raw_css.write_bytes(data)
            data = rewrite(data.decode("utf-8"), url).encode()
        file = site / record["file"]
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
        record["served_sha256"] = digest(data)
    for route, record in pages.items():
        source = (raw / record["file"]).read_text()
        output = rewrite(source, record["url"])
        for source_url in (ORIGIN, "https://www.thecontractorscourse.com", "https://thecontractorscourse.com"):
            output = re.sub(r'((?:href|action)=["\"])' + re.escape(source_url) + r'(?=/|["\"])', r'\1', output)
        output = update_integrity(output, site)
        file = site / record["file"]
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(output)
        record["served_sha256"] = digest(output.encode())
    manifest = {"source": ORIGIN, "site_id": SITE_ID, "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "pages": pages, "redirects": redirects, "assets": records, "external_services": sorted(services), "source_failures": failures}
    (stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    shutil.move(stage, DEST)
    print(json.dumps({"pages": len(pages), "assets": len(records), "redirects": redirects, "source_failures": failures}, indent=2))


if __name__ == "__main__":
    main()
