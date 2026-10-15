import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { intersect } from '@turf/intersect';
import { kinks } from '@turf/kinks';

export const COLORS = ['#177d68', '#4285d4', '#cf8641', '#9a66bf', '#dc6478', '#729348', '#397f98', '#b27658'];
export const clone = (value) => structuredClone(value);
export const normalize = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const money = (amount, currency = 'ARS') => new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
export function createDocument() {
  return { version: 1, settings: { business: 'Mi local', city: 'Paraná', province: 'Entre Ríos', country: 'Argentina', countryCode: 'ar', currency: 'ARS', center: [-31.733, -60.529], zoom: 14, labels: true, geocoderUrl: 'https://nominatim.openstreetmap.org/search', tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', tileAttribution: '© OpenStreetMap contributors' }, zones: [] };
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const textField = (s, max, label, optional = false) => { assert(typeof s === 'string' && s.length <= max && (optional || s.trim().length > 0), `${label}: completá un texto válido de hasta ${max} caracteres.`); return s.trim(); };
const validPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85;
export const feature = (zone) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [zone.ring] } });
export function validateZone(input) {
  assert(input && typeof input === 'object', 'La zona no es válida.');
  const id = textField(input.id, 80, 'Identificador');
  assert(/^[a-zA-Z0-9_-]+$/.test(id), 'Identificador de zona inválido.');
  const name = textField(input.name, 60, 'Nombre');
  const description = textField(input.description ?? '', 240, 'Descripción', true);
  assert(/^#[\da-fA-F]{6}$/.test(input.color), 'Elegí un color válido.');
  assert(Number.isFinite(input.price) && input.price >= 0 && input.price <= 100000000 && Math.abs(input.price * 100 - Math.round(input.price * 100)) < 0.00001, 'El precio debe ser positivo o cero, con hasta dos decimales.');
  assert(typeof input.active === 'boolean', 'El estado de la zona no es válido.');
  assert(Number.isInteger(input.priority) && input.priority >= 0 && input.priority <= 999, 'La prioridad debe ser un número entero de 0 a 999.');
  const ring = input.ring;
  assert(Array.isArray(ring) && ring.length >= 4 && ring.length <= 501 && ring.every(validPoint), 'El contorno debe tener entre 3 y 500 puntos válidos.');
  assert(ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1], 'El contorno de la zona debe estar cerrado.');
  const unique = new Set(ring.slice(0, -1).map((p) => p.join(',')));
  assert(unique.size === ring.length - 1, 'El contorno tiene puntos repetidos.');
  const result = { id, name, description, color: input.color.toLowerCase(), price: input.price, active: input.active, priority: input.priority, ring: ring.map((p) => [...p]) };
  assert(kinks(feature(result)).features.length === 0, 'El contorno se cruza consigo mismo. Mové o quitá los puntos que se cruzan.');
  const origin = ring[0];
  const area = ring.slice(0, -1).reduce((s, p, i) => { const q = ring[i + 1]; return s + (p[0] - origin[0]) * (q[1] - origin[1]) - (q[0] - origin[0]) * (p[1] - origin[1]); }, 0);
  assert(Math.abs(area) > 1e-12, 'La zona debe encerrar una superficie.');
  return result;
}
export function overlappingZones(zone, zones) {
  if (!zone.active) return [];
  return zones.filter((other) => other.active && other.id !== zone.id && intersect({ type: 'FeatureCollection', features: [feature(zone), feature(other)] }) !== null);
}
export function validateDocument(input) {
  assert(input && input.version === 1 && Array.isArray(input.zones), 'El archivo no es un respaldo compatible de Reparto.');
  assert(input.zones.length <= 100, 'Se permiten hasta 100 zonas por local.');
  const s = input.settings;
  assert(s && typeof s === 'object', 'Falta la configuración del local.');
  const settings = {};
  for (const key of ['business', 'city', 'province', 'country']) settings[key] = textField(s[key], 100, key);
  assert(/^[a-z]{2}$/.test(s.countryCode), 'Código de país inválido.');
  assert(/^[A-Z]{3}$/.test(s.currency), 'Moneda inválida.');
  try { money(0, s.currency); } catch { throw new Error('Moneda inválida.'); }
  assert(Array.isArray(s.center) && validPoint([s.center[1], s.center[0]]), 'Ubicación inicial inválida.');
  assert(Number.isFinite(s.zoom) && s.zoom >= 3 && s.zoom <= 19, 'Zoom inicial inválido.');
  for (const key of ['geocoderUrl', 'tileUrl']) {
    const url = new URL(textField(s[key], 500, 'Dirección del proveedor'));
    assert(url.protocol === 'https:' && !url.username && !url.password, 'Los proveedores deben usar una dirección HTTPS sin credenciales.');
  }
  assert(s.tileUrl.includes('{z}') && s.tileUrl.includes('{x}') && s.tileUrl.includes('{y}'), 'La dirección del mapa debe incluir {z}, {x} e {y}.');
  Object.assign(settings, { countryCode: s.countryCode, currency: s.currency, center: [...s.center], zoom: s.zoom, labels: Boolean(s.labels), geocoderUrl: s.geocoderUrl, tileUrl: s.tileUrl, tileAttribution: textField(s.tileAttribution, 240, 'Créditos del mapa') });
  const zones = input.zones.map(validateZone);
  assert(new Set(zones.map((z) => z.id)).size === zones.length, 'Hay identificadores de zona repetidos.');
  assert(new Set(zones.map((z) => normalize(z.name))).size === zones.length, 'Hay nombres de zona repetidos.');
  for (let i = 0; i < zones.length; i++) {
    const conflict = overlappingZones(zones[i], zones.slice(i + 1)).find((z) => z.priority === zones[i].priority);
    assert(!conflict, `“${zones[i].name}” y “${conflict?.name}” se superponen. Asignales prioridades diferentes.`);
  }
  return { version: 1, settings, zones };
}
export function locateZone(point, zones) {
  assert(validPoint(point), 'Ubicación inválida.');
  const matches = zones.filter((z) => z.active && booleanPointInPolygon(point, feature(z))).sort((a, b) => b.priority - a.priority);
  if (!matches.length) return { status: zones.some((z) => z.active) ? 'outside' : 'unconfigured', matches };
  const boundary = matches.some((z) => !booleanPointInPolygon(point, feature(z), { ignoreBoundary: true }));
  if (matches.length > 1 && matches[0].priority === matches[1].priority) return { status: 'conflict', matches, boundary };
  return { status: 'inside', zone: matches[0], matches, boundary };
}
export function parseAddress(query) {
  const q = String(query).trim().replace(/\s+/g, ' ');
  assert(q.length >= 4 && q.length <= 160, 'Escribí calle y altura (San Martín 1250) o dos calles (Grella y Alcorta).');
  let match = q.match(/^(.+?)\s+(\d{1,6}[a-zA-Z]?)$/);
  if (match && /[a-záéíóúñ]/i.test(match[1])) return { street: match[1], number: match[2], query: q };
  match = q.match(/^(\d{1,6}[a-zA-Z]?)\s+(.+)$/);
  assert(match && /[a-záéíóúñ]/i.test(match[2]), 'Agregá la altura al final de la calle (25 de Mayo 250) o buscá un cruce (Grella y Alcorta).');
  return { street: match[2], number: match[1], query: q };
}
export function classifyAddress(raw, address, settings) {
  const a = raw.address || {};
  const lat = Number(raw.lat), lon = Number(raw.lon);
  if (!validPoint([lon, lat])) return null;
  const city = a.city || a.town || a.village || a.municipality || '';
  if ((city && normalize(city).replace(/^municipio de /, '') !== normalize(settings.city)) || (a.state && normalize(a.state) !== normalize(settings.province)) || (a.country_code && a.country_code !== settings.countryCode)) return null;
  const street = a.road || a.pedestrian || a.residential || a.footway || '';
  const number = a.house_number || '';
  const stripPrefix = (s) => normalize(s).replace(/^(calle|avenida|av|bulevar|boulevard|bv) /, '');
  const sameStreet = street && stripPrefix(street) === stripPrefix(address.street);
  const sameCity = normalize(city) === normalize(settings.city);
  const sameProvince = normalize(a.state || '') === normalize(settings.province);
  const interpolated = raw.osm_type === 'way' && (raw.category || raw.class) === 'place' && raw.type === 'house';
  const exact = Boolean(sameStreet && normalize(number) === normalize(address.number) && sameCity && sameProvince && a.country_code === settings.countryCode && raw.place_rank === 30 && !interpolated);
  return { lat, lon, label: street ? `${street}${number ? ` ${number}` : ''}` : String(raw.name || raw.display_name || address.query), detail: String(raw.display_name || ''), precision: exact ? 'address' : 'approximate', reason: exact ? 'Calle y altura identificadas por el proveedor.' : interpolated ? 'El proveedor estima la altura entre dos números conocidos. Confirmá el punto antes de calcular el envío.' : 'La altura o la localidad no está confirmada. Revisá y confirmá el punto en el mapa.', query: address.query };
}
export class History {
  constructor(initial, limit = 40) { this.current = clone(initial); this.past = []; this.future = []; this.limit = limit; }
  commit(value) { this.past.push(this.current); if (this.past.length > this.limit) this.past.shift(); this.current = clone(value); this.future = []; return clone(this.current); }
  undo() { if (!this.past.length) return clone(this.current); this.future.push(this.current); this.current = this.past.pop(); return clone(this.current); }
  redo() { if (!this.future.length) return clone(this.current); this.past.push(this.current); this.current = this.future.pop(); return clone(this.current); }
}
