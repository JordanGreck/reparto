import { difference } from 'polyclip-ts';

const bounds = (ring) => ring.reduce((box, [x, y]) => [
  Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y),
], [Infinity, Infinity, -Infinity, -Infinity]);
const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// Only the painted geometry is clipped. Stored rings and delivery calculations
// retain the complete zones. During editing the draft is shown in front.
export function visibleZoneFills(zones, draftId = null) {
  const ordered = [...zones].sort((a, b) =>
    Number(b.id === draftId) - Number(a.id === draftId)
    || Number(b.active) - Number(a.active)
    || b.priority - a.priority
    || a.id.localeCompare(b.id));
  const above = [];
  return ordered.map((zone) => {
    const box = bounds(zone.ring);
    const covering = above.filter((other) => overlaps(box, other.box));
    const coordinates = covering.length
      ? difference([zone.ring], ...covering.map((other) => [other.ring]))
      : [[zone.ring]];
    above.push({ ring: zone.ring, box });
    return { zone, coordinates };
  });
}
