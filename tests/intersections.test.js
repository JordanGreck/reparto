import test from 'node:test';
import assert from 'node:assert/strict';
import { IntersectionSearch, intersectionParts } from '../shared/intersections.js';
import { Geocoder } from '../shared/geocoder.js';
import { createDocument } from '../shared/domain.js';
import catalog from '../assets/parana-streets.json' with { type: 'json' };

const settings = createDocument().settings;
const fixture = {
  ...settings,
  streets: [
    { name: 'Padre Bartolomé Grella', aliases: ['Presbítero Grella'] },
    { name: 'Amancio Alcorta' },
    { name: 'Vicente López y Planes' },
    { name: 'Monseñor Bazán y Bustos' },
    { name: 'Don Bosco' },
    { name: '25 de Mayo' },
    { name: '9 de Julio' },
    { name: 'Francisco Ramírez', aliases: ['Avenida Ramírez'] },
    { name: 'Juan Ramírez' },
  ],
  intersections: [
    { id: 1, lat: -31.73, lon: -60.52, streets: [0, 1] },
    { id: 2, lat: -31.72, lon: -60.53, streets: [2, 4] },
    { id: 3, lat: -31.71, lon: -60.54, streets: [3, 4] },
    { id: 4, lat: -31.70, lon: -60.55, streets: [5, 6] },
    { id: 5, lat: -31.69, lon: -60.56, streets: [7, 4] },
    { id: 6, lat: -31.68, lon: -60.57, streets: [8, 4] },
  ],
};
const search = new IntersectionSearch(fixture);

test('short surnames resolve to a real shared node and canonical street names', () => {
  const response = search.search('Grella y Alcorta', settings);
  assert.equal(response.results.length, 1);
  assert.deepEqual(response.results[0], {
    lat: -31.73, lon: -60.52, label: 'Padre Bartolomé Grella y Amancio Alcorta',
    detail: 'Paraná, Entre Ríos · Cruce de calles', precision: 'intersection',
    reason: 'Intersección identificada en el mapa de calles.', query: 'Grella y Alcorta', nodeId: 1,
  });
});
test('accents, case, prefixes, aliases, street order and corner separators are accepted', () => {
  for (const query of ['  GRELLA  y  ALCORTA ', 'Alcorta / Grella', 'Grella & Alcorta', 'grella esq. alcorta', 'Grella esquina Alcorta', 'Grella con Alcorta', 'Presbitero Grella y Amancio Alcorta', 'gre y alc', 'Padre Bartolome Grella y Amancio Alcorta']) {
    assert.equal(search.search(query, settings).results[0]?.nodeId, 1, query);
  }
});
test('conjunctions within street names and date-based street names are preserved', () => {
  assert.equal(intersectionParts('Bazan y Bustos y Don Bosco').length, 2);
  assert.equal(search.search('Bazan y Bustos y Don Bosco', settings).results[0]?.nodeId, 3);
  assert.equal(search.search('Lopez y Planes y Don Bosco', settings).results[0]?.nodeId, 2);
  assert.equal(search.search('25 de Mayo y 9 de Julio', settings).results[0]?.nodeId, 4);
  assert.equal(search.search('Lopez y Planes 1250', settings), null);
  assert.equal(search.search('Bazan y Bustos 1250', settings), null);
  assert.equal(search.search('San Martín 1250', settings), null);
});
test('ambiguous surnames return choices instead of arbitrarily selecting a street', () => {
  assert.equal(search.search('Ramirez y Don Bosco', settings).results.length, 2);
  assert.equal(search.search('Francisco Ramirez y Don Bosco', settings).results.length, 1);
});
test('missing intersections, disconnected streets and the same street never invent a point', () => {
  for (const query of ['Grella y Don Bosco', 'Grella y Grella', 'No existe y Alcorta', '<script> y Alcorta']) {
    assert.deepEqual(search.search(query, settings).results, []);
  }
});
test('city restrictions and overly broad or long queries fail clearly', () => {
  assert.throws(() => search.search('Grella y Alcorta', { ...settings, city: 'Santa Fe' }), /disponible para Paraná/);
  assert.throws(() => search.search('Grella y Alcorta', { ...settings, province: 'Buenos Aires' }), /disponible para Paraná/);
  assert.throws(() => search.search('A'.repeat(161), settings), /160/);
  const broad = new IntersectionSearch({ ...fixture, intersections: Array.from({ length: 21 }, (_, id) => ({ id, lat: 0, lon: id, streets: [0, 1] })) });
  assert.throws(() => broad.search('Grella y Alcorta', settings), /muchas intersecciones/);
});
test('intersection lookup needs no network, address height or external query cache', async () => {
  const service = new Geocoder({ intersectionCatalog: fixture, fetcher: async () => { throw new Error('Network must not be used'); } });
  const response = await service.search('Grella y Alcorta', settings);
  assert.equal(response.local, true);
  assert.equal(response.results.length, 1);
  assert.deepEqual(service.cache, {});
});
test('the bundled Parana catalog resolves the requested example and contains usable shared nodes', () => {
  assert.ok(catalog.streets.length > 100);
  assert.ok(catalog.intersections.length > 100);
  assert.equal(catalog.license, 'ODbL-1.0');
  const result = new IntersectionSearch().search('Grella y Alcorta', settings);
  assert.equal(result.results.length, 1);
  assert.match(result.results[0].label, /Grella/);
  assert.match(result.results[0].label, /Alcorta/);
  assert.ok(result.results[0].lat < -31.68 && result.results[0].lat > -31.81);
  assert.ok(result.results[0].lon < -60.39 && result.results[0].lon > -60.60);
  const ids = new Set();
  for (const corner of catalog.intersections) {
    assert.ok(Number.isFinite(corner.lat) && Number.isFinite(corner.lon));
    assert.ok(!ids.has(corner.id)); ids.add(corner.id);
    assert.ok(corner.streets.length >= 2 && corner.streets.every((id) => catalog.streets[id]));
  }
});
