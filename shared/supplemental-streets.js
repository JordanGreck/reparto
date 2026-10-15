import catalog from '../assets/parana-supplemental-streets.json' with { type: 'json' };
import { IntersectionSearch } from './intersections.js';
import { normalize, parseAddress } from './domain.js';

const words = (text) => normalize(text).replace(/\bgdor\b/g, 'gobernador').replace(/\bgral\b/g, 'general').split(' ').filter((w) => w && !['calle', 'avenida', 'av', 'de', 'del', 'la', 'el', 'los', 'las'].includes(w));
export const streetData = catalog;
export const streetSource = 'Servicio Georef · INDEC';

export function streetMidpoint(paths) {
  const segments = paths.flatMap((path) => path.slice(1).map((b, i) => ({ a: path[i], b, length: Math.hypot((b[0] - path[i][0]) * Math.cos(b[1] * Math.PI / 180), b[1] - path[i][1]) })));
  let remaining = segments.reduce((sum, s) => sum + s.length, 0) / 2;
  for (const s of segments) {
    if (remaining <= s.length && s.length) {
      const t = remaining / s.length;
      return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
    }
    remaining -= s.length;
  }
  return paths[0][0];
}

export class SupplementalStreetSearch extends IntersectionSearch {
  constructor(source = catalog) { super(source); }
  matchingStreets(name) {
    const query = words(name);
    return new Set(this.catalog.streets.flatMap((street, index) => [street.name, ...(street.aliases || [])].some((name) => {
      const tokens = words(name);
      return query.length && query.every((word) => tokens.some((token) => word === token || (!/\d/.test(word) && word.length >= 3 && token.startsWith(word))));
    }) ? [index] : []));
  }
  search(query, settings) {
    if (!this.supports(settings)) return null;
    const response = super.search(query, settings);
    if (!response) return null;
    return { ...response, results: response.results.map((result) => ({ ...result, source: this.catalog.searchSource || streetSource, reason: this.catalog.intersectionReason || 'Intersección identificada en el trazado oficial de calles de Georef / INDEC.' })) };
  }
  street(query, settings) {
    if (!this.supports(settings)) return null;
    const text = String(query).trim().replace(/\s+/g, ' ');
    if (text.length > 160) return null;
    let name = text, number = null;
    // A numbered street is a name, not a house number ("Calle 893").
    if (!/^(?:calle\s+)?\d+$/i.test(text)) {
      const numeric = text.match(/^(?:calle\s+)?(\d+)\s+(\d+[a-z]?)$/i);
      const heightFirst = text.match(/^(\d+[a-z]?)\s+calle\s+(\d+)$/i);
      if (heightFirst) { name = `Calle ${heightFirst[2]}`; number = heightFirst[1]; }
      else if (numeric) { name = `Calle ${numeric[1]}`; number = numeric[2]; }
      else { try { const address = parseAddress(text); name = address.street; number = address.number; } catch { if (!this.catalog.namedStreets) return null; } }
    }
    const matches = [...this.matchingStreets(name)].map((i) => this.catalog.streets[i]).filter((s) => s.supplemental);
    if (!matches.length) return null;
    return { kind: 'street', local: true, cached: false, ...(this.catalog.namedStreets ? { hasHouseNumber: Boolean(number) } : {}), results: matches.map((street) => {
      const [lon, lat] = streetMidpoint(street.paths);
      return {
        lon, lat, label: `${street.name}${number ? ` ${number}` : ''}`,
        detail: `${this.catalog.city}, ${this.catalog.province} · ${this.catalog.streetDetail || 'Calle del nomenclador oficial'}`,
        precision: 'approximate', source: this.catalog.searchSource || streetSource, streetId: street.id, query: text,
        reason: number ? 'Encontramos la calle, pero no hay una ubicación verificada para esa altura. Mové el marcador al domicilio y confirmá el punto antes de calcular el envío.' : 'Encontramos la calle. El marcador muestra un punto de referencia, no un domicilio. Movelo al lugar de entrega y confirmá el punto, o buscá una intersección.',
      };
    }) };
  }
}
