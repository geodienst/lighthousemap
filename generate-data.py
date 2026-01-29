#!/usr/bin/env python3
"""
Fetch lighthouse/beacon data and produce data-reduced.json.

Primary mode:  query Postpass (public OSM PostGIS API) for all elements
               with light sequence or character tags.
Fallback mode: --local  processes an existing data-full.json instead.

Keeps only seamark:* tags and "name". Outputs one JSON element per line
for diff-friendly git history. Elements are sorted by OSM id.
"""

import argparse
import json
import os
import urllib.request
import urllib.parse

KEEP_PREFIXES = ("seamark:",)
KEEP_EXACT = {"name"}

OUTPUT = "data-reduced.json"

POSTPASS_URL = "https://postpass.geofabrik.de/api/0.2/interpreter"
POSTPASS_QUERY = """\
SELECT
  pp.osm_type,
  pp.osm_id,
  pp.tags,
  ST_Centroid(pp.geom) AS geom
FROM postpass_pointlinepolygon pp
WHERE
  pp.tags ? 'seamark:light:sequence'
  OR pp.tags ? 'seamark:light:1:sequence'
  OR pp.tags ? 'seamark:light:character'
  OR pp.tags ? 'seamark:light:1:character'
"""


def should_keep_tag(key):
    if key in KEEP_EXACT:
        return True
    for prefix in KEEP_PREFIXES:
        if key.startswith(prefix):
            return True
    return False


def strip_tags(tags):
    if not tags:
        return None
    out = {}
    for k, v in tags.items():
        if should_keep_tag(k):
            out[k] = v
    return out if out else None


# --- Postpass fetch ---

def fetch_postpass():
    """Query Postpass and return a list of {type, id, lat, lon, tags} dicts."""
    print("Querying Postpass API ...")
    body = urllib.parse.urlencode({"data": POSTPASS_QUERY}).encode("utf-8")
    req = urllib.request.Request(POSTPASS_URL, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    features = data.get("features", [])
    print(f"  {len(features)} features returned")

    elements = []
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        if len(coords) < 2:
            continue
        tags = props.get("tags")
        if isinstance(tags, str):
            tags = json.loads(tags)
        tags = strip_tags(tags)
        if tags is None:
            continue
        elements.append({
            "type": "node",
            "id": props["osm_id"],
            "lat": coords[1],
            "lon": coords[0],
            "tags": tags,
        })

    return elements


# --- Local file processing (legacy fallback) ---

def process_local(src):
    """Process a local data-full.json (Overpass format) and return elements."""
    print(f"Reading {src} ...")
    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw = data["elements"]
    print(f"  {len(raw)} elements in source")

    # Build node coordinate lookup for way centroid computation
    node_coords = {}
    for el in raw:
        if el["type"] == "node" and "lat" in el and "lon" in el:
            node_coords[el["id"]] = (el["lon"], el["lat"])

    elements = []
    dropped_bare_nodes = 0
    ways_with_centroid = 0

    for el in raw:
        typ = el["type"]

        if typ == "node":
            tags = strip_tags(el.get("tags"))
            if tags is None:
                dropped_bare_nodes += 1
                continue
            elements.append({
                "type": "node",
                "id": el["id"],
                "lat": el["lat"],
                "lon": el["lon"],
                "tags": tags,
            })

        elif typ == "way":
            tags = strip_tags(el.get("tags"))
            if tags is None:
                continue
            node_ids = el.get("nodes", [])
            sum_lng = 0.0
            sum_lat = 0.0
            count = 0
            for nid in node_ids:
                coord = node_coords.get(nid)
                if coord:
                    sum_lng += coord[0]
                    sum_lat += coord[1]
                    count += 1
            if count == 0:
                continue
            elements.append({
                "type": "node",
                "id": el["id"],
                "lat": sum_lat / count,
                "lon": sum_lng / count,
                "tags": tags,
            })
            ways_with_centroid += 1

    print(f"  {dropped_bare_nodes} bare nodes dropped")
    print(f"  {ways_with_centroid} ways converted to centroid nodes")
    return elements


# --- Output ---

def write_output(elements, dst):
    # Sort by id for deterministic, diff-friendly output
    elements.sort(key=lambda el: el["id"])

    print(f"Writing {dst} ...")
    print(f"  {len(elements)} elements")
    compact = (",", ":")
    with open(dst, "w", encoding="utf-8") as f:
        f.write('{"elements":[\n')
        for i, el in enumerate(elements):
            line = json.dumps(el, separators=compact, ensure_ascii=False)
            if i < len(elements) - 1:
                line += ","
            f.write(line + "\n")
        f.write("]}\n")

    dst_size = os.path.getsize(dst)
    print(f"  {dst_size:,} bytes")


def main():
    parser = argparse.ArgumentParser(description="Fetch and reduce lighthouse data")
    parser.add_argument("--local", metavar="FILE",
                        help="Process a local Overpass JSON file instead of querying Postpass")
    args = parser.parse_args()

    script_dir = os.path.dirname(__file__) or "."
    dst = os.path.join(script_dir, OUTPUT)

    if args.local:
        src = args.local if os.path.isabs(args.local) else os.path.join(script_dir, args.local)
        elements = process_local(src)
    else:
        elements = fetch_postpass()

    write_output(elements, dst)


if __name__ == "__main__":
    main()
