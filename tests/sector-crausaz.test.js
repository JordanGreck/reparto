import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, normalize } from '../shared/domain.js';
import { Geocoder } from '../shared/geocoder.js';
import { IntersectionSearch } from '../shared/intersections.js';
import { SupplementalStreetSearch } from '../shared/supplemental-streets.js';
import catalog from '../assets/parana-sector-crausaz.json' with { type: 'json' };

const settings = createDocument().settings;
const local = () => new Geocoder({ fetcher: async () => { throw Error('Unexpected network request'); } });

test('reviewed names stay in the requested sector and only add labels', () => {
  const additions = catalog.streets.filter((s) => s.supplemental);
  assert.equal(additions.length, 12);
  for (const street of additions) {
    assert.equal(street.labelsOnly, true);
    assert.ok(street.nameEvidence && street.osmWays.length);
    assert.ok(street.paths.flat().every(([x,y]) => x > -60.542 && x < -60.532 && y > -31.7745 && y < -31.764));
  }
  assert.ok(!additions.some((s) => /Uva|Larralde|1661/.test(s.name)));
});
test('all new names and abbreviated surnames can be found without house numbers', async () => {
  for (const street of catalog.streets.filter((s) => s.supplemental)) {
    const response = await local().search(street.name, settings);
    assert.equal(response.kind, 'street', street.name);
    assert.ok(response.results.some((r) => r.streetId === street.id));
    assert.ok(response.results.every((r) => r.precision === 'approximate'));
  }
  for (const query of ['1666', '1853', '1855', '1165', '1663', 'Sors', 'angela sors', 'Ratto', 'Amanda']) {
    assert.equal((await local().search(query, settings)).results.length, 1, query);
  }
});
test('numbered streets with unknown heights remain approximate and usable offline', async () => {
  for (const query of ['1666 1200', 'Calle 1666 1200', '1200 Calle 1666']) {
    const r = (await local().search(query, settings)).results[0];
    assert.equal(r.label, 'Calle 1666 1200');
    assert.equal(r.precision, 'approximate');
    assert.match(r.reason, /no hay una ubicación verificada/);
  }
});
test('new intersections use shared vertices and support names in either order', async () => {
  for (const [query, lon, lat] of [
    ['1666 y Sors', -60.5366685, -31.765766], ['Sors esquina 1666', -60.5366685, -31.765766],
    ['Sors y Greca', -60.5371903, -31.7681507], ['1855 y 1165', -60.5397463, -31.7730881],
    ['1165 / 1855', -60.5397463, -31.7730881],
  ]) {
    const results = (await local().search(query, settings)).results;
    assert.equal(results.length, 1, query);
    assert.equal(results[0].lon, lon); assert.equal(results[0].lat, lat);
    assert.equal(results[0].precision, 'intersection');
  }
  for (const corner of catalog.intersections) for (const index of corner.streets) {
    const street = catalog.streets[index];
    assert.ok(street);
    if (street.supplemental) assert.ok(street.paths.flat().some(([x,y]) => x === corner.lon && y === corner.lat));
  }
});
test('parallel, disconnected and repeated streets never fabricate intersections', async () => {
  for (const query of ['1853 y 1855', '1853 y 1165', '1666 y Grella', '1663 y 1663']) {
    assert.equal((await local().search(query, settings)).results.length, 0, query);
  }
});
test('existing catalogs keep precedence, including old numbered streets', async () => {
  for (const query of ['Grella y Alcorta', 'Greca y Espejo', '25 de Mayo y 9 de Julio']) {
    assert.deepEqual(await local().search(query, settings), new IntersectionSearch().search(query, settings));
  }
  const old = new SupplementalStreetSearch();
  for (const query of ['893 y 868', '893 y Balbin']) assert.deepEqual(await local().search(query, settings), old.search(query, settings));
  for (const query of ['Calle 893', '868 100', '1661']) assert.deepEqual(await local().search(query, settings), old.street(query, settings));
  const sector = new SupplementalStreetSearch(catalog);
  assert.equal(sector.street('Sors', { ...settings, city: 'Santa Fe' }), null);
  assert.equal(sector.street('166', settings), null);
});
test('a matching existing address provider result is preserved for added named streets', async () => {
  const raw = { lat: '-31.7681507', lon: '-60.5371903', place_rank: 30, osm_type: 'node', display_name: 'Sors 100', address: { road: 'Ángela O. Sors', house_number: '100', city: 'Paraná', state: 'Entre Ríos', country_code: 'ar' } };
  const geocoder = new Geocoder({ fetcher: async () => ({ ok: true, json: async () => [raw] }), delay: 0 });
  const response = await geocoder.search('Ángela O. Sors 100', settings);
  assert.equal(response.results[0].precision, 'address');
  assert.equal(response.results[0].lon, -60.5371903);
  assert.equal(response.kind, undefined);
});
test('unfound named addresses fall back to their street without inventing heights', async () => {
  const geocoder = new Geocoder({ fetcher: async () => ({ ok: true, json: async () => [] }), delay: 0 });
  const response = await geocoder.search('Sors 9999', settings);
  assert.equal(response.kind, 'street');
  assert.equal(response.results[0].precision, 'approximate');
  assert.match(response.results[0].reason, /no hay una ubicación verificada/);
});
test('an empty result cached before the update cannot hide a newly named street', async () => {
  const key = JSON.stringify([normalize('Sors 9999'), settings.city, settings.province, settings.countryCode, settings.geocoderUrl]);
  const geocoder = new Geocoder({ cache: { [key]: { time: Date.now(), value: { results: [] } } }, fetcher: async () => { throw Error('Unexpected network'); } });
  const response = await geocoder.search('Sors 9999', settings);
  assert.equal(response.results[0].label, 'Ángela O. Sors 9999');
  assert.equal(response.results[0].precision, 'approximate');
});
