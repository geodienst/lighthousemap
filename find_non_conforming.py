"""
Identify OSM lighthouse elements whose seamark:light:character value
does not match any valid value from the OSM wiki spec.

Outputs a GeoJSON FeatureCollection to non-conforming-characters.geojson.
"""

import json
from collections import Counter

# Valid character values per https://wiki.openstreetmap.org/wiki/Key:seamark:light:character
VALID_CHARACTERS = {
    "F", "Fl", "LFl", "Q", "VQ", "UQ", "Iso", "Oc",
    "IQ", "IVQ", "IUQ", "Mo",
    "Al", "FFl", "FlLFl", "OcFl", "FLFl",
    "Al.Oc", "Al.LFl", "Al.Fl", "Al.Gr", "Al.FFl",
    "Q+LFl", "VQ+LFl", "UQ+LFl",
}

def get_character(tags):
    """Return the character value from tags, checking seamark:light:character
    first, then seamark:light:1:character as fallback."""
    if not tags:
        return None
    val = tags.get("seamark:light:character")
    if val:
        return val
    val = tags.get("seamark:light:1:character")
    return val

def get_light_tag(tags, key):
    """Get a seamark:light tag, trying unnumbered then :1: namespace."""
    if not tags:
        return None
    val = tags.get(f"seamark:light:{key}")
    if val:
        return val
    return tags.get(f"seamark:light:1:{key}")

def get_coords(element, node_lookup):
    """Get (lon, lat) for an element. Returns None if not available."""
    if "lat" in element and "lon" in element:
        return (element["lon"], element["lat"])
    # For ways, try to compute centroid from node references
    if element["type"] == "way" and "nodes" in element:
        coords = []
        for nid in element["nodes"]:
            if nid in node_lookup:
                n = node_lookup[nid]
                coords.append((n["lon"], n["lat"]))
        if coords:
            avg_lon = sum(c[0] for c in coords) / len(coords)
            avg_lat = sum(c[1] for c in coords) / len(coords)
            return (avg_lon, avg_lat)
    return None

def main():
    with open(r"c:\Repos\lighthousemap\data-full.json", encoding="utf-8") as f:
        data = json.load(f)

    elements = data["elements"]

    # Build node lookup for way centroid computation
    node_lookup = {}
    for e in elements:
        if e["type"] == "node" and "lat" in e and "lon" in e:
            node_lookup[e["id"]] = e

    features = []
    char_counter = Counter()

    for e in elements:
        tags = e.get("tags", {})
        character = get_character(tags)
        if character is None:
            continue  # No character tag at all

        if character in VALID_CHARACTERS:
            continue  # Conforming

        coords = get_coords(e, node_lookup)
        if coords is None:
            continue  # Can't place on map

        char_counter[character] += 1

        name = tags.get("name") or tags.get("seamark:name") or tags.get("seamark:light:name")
        sequence = get_light_tag(tags, "sequence")
        period = get_light_tag(tags, "period")
        group = get_light_tag(tags, "group")

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": list(coords),  # [lon, lat]
            },
            "properties": {
                "id": e["id"],
                "character": character,
                "name": name,
                "sequence": sequence,
                "period": period,
                "group": group,
            },
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    out_path = r"c:\Repos\lighthousemap\non-conforming-characters.geojson"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)

    print(f"Total non-conforming features: {len(features)}")
    print(f"Output written to: {out_path}")
    print()
    print("Non-conforming character values (sorted by count):")
    for char, count in char_counter.most_common():
        print(f"  {char!r:30s} {count:5d}")

if __name__ == "__main__":
    main()
