import test from 'node:test';
import assert from 'node:assert/strict';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { intersect } from '@turf/intersect';
import { visibleZoneFills } from '../shared/zone-visibility.js';
import { locateZone } from '../shared/domain.js';

const rectangle = (id, x1, y1, x2, y2, priority = 0, active = true) => ({
  id, priority, active, ring: [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]],
});
const feature = ({ coordinates }) => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates } });
const paintedAt = (fills, point) => fills.filter((fill) => fill.coordinates.length && booleanPointInPolygon(point, feature(fill), { ignoreBoundary: true })).map(({ zone }) => zone.id);
function noBlending(fills) {
  const visible = fills.filter((fill) => fill.coordinates.length);
  for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
    assert.equal(intersect({ type: 'FeatureCollection', features: [feature(visible[i]), feature(visible[j])] }), null);
  }
}

test('a nested zone keeps its color and cuts a hole only in the outer fill', () => {
  const zones = [rectangle('outer', 0, 0, 10, 10), rectangle('inner', 2, 2, 8, 8, 1)];
  const saved = structuredClone(zones);
  const fills = visibleZoneFills(zones);
  assert.deepEqual(paintedAt(fills, [5, 5]), ['inner']);
  assert.deepEqual(paintedAt(fills, [1, 1]), ['outer']);
  assert.equal(fills.find(({ zone }) => zone.id === 'outer').coordinates[0].length, 2);
  noBlending(fills);
  assert.deepEqual(zones, saved);
  assert.equal(locateZone([5, 5], zones).zone.id, 'inner');
});

test('partial and triple overlaps show exactly the zone that supplies the tariff', () => {
  const zones = [rectangle('a', 0, 0, 6, 6), rectangle('b', 3, 1, 9, 7, 1), rectangle('c', 4, 3, 8, 9, 2)];
  const fills = visibleZoneFills(zones);
  noBlending(fills);
  for (let x = 0.25; x < 10; x++) for (let y = 0.25; y < 10; y++) {
    const quote = locateZone([x, y], zones);
    assert.deepEqual(paintedAt(fills, [x, y]), quote.zone ? [quote.zone.id] : []);
  }
  assert.deepEqual(visibleZoneFills([...zones].reverse()), fills);
});

test('a covering strip can split another zone into multiple visible pieces', () => {
  const fills = visibleZoneFills([rectangle('base', 0, 0, 10, 10), rectangle('strip', 4, -1, 6, 11, 1)]);
  assert.equal(fills.find(({ zone }) => zone.id === 'base').coordinates.length, 2);
  assert.deepEqual(paintedAt(fills, [2, 5]), ['base']);
  assert.deepEqual(paintedAt(fills, [8, 5]), ['base']);
  noBlending(fills);
});

test('fully covered zones have no fill; adjacent and disjoint zones remain intact', () => {
  const fills = visibleZoneFills([rectangle('hidden', 1, 1, 2, 2), rectangle('cover', 0, 0, 3, 3, 1), rectangle('adjacent', 3, 0, 4, 3), rectangle('separate', 8, 8, 9, 9)]);
  assert.deepEqual(fills.find(({ zone }) => zone.id === 'hidden').coordinates, []);
  assert.deepEqual(paintedAt(fills, [3.5, 1]), ['adjacent']);
  assert.deepEqual(paintedAt(fills, [8.5, 8.5]), ['separate']);
  noBlending(fills);
  assert.deepEqual(visibleZoneFills([]), []);
});

test('inactive fills never cover an active zone even with a larger priority', () => {
  const fills = visibleZoneFills([rectangle('active', 0, 0, 6, 6, 1), rectangle('inactive', 3, 3, 9, 9, 999, false)]);
  assert.deepEqual(paintedAt(fills, [4, 4]), ['active']);
  assert.deepEqual(paintedAt(fills, [8, 8]), ['inactive']);
  noBlending(fills);
});

test('editing previews the complete draft without mixing colors or changing saved priorities', () => {
  const zones = [rectangle('base', 0, 0, 10, 10), rectangle('higher', 2, 2, 8, 8, 1)];
  const fills = visibleZoneFills(zones, 'base');
  assert.deepEqual(paintedAt(fills, [5, 5]), ['base']);
  noBlending(fills);
  assert.deepEqual(paintedAt(visibleZoneFills(zones), [5, 5]), ['higher']);
});

test('concave zones preserve their visible arms and cut only the intersection', () => {
  const concave = { id: 'L', active: true, priority: 0, ring: [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6], [0, 0]] };
  const fills = visibleZoneFills([concave, rectangle('square', 1, 1, 4, 4, 1)]);
  assert.deepEqual(paintedAt(fills, [1.5, 1.5]), ['square']);
  assert.deepEqual(paintedAt(fills, [1, 5]), ['L']);
  assert.deepEqual(paintedAt(fills, [5, 1]), ['L']);
  assert.deepEqual(paintedAt(fills, [5, 5]), []);
  noBlending(fills);
});
