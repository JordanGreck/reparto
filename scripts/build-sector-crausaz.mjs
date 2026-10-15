// Labels for reviewed, previously unnamed OSM ways. Never edits either existing catalog.
// node scripts/build-sector-crausaz.mjs .test-data/map-source/osm-roads.json .test-data/map-source/georef-roads.json
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const [osmFile, georefFile] = process.argv.slice(2);
const osm = JSON.parse(await fs.readFile(osmFile, 'utf8'));
const georef = JSON.parse(await fs.readFile(georefFile, 'utf8'));
const reviewed = [
  { name: 'Calle 1666', ways: [346723367], reference: 'user-screenshot', corroboration: 'https://informaticaparana.com.ar/pages/contact.html' },
  { name: 'Ángela O. Sors', ways: [219905572], georef: '300841600000385' },
  { name: 'Teresa Ratto', ways: [219905559], georef: '300841600008813' },
  { name: 'Dolores Costa de Urquiza', ways: [219905558, 1016916273], georef: '300841600004647' },
  { name: 'Amanda Mayor', ways: [219905565], georef: '300841600000335' },
  { name: 'Carlos Diego Alberto', ways: [219905568, 544461460], georef: '300841600003920' },
  { name: 'Nasario Medrano', aliases: ['Medrano'], ways: [219905576, 544461459], georef: '300841600007510' },
  { name: 'Pascual Greca', ways: [219905583], georef: '300841600007670' },
  { name: 'Calle 1853', ways: [654621006], reference: 'user-screenshot' },
  { name: 'Calle 1855', ways: [677296929], reference: 'user-screenshot' },
  { name: 'Calle 1165', ways: [677296932], reference: 'user-screenshot' },
  { name: 'Calle 1663', ways: [219905562], reference: 'user-screenshot' },
];
const streets = reviewed.map((r) => {
  if (r.georef) assert.ok(georef.some((g) => g.id === r.georef), `Missing official source: ${r.name}`);
  const paths = r.ways.flatMap((id) => {
    const road = osm.find((w) => w.id === id);
    assert.ok(road && !road.name, `Refusing to replace an existing name on OSM way ${id}`);
    assert.ok(road.paths.flat().every(([x,y]) => x >= -60.542 && x <= -60.532 && y >= -31.7745 && y <= -31.764), `Outside reviewed sector: ${id}`);
    return road.paths;
  });
  return { id: `sector:${r.ways[0]}`, name: r.name, aliases: r.aliases || [], supplemental: true, labelsOnly: true, paths, osmWays: r.ways,
    nameEvidence: r.georef ? { source: 'Georef / INDEC', id: r.georef } : { source: 'Referencia aportada por el usuario, 15/10/2026', ...(r.corroboration ? { corroboration: r.corroboration } : {}) } };
});
const assigned = new Map(reviewed.flatMap((r, i) => r.ways.map((id) => [id, i])));
const vertices = new Map();
for (const road of osm) {
  if (!road.name && !assigned.has(road.id)) continue;
  for (const point of road.paths.flat()) {
    const key = point.join(',');
    if (!vertices.has(key)) vertices.set(key, { point, roads: new Set() });
    vertices.get(key).roads.add(road.id);
  }
}
const junctions = [...vertices.values()].filter((v) => [...v.roads].some((id) => assigned.has(id)) && v.roads.size > 1);
for (const id of new Set(junctions.flatMap((v) => [...v.roads]))) {
  if (assigned.has(id)) continue;
  const road = osm.find((r) => r.id === id);
  let index = streets.findIndex((s) => s.name === road.name);
  if (index < 0) { index = streets.length; streets.push({ id: `osm:${id}`, name: road.name, aliases: [], supplemental: false }); }
  assigned.set(id, index);
}
const intersections = junctions.flatMap(({ point, roads }) => {
  const ids = [...new Set([...roads].map((id) => assigned.get(id)))].sort((a,b) => a-b);
  return ids.length < 2 ? [] : [{ id: `sector:${point.join(',')}`, lon: point[0], lat: point[1], streets: ids }];
});
const catalog = { version: 1, city: 'Paraná', province: 'Entre Ríos', countryCode: 'ar', namedStreets: true,
  searchSource: 'OpenStreetMap · complemento local', streetDetail: 'Calle del sector Crausaz–Paracao',
  intersectionReason: 'Cruce del trazado OpenStreetMap, con nombres completados para este sector.',
  geometrySource: 'OpenStreetMap contributors, Geofabrik Argentina 2026-10-14', license: 'ODbL-1.0', licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  nameSources: ['Servicio Georef / INDEC, CC BY 4.0', 'Nombres y ubicación relativa aportados en la captura del usuario, 2026-10-15'],
  modifications: 'Selected unnamed ways; added reviewed names; retained exact OSM geometry; derived intersections only from shared vertices. Labels only: no replacement of base roads or existing names.',
  streets, intersections };
await fs.writeFile('assets/parana-sector-crausaz.json', JSON.stringify(catalog));
console.log(JSON.stringify({ labels: reviewed.length, intersections: intersections.length }));
