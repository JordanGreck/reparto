// Usage: node scripts/build-supplemental-streets.mjs georef-parana.gpkg osm-roads.json boundary.json
// Adds verified numbered streets without changing the original OSM catalog.
import fs from 'node:fs/promises';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { readGeoref } from './read-georef.mjs';
import { normalize } from '../shared/domain.js';
import original from '../assets/parana-streets.json' with { type: 'json' };

const [gpkg, osmPath, boundaryPath] = process.argv.slice(2);
if (!gpkg || !osmPath || !boundaryPath) throw new Error('Provide Georef GeoPackage, OSM road geometry and Paraná boundary');
const roads = readGeoref(gpkg);
const osm = JSON.parse(await fs.readFile(osmPath, 'utf8'));
const boundary = JSON.parse(await fs.readFile(boundaryPath, 'utf8'));
const key = (name) => normalize(name).replace(/^calle /, '');
const existing = new Set(original.streets.flatMap((s) => [s.name, ...s.aliases]).map(key));
const projected = ([x, y]) => [x * 94600, y * 111200];
const segments = osm.filter((r) => r.name).flatMap((r) => r.paths.flatMap((p) => p.slice(1).map((b, i) => ({ name: r.name, a: projected(p[i]), b: projected(b) }))));
const report = [];
const additions = new Set();
for (const road of roads) {
  if (!/^CALLE \d+$/.test(road.nombre) || existing.has(key(road.nombre))) continue;
  if (!road.paths.flat().every((p) => booleanPointInPolygon(p, boundary))) {
    report.push({ name: road.nombre, id: road.id, skipped: 'outside municipality' }); continue;
  }
  const points = road.paths.flat().map(projected);
  const minX = Math.min(...points.map((p) => p[0])) - 15, maxX = Math.max(...points.map((p) => p[0])) + 15;
  const minY = Math.min(...points.map((p) => p[1])) - 15, maxY = Math.max(...points.map((p) => p[1])) + 15;
  const nearby = segments.filter(({ a, b }) => Math.min(a[0], b[0]) <= maxX && Math.max(a[0], b[0]) >= minX && Math.min(a[1], b[1]) <= maxY && Math.max(a[1], b[1]) >= minY);
  let total = 0, covered = 0;
  const names = new Set();
  for (const path of road.paths) for (let i = 1; i < path.length; i++) {
    const a = projected(path[i - 1]), b = projected(path[i]);
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (!length) continue;
    const n = Math.max(1, Math.ceil(length / 15));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, x = a[0] + t * dx, y = a[1] + t * dy;
      total += length / n;
      const overlap = nearby.find((s) => {
        const sx = s.b[0] - s.a[0], sy = s.b[1] - s.a[1], squared = sx * sx + sy * sy;
        if (!squared || Math.abs(dx * sx + dy * sy) / (length * Math.sqrt(squared)) < 0.9) return false;
        const u = Math.max(0, Math.min(1, ((x - s.a[0]) * sx + (y - s.a[1]) * sy) / squared));
        return Math.hypot(x - s.a[0] - u * sx, y - s.a[1] - u * sy) < 15;
      });
      if (overlap) { covered += length / n; names.add(overlap.name); }
    }
  }
  // Avoid giving an old numerical designation to a road already named in OSM.
  if (covered / total > 0.3) report.push({ name: road.nombre, id: road.id, skipped: 'already named on map', matches: [...names] });
  else { additions.add(road.id); report.push({ name: road.nombre, id: road.id, added: true }); }
}
const vertices = new Map();
for (const road of roads) for (const path of road.paths) for (const point of path) {
  // Exact coordinates from one official topology; no inferred line crossings.
  const id = point.join(',');
  if (!vertices.has(id)) vertices.set(id, { point, roads: new Set() });
  vertices.get(id).roads.add(road.id);
}
const junctions = [...vertices.values()].filter((v) => v.roads.size > 1 && [...v.roads].some((id) => additions.has(id)));
const included = new Set([...additions, ...junctions.flatMap((v) => [...v.roads])]);
const streets = roads.filter((r) => included.has(r.id)).map((r) => ({
  id: r.id, name: r.nombre.toLowerCase().replace(/\b\p{L}/gu, (s) => s.toUpperCase()), aliases: [],
  supplemental: additions.has(r.id), ...(additions.has(r.id) ? { paths: r.paths } : {}),
}));
const indices = new Map(streets.map((s, i) => [s.id, i]));
const intersections = junctions.map((v) => ({ id: `georef:${v.point.join(',')}`, lon: v.point[0], lat: v.point[1], streets: [...v.roads].map((id) => indices.get(id)) }));
const catalog = {
  version: 1, city: 'Paraná', province: 'Entre Ríos', countryCode: 'ar',
  source: 'Servicio Georef – argentina.gob.ar/georef', provider: 'INDEC',
  downloadUrl: 'https://apis.datos.gob.ar/georef/api/v2.0/calles?localidad_censal=30084160&formato=gpkg&max=5000',
  license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  termsUrl: 'https://www.argentina.gob.ar/georef/condiciones-de-uso-y-licencia',
  downloadedAt: (await fs.stat(gpkg)).mtime.toISOString(),
  modifications: 'Selected missing numbered streets; converted geometries and capitalization; derived junctions from shared vertices. Existing named OSM roads are excluded.',
  streets, intersections,
};
await fs.writeFile('assets/parana-supplemental-streets.json', JSON.stringify(catalog));
await fs.mkdir('.test-data/map-source', { recursive: true });
await fs.writeFile('.test-data/map-source/supplemental-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ added: additions.size, intersections: intersections.length, skipped: report.filter((r) => r.skipped).length, examples: streets.filter((s) => ['Calle 893', 'Calle 868'].includes(s.name)) }));
