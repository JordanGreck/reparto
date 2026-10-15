"""Extract OSM road geometry for auditing supplementary street names.

Requires pyosmium. Does not modify the existing search catalog or user data.
Usage: python scripts/extract-road-geometry.py argentina.osm.pbf output.json
"""
import json
import sys
import osmium


class Roads(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.nodes = {}
        self.roads = []

    def node(self, node):
        x, y = node.location.lon, node.location.lat
        if -60.60 <= x <= -60.38 and -31.82 <= y <= -31.68:
            self.nodes[node.id] = [x, y]

    def way(self, way):
        if not way.tags.get('highway'):
            return
        paths, current = [], []
        for node in way.nodes:
            if node.ref in self.nodes:
                current.append(self.nodes[node.ref])
            else:
                if len(current) > 1:
                    paths.append(current)
                current = []
        if len(current) > 1:
            paths.append(current)
        if paths:
            self.roads.append({'id': way.id, 'name': way.tags.get('name', ''), 'highway': way.tags.get('highway'), 'paths': paths})


extract = Roads()
print('Reading road geometry...', flush=True)
extract.apply_file(sys.argv[1])
with open(sys.argv[2], 'w', encoding='utf8') as output:
    json.dump(extract.roads, output, ensure_ascii=False, separators=(',', ':'))
print(f'Extracted {len(extract.roads)} roads', flush=True)
