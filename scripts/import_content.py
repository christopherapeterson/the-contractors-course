#!/usr/bin/env python3
"""Convert original Webflow CSV exports to validated, reproducible JSON."""

import argparse
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
EXPECTED = {"law-and-business": 8, "general-b": 6, "flash-cards": 81, "products": 1}


def read_rows(name):
    source = CONTENT / "source" / f"{name}.csv"
    with source.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if len(rows) != EXPECTED[name]:
        raise ValueError(f"{name}: expected {EXPECTED[name]} rows, received {len(rows)}")
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError(f"{name}: malformed CSV row")
    return source, rows


def required(row, field):
    value = row[field].strip()
    if not value:
        raise ValueError(f"Missing required field: {field}")
    return value


def normalize(name, rows):
    if name == "products":
        return [{
            "id": required(row, "Product ID"),
            "slug": required(row, "Product Handle"),
            "name": required(row, "Product Name"),
            "type": row["Product Type"],
            "price": row["Variant Price"],
            "compareAtPrice": row["Variant Compare-at Price"],
            "descriptionHtml": row["Product Description"],
            "source": row,
        } for row in rows]
    items = []
    for row in rows:
        item = {
            "id": required(row, "Item ID"),
            "slug": required(row, "Slug"),
            "name": required(row, "Name"),
            "archived": row["Archived"].strip().lower() == "true",
            "draft": row["Draft"].strip().lower() == "true",
            "createdAt": row["Created On"],
            "updatedAt": row["Updated On"],
            "publishedAt": row["Published On"],
        }
        if name == "flash-cards":
            item.update(question=required(row, "Question"), answer=required(row, "Answer"), type=required(row, "Type"))
        else:
            item.update(chapterHtml=row["Chapter"], practiceTestUrl=row.get("Practice test", row.get("Test link", "")))
            if not item["chapterHtml"].strip() and not item["practiceTestUrl"].strip():
                raise ValueError(f"{name}/{item['slug']}: missing chapter and practice test")
        items.append(item)
    return items


def generate(check=False):
    manifest = {"source": "Webflow official CSV exports", "collections": []}
    for name in EXPECTED:
        source, rows = read_rows(name)
        items = normalize(name, rows)
        for field in ("id", "slug"):
            values = [item[field] for item in items]
            if len(values) != len(set(values)):
                raise ValueError(f"{name}: duplicate {field}")
        value = {"collection": name, "items": items}
        serialized = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        destination = CONTENT / f"{name}.json"
        if check:
            if not destination.exists() or destination.read_text() != serialized:
                raise ValueError(f"{destination.relative_to(ROOT)} is stale; regenerate it")
        else:
            destination.write_text(serialized, encoding="utf-8")
        manifest["collections"].append({
            "name": name,
            "count": len(items),
            "sourceFile": str(source.relative_to(ROOT)),
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "jsonFile": str(destination.relative_to(ROOT)),
        })
        print(f"{'Verified' if check else 'Imported'} {name}: {len(items)} items")
    serialized = json.dumps(manifest, indent=2) + "\n"
    destination = CONTENT / "manifest.json"
    if check:
        if destination.read_text() != serialized:
            raise ValueError("Content manifest is stale")
    else:
        destination.write_text(serialized, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate without modifying files")
    generate(check=parser.parse_args().check)
