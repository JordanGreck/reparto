import { createDocument, validateDocument } from '../shared/domain.js';
import { Geocoder } from '../shared/geocoder.js';
const browserGeocoder = new Geocoder();
const previewKey = 'reparto-preview-v1';
const preview = {
  desktop: false,
  load: async () => { const saved = localStorage.getItem(previewKey); return { document: saved ? validateDocument(JSON.parse(saved)) : createDocument(), recovered: false }; },
  save: async (value) => { localStorage.setItem(previewKey, JSON.stringify(validateDocument(value))); return { saved: true }; },
  search: async (query) => browserGeocoder.search(query, (await preview.load()).document.settings),
  exportBackup: async () => { const data = (await preview.load()).document; const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'Reparto-respaldo.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return { path: 'Descargas' }; },
  importBackup: async () => { throw new Error('La restauración está disponible en la aplicación de escritorio.'); },
  exportMap: async () => { throw new Error('La exportación del mapa está disponible en la aplicación de escritorio.'); },
  openData: async () => { throw new Error('Esta es una vista previa. Abrí Reparto para acceder a tus archivos.'); },
  setDirty: () => {}, ready: () => {}
};
const native = window.reparto;
export const api = native ? Object.fromEntries(Object.entries(native).map(([name, fn]) => [name, typeof fn !== 'function' || ['setDirty', 'ready'].includes(name) ? fn : async (...args) => { const response = await fn(...args); if (!response.ok) throw new Error(response.error); return response.value; }])) : preview;
