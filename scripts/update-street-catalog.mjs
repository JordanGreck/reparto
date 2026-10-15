import fs from 'node:fs/promises';

// Manual, bounded OSM extract: this is not run when an operator searches.
const query = '[out:json][timeout:45];area(3602879942)->.city;way(area.city)["highway"]["name"]->.roads;.roads out body;node(w.roads)(area.city);out skel;';
const endpoint = new URL('https://maps.mail.ru/osm/tools/overpass/api/interpreter');
const response = await fetch(endpoint, {
  method: 'POST', body: new URLSearchParams({ data: query }),
  headers: { 'User-Agent': 'RepartoDesktop/1.0 (Parana local street catalog)' },
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Overpass: ${response.status} ${(await response.text()).slice(0, 1800)}`);
const raw = await response.json();
if (raw.remark || !Array.isArray(raw.elements)) throw new Error(raw.remark || 'Invalid OSM extract');
const nodes = new Map(raw.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
const streets = [], byName = new Map(), crossings = new Map();
for (const way of raw.elements.filter((e) => e.type === 'way')) {
  const name = way.tags?.name;
  if (!name || !Array.isArray(way.nodes)) continue;
  let index = byName.get(name);
  if (index === undefined) {
    index = streets.length; byName.set(name, index); streets.push({ name, aliases: [] });
  }
  const street = streets[index];
  for (const key of ['alt_name', 'short_name', 'official_name', 'name:es']) {
    for (const alias of (way.tags[key] || '').split(';').map((s) => s.trim()).filter(Boolean)) {
      if (alias !== name && !street.aliases.includes(alias)) street.aliases.push(alias);
    }
  }
  for (const id of way.nodes) {
    if (!nodes.has(id)) continue;
    if (!crossings.has(id)) crossings.set(id, new Set());
    crossings.get(id).add(index);
  }
}
const intersections = [...crossings].filter(([, roads]) => roads.size >= 2).map(([id, roads]) => {
  const node = nodes.get(id);
  return { id, lat: node.lat, lon: node.lon, streets: [...roads] };
});
if (streets.length < 100 || intersections.length < 100) throw new Error('Incomplete city extract');
const catalog = {
  version: 1, city: 'Paraná', province: 'Entre Ríos', countryCode: 'ar',
  source: 'https://www.openstreetmap.org/relation/2879942',
  downloadEndpoint: endpoint.origin + endpoint.pathname,
  attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  downloadedAt: new Date().toISOString(), osmTimestamp: raw.osm3s?.timestamp_osm_base,
  query, streets, intersections,
};
await fs.writeFile('assets/parana-streets.json', JSON.stringify(catalog));
console.log(JSON.stringify({ streets: streets.length, intersections: intersections.length, timestamp: catalog.osmTimestamp }));
