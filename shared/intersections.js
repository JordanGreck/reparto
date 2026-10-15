import catalog from '../assets/parana-streets.json' with { type: 'json' };
import { normalize, parseAddress } from './domain.js';

const ignored = new Set(['calle', 'avenida', 'av', 'avda', 'bulevar', 'boulevard', 'bv', 'bvar', 'bvard', 'padre', 'presbitero', 'pbro', 'presb', 'p', 'de', 'del', 'la', 'las', 'los', 'el']);
const tokens = (name) => normalize(name).split(' ').filter((word) => word && !ignored.has(word));
const matches = (query, name) => query.length > 0 && query.every((word) => name.some((part) => word === part || (word.length >= 3 && part.startsWith(word))));

// Try every separator so names containing "y" (López y Planes, Bazán y Bustos)
// remain intact when the other separator identifies the actual intersection.
export function intersectionParts(query) {
  const parts = [];
  for (const match of query.matchAll(/\s+(?:y|e|con|esquina|esq\.?)\s+|\s*[&/]\s*/gi)) {
    const first = query.slice(0, match.index).trim();
    const second = query.slice(match.index + match[0].length).trim();
    if (first && second) parts.push([first, second]);
  }
  return parts;
}

export class IntersectionSearch {
  constructor(source = catalog) {
    this.catalog = source;
    this.names = source.streets.map((street) => [street.name, ...(street.aliases || [])].map(tokens));
  }
  supports(settings) {
    return normalize(settings.city) === normalize(this.catalog.city)
      && normalize(settings.province) === normalize(this.catalog.province)
      && settings.countryCode === this.catalog.countryCode;
  }
  matchingStreets(name) {
    const words = tokens(name);
    return new Set(this.names.flatMap((names, index) => names.some((candidate) => matches(words, candidate)) ? [index] : []));
  }
  search(query, settings) {
    const text = String(query).trim().replace(/\s+/g, ' ');
    if (text.length > 160) throw new Error('La búsqueda admite hasta 160 caracteres.');
    const parts = intersectionParts(text);
    if (!parts.length) return null;
    // A known street containing "y" followed by a house number is an address.
    if (this.supports(settings)) {
      try {
        const address = parseAddress(text);
        if (this.matchingStreets(address.street).size) return null;
      } catch { /* An intersection does not need a house number. */ }
    }
    if (!this.supports(settings)) throw new Error('La búsqueda de intersecciones está disponible para Paraná, Entre Ríos. Para esta localidad usá calle y altura o elegí el punto en el mapa.');
    const results = new Map();
    for (const [first, second] of parts) {
      const a = this.matchingStreets(first), b = this.matchingStreets(second);
      for (const corner of this.catalog.intersections) {
        const firstMatches = corner.streets.filter((id) => a.has(id));
        const secondMatches = corner.streets.filter((id) => b.has(id));
        for (const left of firstMatches) for (const right of secondMatches) {
          if (left === right) continue;
          const ids = [left, right].sort((x, y) => x - y);
          const key = `${corner.id}:${ids.join(':')}`;
          if (results.has(key)) continue;
          const names = ids.map((id) => this.catalog.streets[id].name);
          results.set(key, {
            lat: corner.lat, lon: corner.lon, label: names.join(' y '),
            detail: `${this.catalog.city}, ${this.catalog.province} · Cruce de calles`,
            precision: 'intersection', reason: 'Intersección identificada en el mapa de calles.',
            query: text, nodeId: corner.id,
          });
        }
      }
    }
    if (results.size > 20) throw new Error('Hay muchas intersecciones con esos nombres. Agregá más letras de alguna de las calles para acotar la búsqueda.');
    return { kind: 'intersection', results: [...results.values()].sort((a, b) => a.label.localeCompare(b.label, 'es') || a.lat - b.lat || a.lon - b.lon), cached: false, local: true };
  }
}
