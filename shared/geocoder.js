import { parseAddress, classifyAddress, normalize } from './domain.js';
import { IntersectionSearch } from './intersections.js';
import { SupplementalStreetSearch } from './supplemental-streets.js';
import sectorCatalog from '../assets/parana-sector-crausaz.json' with { type: 'json' };

export class Geocoder {
  constructor({ fetcher = fetch, cache = {}, onCache = async () => {}, delay = 1100, intersectionCatalog, supplementalCatalog } = {}) {
    this.fetcher = fetcher; this.cache = cache; this.onCache = onCache; this.delay = delay; this.lastRequest = 0; this.queue = Promise.resolve();
    this.intersections = new IntersectionSearch(intersectionCatalog);
    this.supplemental = new SupplementalStreetSearch(supplementalCatalog);
    this.sector = new SupplementalStreetSearch(sectorCatalog);
  }
  search(query, settings) {
    const intersection = this.intersections.search(query, settings);
    if (intersection) {
      if (intersection.results.length) return Promise.resolve(intersection);
      const supplemental = this.supplemental.search(query, settings);
      if (supplemental?.results.length) return Promise.resolve(supplemental);
      return Promise.resolve(this.sector.search(query, settings) || supplemental || intersection);
    }
    const street = this.supplemental.street(query, settings);
    if (street) return Promise.resolve(street);
    const sectorStreet = this.sector.street(query, settings);
    if (sectorStreet && (!sectorStreet.hasHouseNumber || sectorStreet.results.every((r) => /^Calle \d+ \d+[a-z]?$/i.test(r.label)))) return Promise.resolve(sectorStreet);
    const address = parseAddress(query);
    const key = JSON.stringify([normalize(address.query), settings.city, settings.province, settings.countryCode, settings.geocoderUrl]);
    const task = this.queue.catch(() => {}).then(async () => {
      const cached = this.cache[key];
      if (cached && Date.now() - cached.time < 7 * 24 * 60 * 60 * 1000) return { ...(sectorStreet && !cached.value.results.length ? sectorStreet : cached.value), cached: true };
      const endpoint = new URL(settings.geocoderUrl);
      if (endpoint.protocol !== 'https:') throw new Error('El buscador requiere un proveedor HTTPS.');
      const params = { street: `${address.number} ${address.street}`, city: settings.city, state: settings.province, countrycodes: settings.countryCode, format: 'jsonv2', addressdetails: '1', limit: '6', 'accept-language': 'es' };
      for (const [name, value] of Object.entries(params)) endpoint.searchParams.set(name, value);
      const request = async (url) => {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, this.lastRequest + this.delay - Date.now())));
        this.lastRequest = Date.now();
        let response;
        try { response = await this.fetcher(url.toString(), { signal: AbortSignal.timeout(15000), headers: { 'Accept': 'application/json', 'User-Agent': 'RepartoDesktop/1.0 (local delivery zone manager)' } }); }
        catch { throw new Error('No se pudo conectar con el buscador. Revisá Internet o volvé a intentar. Esto no significa que el envío esté fuera de zona.'); }
        if (response.status === 429) throw new Error('El buscador recibió demasiadas consultas. Esperá un momento y volvé a intentar.');
        if (!response.ok) throw new Error(`El servicio de direcciones no está disponible (${response.status}). Volvé a intentar más tarde.`);
        let data;
        try { data = await response.json(); } catch { throw new Error('El buscador devolvió una respuesta inválida. Intentá nuevamente.'); }
        if (!Array.isArray(data)) throw new Error('La respuesta del proveedor no es compatible con Nominatim.');
        return data;
      };
      let raw = await request(endpoint);
      if (!raw.length) {
        endpoint.searchParams.set('street', address.street);
        raw = await request(endpoint);
      }
      const results = raw.slice(0, 6).map((r) => classifyAddress(r, address, settings)).filter(Boolean);
      const unique = results.filter((r, i) => results.findIndex((other) => other.lat === r.lat && other.lon === r.lon) === i);
      // Preserve existing address-provider results. Use the added street only when
      // the provider has no result; never turn a reference point into a house number.
      const value = unique.length || !sectorStreet ? { results: unique, cached: false } : sectorStreet;
      this.cache[key] = { time: Date.now(), value };
      const entries = Object.entries(this.cache).sort((a, b) => b[1].time - a[1].time).slice(0, 500);
      this.cache = Object.fromEntries(entries);
      try { await this.onCache(this.cache); } catch { /* Cache failure does not turn a successful address query into a failure. */ }
      return value;
    });
    this.queue = task;
    return task;
  }
}
