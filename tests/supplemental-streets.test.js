import test from 'node:test';
import assert from 'node:assert/strict';
import { SupplementalStreetSearch, streetData, streetMidpoint } from '../shared/supplemental-streets.js';
import { Geocoder } from '../shared/geocoder.js';
import { IntersectionSearch } from '../shared/intersections.js';
import { createDocument, locateZone } from '../shared/domain.js';
import original from '../assets/parana-streets.json' with { type: 'json' };

const settings = createDocument().settings;
const local = new SupplementalStreetSearch();
const service = () => new Geocoder({ fetcher: async () => { throw new Error('Local streets should not need the network'); } });

test('official streets 893 and 868 have geometry, provenance and license', () => {
  assert.equal(streetData.license, 'CC-BY-4.0');
  for (const name of ['Calle 893', 'Calle 868']) {
    const street = streetData.streets.find((s) => s.name === name);
    assert.ok(street?.supplemental);
    assert.ok(street.paths.length && street.paths.every((p) => p.length >= 2));
    assert.ok(street.paths.flat().every(([x, y]) => x > -60.50 && x < -60.49 && y > -31.80 && y < -31.78));
  }
});
test('street-only searches do not mistake numerical names for house numbers', async () => {
  for (const query of ['Calle 893', 'calle 868', '893', '868']) {
    const response = await service().search(query, settings);
    assert.equal(response.kind, 'street');
    assert.equal(response.results.length, 1);
    assert.equal(response.results[0].precision, 'approximate');
    assert.match(response.results[0].reason, /no un domicilio/);
  }
  assert.equal(local.street('Calle 89', settings), null);
});
test('unknown heights are never fabricated or automatically quoted', async () => {
  for (const query of ['Calle 893 100', '893 100', '100 Calle 893']) {
    const response = await service().search(query, settings);
    assert.equal(response.results[0].label, 'Calle 893 100');
    assert.equal(response.results[0].precision, 'approximate');
    assert.match(response.results[0].reason, /no hay una ubicación verificada/);
  }
});
test('the requested official corner is an actual shared vertex in both streets', async () => {
  for (const query of ['Calle 893 y Calle 868', '893 y 868', '868 esquina 893', 'Calle 893 / 868']) {
    const response = await service().search(query, settings);
    assert.equal(response.results.length, 1, query);
    const point = response.results[0];
    assert.equal(point.lon, -60.49701873); assert.equal(point.lat, -31.787737135);
    assert.equal(point.precision, 'intersection'); assert.match(point.source, /Georef/);
    for (const name of ['Calle 893', 'Calle 868']) {
      assert.ok(streetData.streets.find((s) => s.name === name).paths.flat().some(([x, y]) => x === point.lon && y === point.lat));
    }
  }
});
test('supplemental streets connect to named streets and never invent a disconnected corner', async () => {
  assert.equal((await service().search('893 y Balbin', settings)).results.length, 1);
  assert.equal((await service().search('868 y Parera', settings)).results.length, 1);
  assert.equal((await service().search('893 y Grella', settings)).results.length, 0);
  assert.equal((await service().search('893 y 893', settings)).results.length, 0);
});
test('existing intersections retain their original results and attribution', async () => {
  const old = new IntersectionSearch();
  for (const query of ['Grella y Alcorta', '25 de Mayo y 9 de Julio', 'Ramirez y Don Bosco', 'Bazan y Bustos y Don Bosco']) {
    const previous = old.search(query, settings);
    if (previous.results.length) assert.deepEqual(await service().search(query, settings), previous);
  }
  assert.equal(local.street('Calle 893', { ...settings, city: 'Santa Fe' }), null);
  assert.equal(local.search('893 y 868', { ...settings, province: 'Buenos Aires' }), null);
});
test('duplicate numbered names at different locations remain explicit choices', () => {
  const fixture = { ...settings, streets: [
    { id: 'a', name: 'Calle 893', supplemental: true, paths: [[[-60.50, -31.78], [-60.51, -31.78]]] },
    { id: 'b', name: 'Calle 893', supplemental: true, paths: [[[-60.53, -31.75], [-60.54, -31.75]]] },
  ], intersections: [] };
  assert.equal(new SupplementalStreetSearch(fixture).street('893', settings).results.length, 2);
});
test('catalog uses valid geometry and shared vertices with no original catalog replacement', () => {
  const ids = new Set();
  for (const street of streetData.streets) {
    assert.ok(!ids.has(street.id)); ids.add(street.id);
    if (!street.supplemental) continue;
    assert.ok(!original.streets.some((s) => s.name.toLowerCase() === street.name.toLowerCase()));
    assert.ok(street.paths.flat().every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  }
  for (const corner of streetData.intersections) {
    assert.ok(corner.streets.length >= 2 && corner.streets.every((id) => streetData.streets[id]));
    for (const id of corner.streets) {
      const street = streetData.streets[id];
      if (street.supplemental) assert.ok(street.paths.flat().some(([x, y]) => x === corner.lon && y === corner.lat));
    }
  }
});
test('midpoint stays on the street and existing zone priority still determines prices', async () => {
  assert.deepEqual(streetMidpoint([[[0, 0], [2, 0]]]), [1, 0]);
  const { lon, lat } = (await service().search('893 y 868', settings)).results[0];
  const ring = [[lon-.001,lat-.001],[lon+.001,lat-.001],[lon+.001,lat+.001],[lon-.001,lat+.001],[lon-.001,lat-.001]];
  const zones = [{ id: 'a', active: true, priority: 1, price: 1800, ring }, { id: 'b', active: true, priority: 2, price: 2300, ring }];
  const before = JSON.stringify(zones);
  assert.equal(locateZone([lon, lat], zones).zone.price, 2300);
  assert.equal(JSON.stringify(zones), before);
});
