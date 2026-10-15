"""Build the local catalog from a Geofabrik PBF and the OSM city boundary.

Requires pyosmium. Run from the project root with the PBF and boundary paths.
Only the resulting compact assets/parana-streets.json is distributed.
"""
import datetime
import json
import pathlib
import sys

import osmium

pbf = pathlib.Path(sys.argv[1])
boundary = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
polygons = [boundary["coordinates"]] if boundary["type"] == "Polygon" else boundary["coordinates"]
xs = [p[0] for polygon in polygons for p in polygon[0]]
ys = [p[1] for polygon in polygons for p in polygon[0]]
box = min(xs), min(ys), max(xs), max(ys)


def in_ring(x, y, ring):
    inside = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


class Extract(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.nodes = {}
        self.streets = []
        self.names = {}
        self.crossings = {}

    def node(self, node):
        x, y = node.location.lon, node.location.lat
        if box[0] <= x <= box[2] and box[1] <= y <= box[3]:
            self.nodes[node.id] = (x, y)

    def way(self, way):
        name = way.tags.get("name")
        if not name or not way.tags.get("highway"):
            return
        nodes = [node.ref for node in way.nodes if node.ref in self.nodes]
        if not nodes:
            return
        if name not in self.names:
            self.names[name] = len(self.streets)
            self.streets.append({"name": name, "aliases": []})
        index = self.names[name]
        aliases = self.streets[index]["aliases"]
        for key in ["alt_name", "short_name", "official_name", "name:es"]:
            for alias in (way.tags.get(key) or "").split(";"):
                alias = alias.strip()
                if alias and alias != name and alias not in aliases:
                    aliases.append(alias)
        for node in nodes:
            self.crossings.setdefault(node, set()).add(index)


extract = Extract()
print("Extracting named streets and shared nodes inside Parana...", flush=True)
extract.apply_file(str(pbf))
corners = []
for node, streets in extract.crossings.items():
    if len(streets) < 2:
        continue
    x, y = extract.nodes[node]
    if any(in_ring(x, y, polygon[0]) and not any(in_ring(x, y, hole) for hole in polygon[1:]) for polygon in polygons):
        corners.append({"id": node, "lon": x, "lat": y, "streets": sorted(streets)})
if len(extract.streets) < 100 or len(corners) < 100:
    raise ValueError("Incomplete city extract")
with osmium.io.Reader(str(pbf)) as reader:
    timestamp = reader.header().get("osmosis_replication_timestamp")
catalog = {
    "version": 1, "city": "Paraná", "province": "Entre Ríos", "countryCode": "ar",
    "source": "https://www.openstreetmap.org/relation/2879942",
    "downloadSource": "https://download.geofabrik.de/south-america/argentina.html",
    "attribution": "© OpenStreetMap contributors", "license": "ODbL-1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
    "downloadedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "osmTimestamp": timestamp, "streets": extract.streets, "intersections": corners,
}
pathlib.Path("assets/parana-streets.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(json.dumps({"streets": len(extract.streets), "intersections": len(corners), "timestamp": timestamp}))
