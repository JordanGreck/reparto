import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { createIcons, MapPinned, MapPin, Plus, Search, ArrowLeft, ArrowRight, Settings2, HelpCircle, ShieldCheck, Check, X, Layers, Pencil, Trash2, Download, Upload, Image, Undo2, Redo2, LocateFixed, Eye, EyeOff, ChevronDown, CircleCheck, AlertTriangle, MousePointer2, Navigation, FolderOpen, LoaderCircle, PackageCheck, Menu, Crosshair, Copy, RefreshCw } from 'lucide';
import { COLORS, clone, money, normalize, validateDocument, validateZone, overlappingZones, locateZone, History } from '../shared/domain.js';
import { visibleZoneFills } from '../shared/zone-visibility.js';
import { api } from './bridge.js';
import './style.css';

const icons = { MapPinned, MapPin, Plus, Search, ArrowLeft, ArrowRight, Settings2, HelpCircle, ShieldCheck, Check, X, Layers, Pencil, Trash2, Download, Upload, Image, Undo2, Redo2, LocateFixed, Eye, EyeOff, ChevronDown, CircleCheck, AlertTriangle, MousePointer2, Navigation, FolderOpen, LoaderCircle, PackageCheck, Menu, Crosshair, Copy, RefreshCw };
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.8 } });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (selector) => document.querySelector(selector);
let data, history, map, tiles, selectedId = null, draft = null, draftLayer = null, drawing = false, drawPoints = [], drawGroup, hoverLine, marker, result = null, candidates = [], pinMode = false, saving = false, saveError = false, queryEpoch = 0, tileError = false, busySearch = false;
const layers = new Map();
const fillLayers = new Map();
let persistQueue = Promise.resolve();
let noticeTimeout;

function toast(message, error = false) {
  $('#toast').className = `toast visible ${error ? 'error' : ''}`;
  $('#toast').textContent = message;
  clearTimeout(noticeTimeout); noticeTimeout = setTimeout(() => $('#toast').classList.remove('visible'), error ? 8000 : 4500);
}
function status(label, error = false) {
  $('#save-status').innerHTML = `${icon(error ? 'alert-triangle' : saving ? 'loader-circle' : 'shield-check', saving ? 'spin' : '')}<span>${esc(label)}</span>`;
  $('#save-status').classList.toggle('text-error', error); refreshIcons();
}
function persist() {
  const snapshot = clone(data);
  saving = true; status('Guardando cambios…');
  persistQueue = persistQueue.catch(() => {}).then(() => api.save(snapshot));
  const thisSave = persistQueue;
  thisSave.then(() => { if (persistQueue !== thisSave) return; saving = false; saveError = false; status(api.desktop ? 'Todo guardado en esta PC' : 'Vista previa · guardado en el navegador'); })
    .catch((e) => { if (persistQueue !== thisSave) return; saving = false; saveError = true; status('No se pudo guardar · clic para reintentar', true); toast(e.message, true); });
  return thisSave;
}
function commit(next) {
  const valid = validateDocument(next);
  data = history.commit(valid);
  renderZones(); renderHeader(); renderResult(); updateHistory(); persist();
}
function updateHistory() {
  $('#undo').disabled = !!draft || !history.past.length;
  $('#redo').disabled = !!draft || !history.future.length;
}
function renderHeader() {
  $('#business').textContent = data.settings.business;
  $('#city-label').textContent = `${data.settings.city}, ${data.settings.province}`;
  $('#search-scope').textContent = `Buscando en ${data.settings.city}, ${data.settings.province}`;
  $('#currency-label').textContent = `${data.settings.currency} · ${data.settings.currency === 'ARS' ? 'Pesos argentinos' : data.settings.currency}`;
  $('#active-count').textContent = data.zones.filter((z) => z.active).length;
  $('#zone-total').textContent = data.zones.length;
}
function shell() {
  $('#app').innerHTML = `
    <header class="app-header">
      <a class="brand" href="#" aria-label="Reparto, inicio"><span class="brand-icon">${icon('map-pinned')}</span><span>reparto<span class="brand-dot">.</span></span></a>
      <span class="header-divider"></span><div class="business-name"><span class="eyebrow">TU LOCAL</span><strong id="business"></strong></div>
      <div class="header-actions"><button id="backup-menu" class="button quiet">${icon('shield-check')}<span>Respaldos</span>${icon('chevron-down')}</button><button id="settings" class="icon-button" title="Configuración" aria-label="Configuración">${icon('settings-2')}</button><button id="help" class="icon-button" title="Ayuda" aria-label="Ayuda">${icon('help-circle')}</button><span class="avatar">${icon('package-check')}</span></div>
    </header>
    <section class="page-heading"><div><div class="eyebrow">ORGANIZÁ TUS ENVÍOS</div><h1>Zonas de reparto</h1><p>Una dirección. Una zona. El precio correcto.</p></div><div class="location-pill">${icon('map-pin')}<div><strong id="city-label"></strong><span id="currency-label"></span></div></div></section>
    <main class="workspace">
      <aside class="sidebar"><div id="list-pane"><div class="panel-title"><h2>Tus zonas <span id="zone-total" class="count">0</span></h2><span class="tiny-label"><span class="status-dot"></span><span id="active-count">0</span> activas</span></div>
        <button id="new-zone" class="button primary full">${icon('plus')} Nueva zona</button>
        <label class="filter-input">${icon('search')}<input id="zone-filter" placeholder="Filtrar zonas…" aria-label="Filtrar zonas" /></label>
        <div id="zone-list" class="zone-list"></div><div id="zone-detail"></div>
        <div class="sidebar-note">${icon('mouse-pointer-2')}<span>Seleccioná una zona para ver y editar sus datos.</span></div>
      </div><div id="editor-pane" hidden></div></aside>
      <section class="map-panel" aria-label="Mapa de zonas de reparto">
        <div id="map"></div>
        <div class="search-wrapper"><form id="address-form" class="address-search"><span class="search-icon">${icon('search')}</span><input id="address" autocomplete="off" placeholder="Calle y altura o Grella y Alcorta" aria-label="Calle y altura o intersección" maxlength="160" /><button id="search-button" class="search-submit" title="Buscar dirección" aria-label="Buscar dirección">${icon('arrow-right')}</button></form><div class="search-scope" id="search-scope"></div><div id="search-results" hidden></div></div>
        <div id="map-mode" class="mode-badge">${icon('mouse-pointer-2')} Modo consulta</div>
        <div id="map-alert" class="map-alert" hidden></div>
        <div id="drawing-guide" class="drawing-guide" hidden></div>
        <div id="result-card" class="result-card" hidden aria-live="polite"></div>
        <div id="welcome-card" class="welcome-card"><span class="mini-icon">${icon('layers')}</span><div><span class="eyebrow">EMPEZÁ POR ACÁ</span><h3>Tu ciudad, a tu manera.</h3><p>Dibujá tu primera zona y asignale un precio de envío.</p><button id="first-zone" class="text-button">Crear mi primera zona ${icon('arrow-right')}</button></div></div>
        <div class="map-tools"><button id="pin-mode" class="icon-button" title="Consultar un punto del mapa" aria-label="Consultar un punto del mapa">${icon('crosshair')}</button><button id="home-map" class="icon-button" title="Volver a la vista inicial" aria-label="Volver a la vista inicial">${icon('locate-fixed')}</button><button id="fit-zones" class="icon-button" title="Ver todas las zonas" aria-label="Ver todas las zonas">${icon('layers')}</button><button id="toggle-labels" class="icon-button" title="Mostrar u ocultar etiquetas" aria-label="Mostrar u ocultar etiquetas">${icon('eye')}</button><span class="tool-separator"></span><button id="export-map" class="icon-button" title="Exportar imagen del mapa" aria-label="Exportar imagen del mapa">${icon('image')}</button></div>
        <div class="map-caption">${icon('layers')} <span>Zonas transparentes · calles siempre visibles</span></div>
        <div id="export-legend" hidden></div>
      </section>
    </main>
    <footer class="statusbar"><button id="save-status" class="status-button"></button><span class="footer-hint">${icon('navigation')} Diseñado para atender, sin vueltas.</span><div class="history-actions"><button id="undo" class="icon-button small" title="Deshacer (Ctrl+Z)" aria-label="Deshacer">${icon('undo-2')}</button><button id="redo" class="icon-button small" title="Rehacer (Ctrl+Y)" aria-label="Rehacer">${icon('redo-2')}</button></div></footer>
    <dialog id="dialog"><div id="dialog-content"></div></dialog><div id="toast" class="toast" role="status"></div>`;
}
function createMap() {
  map = L.map('map', { zoomControl: false, minZoom: 3, maxZoom: 19, preferCanvas: false, attributionControl: true }).setView(data.settings.center, data.settings.zoom);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.attributionControl.setPrefix(false);
  map.pm.setLang('es');
  map.createPane('zoneFills').style.zIndex = '350';
  drawGroup = L.featureGroup().addTo(map);
  setTiles();
  map.on('click', (event) => {
    if (drawing) { drawPoints.push([event.latlng.lat, event.latlng.lng]); renderDrawing(); }
    else if (pinMode && !draft) { selectPoint(event.latlng); }
  });
  map.on('mousemove', (event) => { if (drawing && drawPoints.length && hoverLine) hoverLine.setLatLngs([drawPoints.at(-1), event.latlng]); });
  map.on('zoomend moveend', declutterLabels);
  new ResizeObserver(() => map.invalidateSize()).observe($('#map'));
}
function setTiles() {
  if (tiles) map.removeLayer(tiles);
  tileError = false;
  tiles = L.tileLayer(data.settings.tileUrl, { maxZoom: 19, attribution: `${esc(data.settings.tileAttribution)} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Licencia</a>`, keepBuffer: 2 });
  tiles.on('tileerror', () => { tileError = true; $('#map-alert').hidden = false; $('#map-alert').textContent = 'No se pudieron cargar partes del mapa. Revisá la conexión. Tus zonas siguen guardadas.'; });
  tiles.on('loading', () => { tileError = false; });
  tiles.on('load', () => { if (!tileError && navigator.onLine) $('#map-alert').hidden = true; });
  tiles.addTo(map);
}
function zoneStyle(zone) { return { color: zone.color, weight: zone.id === selectedId ? 3.5 : 2, fill: false, dashArray: zone.active ? null : '6 6', opacity: zone.active ? 1 : 0.55 }; }
function fillStyle(zone) { return { stroke: false, fill: true, fillColor: zone.color, fillOpacity: zone.id === draft?.id ? 0.20 : zone.active ? (zone.id === selectedId ? 0.23 : 0.15) : 0.04 }; }
function onZoneClick(zone, event) { if (draft) return; if (pinMode) selectPoint(event.latlng); else selectZone(zone.id, false); }
function renderFills() {
  fillLayers.forEach((layer) => map.removeLayer(layer)); fillLayers.clear();
  const zones = data.zones.filter((zone) => zone.id !== draft?.id);
  if (draft?.ring.length >= 4) zones.push(draft);
  for (const { zone, coordinates } of visibleZoneFills(zones, draft?.id)) {
    if (!coordinates.length) continue;
    const latlngs = coordinates.map((polygon) => polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng])));
    const layer = L.polygon(latlngs, { ...fillStyle(zone), pane: 'zoneFills', pmIgnore: true, interactive: !draft, bubblingMouseEvents: false }).addTo(map);
    layer.on('click', (event) => onZoneClick(zone, event));
    fillLayers.set(zone.id, layer);
  }
}
function renderZones() {
  layers.forEach((layer) => map.removeLayer(layer)); layers.clear();
  renderFills();
  data.zones.forEach((zone) => {
    if (draft?.id === zone.id) return;
    const layer = L.polygon(zone.ring.map(([lng, lat]) => [lat, lng]), { ...zoneStyle(zone), pmIgnore: true, bubblingMouseEvents: false }).addTo(map);
    layer.on('click', (event) => onZoneClick(zone, event));
    layer.bindTooltip(`<span class="label-dot" style="background:${zone.color}"></span><strong>${esc(zone.name)}</strong><span>${esc(money(zone.price, data.settings.currency))}</span>`, { permanent: true, direction: 'center', className: `zone-label ${zone.active ? '' : 'inactive'}`, interactive: false, opacity: 1 });
    layers.set(zone.id, layer);
  });
  renderList(); declutterLabels();
  $('#welcome-card').hidden = data.zones.length > 0 || !!draft || !!result;
  $('#toggle-labels').classList.toggle('is-active', data.settings.labels);
  $('#fit-zones').disabled = !data.zones.length;
}
function declutterLabels() {
  const occupied = [];
  const entries = [...layers.entries()].sort(([a], [b]) => a === selectedId ? -1 : b === selectedId ? 1 : 0);
  for (const [, layer] of entries) {
    const tooltip = layer.getTooltip(); const el = tooltip?.getElement(); if (!el) continue;
    el.style.display = data.settings.labels && !draft ? '' : 'none';
    if (!data.settings.labels || draft) continue;
    const rect = el.getBoundingClientRect();
    if (occupied.some((r) => rect.left < r.right + 6 && rect.right + 6 > r.left && rect.top < r.bottom + 5 && rect.bottom + 5 > r.top)) el.style.display = 'none'; else occupied.push(rect);
  }
}
function renderList() {
  const filter = normalize($('#zone-filter').value);
  const zones = data.zones.filter((z) => normalize(z.name + ' ' + z.description).includes(filter));
  $('#zone-list').innerHTML = !data.zones.length ? `<div class="empty-zones"><div class="empty-illustration">${icon('map-pinned')}<span>+</span></div><h3>Todo empieza con una zona</h3><p>Marcá dónde llegás y cuánto cuesta cada envío.</p></div>` : !zones.length ? '<p class="empty-filter">No hay zonas con ese nombre.</p>' : zones.map((z) => `<button class="zone-row ${z.id === selectedId ? 'selected' : ''} ${z.active ? '' : 'inactive'}" data-zone="${z.id}"><span class="zone-color" style="background:${z.color}22;color:${z.color}">${icon('layers')}</span><span class="zone-text"><strong>${esc(z.name)}</strong><small>${z.active ? (z.description ? esc(z.description) : 'Envío disponible') : 'Zona inactiva'}</small></span><span class="zone-price">${esc(money(z.price, data.settings.currency))}</span></button>`).join('');
  document.querySelectorAll('[data-zone]').forEach((button) => button.addEventListener('click', () => selectZone(button.dataset.zone, true)));
  renderDetail(); refreshIcons();
}
function selectZone(id, focus) {
  selectedId = id;
  layers.forEach((layer, key) => { const zone = data.zones.find((z) => z.id === key); layer.setStyle(zoneStyle(zone)); });
  fillLayers.forEach((layer, key) => { const zone = data.zones.find((z) => z.id === key); layer.setStyle(fillStyle(zone)); });
  const layer = layers.get(id); if (layer) { layer.bringToFront(); if (focus) map.fitBounds(layer.getBounds(), { padding: [110, 110], maxZoom: 16 }); }
  renderList(); declutterLabels();
}
function renderDetail() {
  const z = data.zones.find((zone) => zone.id === selectedId);
  $('#zone-detail').innerHTML = z ? `<div class="zone-detail"><div class="detail-heading"><span class="eyebrow">ZONA SELECCIONADA</span><button id="deselect" class="icon-button small" aria-label="Cerrar selección">${icon('x')}</button></div><h3>${esc(z.name)}</h3><div class="detail-price">${esc(money(z.price, data.settings.currency))}<span>por envío</span></div>${z.description ? `<p>${esc(z.description)}</p>` : ''}<div class="detail-meta"><span>${z.active ? 'Activa' : 'Inactiva'}</span><span>Prioridad ${z.priority}</span></div><div class="detail-actions"><button id="edit-zone" class="button secondary">${icon('pencil')} Editar zona</button><button id="delete-zone" class="icon-button danger" title="Eliminar zona" aria-label="Eliminar zona">${icon('trash-2')}</button></div></div>` : '';
  if (z) { $('#deselect').onclick = () => selectZone(null, false); $('#edit-zone').onclick = () => startEdit(z); $('#delete-zone').onclick = () => deleteZone(z); }
}
function beginDraft() {
  queryEpoch++; busySearch = false; $('#search-button').disabled = false; candidates = []; $('#search-results').hidden = true; result = null; removeMarker(); renderResult();
  pinMode = false; $('#pin-mode').classList.remove('is-active');
  $('#list-pane').hidden = true; $('#editor-pane').hidden = false;
  $('#map-mode').className = 'mode-badge editing'; $('#map-mode').innerHTML = `${icon('pencil')} Editando zonas`;
  $('.search-wrapper').classList.add('disabled'); $('#address').disabled = true; $('#search-button').disabled = true;
  for (const id of ['settings', 'backup-menu', 'pin-mode', 'export-map', 'toggle-labels', 'home-map', 'fit-zones']) $(`#${id}`).disabled = true;
  api.setDirty(true); updateHistory(); renderZones(); renderEditor(); refreshIcons();
}
function newZone() {
  if (draft) return;
  if (data.zones.length >= 100) { toast('Se permiten hasta 100 zonas.', true); return; }
  draft = { id: crypto.randomUUID(), name: '', color: COLORS[data.zones.length % COLORS.length], price: 0, description: '', active: true, priority: 0, ring: [] };
  beginDraft(); startDrawing();
}
function startEdit(zone) {
  draft = clone(zone); beginDraft();
  draftLayer = L.polygon(zone.ring.map(([lng, lat]) => [lat, lng]), { color: zone.color, fill: false, weight: 3, pmIgnore: false }).addTo(map);
  enableVertexEditing();
  map.fitBounds(draftLayer.getBounds(), { paddingTopLeft: [50, 120], paddingBottomRight: [90, 100], maxZoom: 16 });
  updateDrawGuide();
}
function enableVertexEditing() {
  draftLayer.pm.enable({ allowSelfIntersection: false, snappable: true, preventMarkerRemoval: false, removeLayerBelowMinVertexCount: false, removeVertexOn: 'contextmenu' });
  draftLayer.on('pm:edit pm:vertexadded pm:vertexremoved pm:markerdragend', () => { draft.ring = draftLayer.toGeoJSON().geometry.coordinates[0]; renderFills(); $('#overlap-accept').checked = false; updateDrawGuide(); });
}
function renderEditor() {
  const existing = data.zones.some((z) => z.id === draft.id);
  $('#editor-pane').innerHTML = `<div class="editor-heading"><button id="cancel-top" class="icon-button" aria-label="Cancelar edición">${icon('arrow-left')}</button><div><span class="eyebrow">${existing ? 'AJUSTÁ TU COBERTURA' : 'AMPLIÁ TU COBERTURA'}</span><h2>${existing ? 'Editar zona' : 'Nueva zona'}</h2></div></div>
    <form id="zone-form"><label class="field">Nombre de la zona<input id="zone-name" maxlength="60" required placeholder="Ej.: Centro" value="${esc(draft.name)}" /></label>
      <div class="field"><span>Color en el mapa</span><div class="color-palette">${COLORS.map((c) => `<button type="button" class="swatch ${draft.color === c ? 'selected' : ''}" style="--swatch:${c}" data-color="${c}" aria-label="Color ${c}">${draft.color === c ? icon('check') : ''}</button>`).join('')}<label class="custom-color" title="Elegir otro color"><input id="zone-color" type="color" value="${draft.color}" aria-label="Color personalizado" /></label></div></div>
      <label class="field">Precio del envío <span class="input-affix"><span>$</span><input id="zone-price" type="number" min="0" max="100000000" step="0.01" required value="${draft.price}" /><span>${data.settings.currency}</span></span></label>
      <label class="field">Etiqueta o descripción <span class="optional">opcional</span><textarea id="zone-description" maxlength="240" rows="2" placeholder="Ej.: Hasta avenida Ramírez">${esc(draft.description)}</textarea></label>
      <label class="toggle-field"><span><strong>Zona activa</strong><small>Disponible para calcular envíos</small></span><input id="zone-active" type="checkbox" ${draft.active ? 'checked' : ''} role="switch" /></label>
      <details class="priority-details"><summary>Prioridad y superposiciones</summary><label class="field">Prioridad <input id="zone-priority" type="number" min="0" max="999" step="1" value="${draft.priority}" required /></label><p>En un cruce o límite compartido gana el número mayor. Si empatan, no se asigna una tarifa automáticamente.</p><label class="checkbox-label"><input id="overlap-accept" type="checkbox" /> Acepto los cruces con otras zonas usando estas prioridades.</label></details>
      <div id="zone-error" class="inline-error" role="alert" hidden></div>
      <div class="editor-footer"><button type="submit" class="button primary full">${icon('check')} Guardar zona</button><button id="cancel-zone" type="button" class="button quiet full">Cancelar</button></div>
    </form>`;
  $('#zone-form').onsubmit = saveZone;
  $('#cancel-zone').onclick = cancelDraft; $('#cancel-top').onclick = cancelDraft;
  $('#zone-color').oninput = (event) => applyDraftColor(event.target.value);
  document.querySelectorAll('[data-color]').forEach((button) => button.onclick = () => { applyDraftColor(button.dataset.color); $('#zone-color').value = draft.color; });
  $('#zone-priority').oninput = () => { $('#overlap-accept').checked = false; };
  $('#zone-active').onchange = () => { $('#overlap-accept').checked = false; };
  $('#zone-name').focus({ preventScroll: true }); $('#editor-pane').scrollTop = 0;
}
function applyDraftColor(color) {
  draft.color = color; draftLayer?.setStyle({ color, fillColor: color });
  fillLayers.get(draft.id)?.setStyle(fillStyle(draft));
  document.querySelectorAll('[data-color]').forEach((button) => { button.classList.toggle('selected', button.dataset.color === color); button.innerHTML = button.dataset.color === color ? icon('check') : ''; });
  if (drawing) renderDrawing(); refreshIcons();
}
function startDrawing() {
  if (draftLayer) { draftLayer.pm.disable(); map.removeLayer(draftLayer); draftLayer = null; }
  drawing = true; drawPoints = []; draft.ring = []; renderFills(); map.doubleClickZoom.disable(); $('#map').classList.add('drawing'); renderDrawing();
}
function renderDrawing() {
  drawGroup.clearLayers();
  if (drawPoints.length) {
    L.polyline(drawPoints, { color: draft.color, weight: 3, pmIgnore: true, interactive: false }).addTo(drawGroup);
    hoverLine = L.polyline([drawPoints.at(-1), drawPoints.at(-1)], { color: draft.color, dashArray: '5 6', weight: 2, pmIgnore: true, interactive: false }).addTo(drawGroup);
    drawPoints.forEach((point, i) => {
      const node = L.circleMarker(point, { radius: i === 0 ? 7 : 5, color: draft.color, fillColor: '#fff', fillOpacity: 1, weight: 2, pmIgnore: true, bubblingMouseEvents: false }).addTo(drawGroup);
      if (i === 0) node.on('click', finishDrawing);
    });
  }
  updateDrawGuide();
}
function finishDrawing() {
  if (drawPoints.length < 3) return toast('Marcá al menos tres puntos para cerrar la zona.', true);
  const ring = drawPoints.map(([lat, lng]) => [lng, lat]); ring.push([...ring[0]]);
  try { validateZone({ ...draft, name: 'Borrador', ring }); } catch (e) { return toast(e.message, true); }
  draft.ring = ring; drawing = false; drawGroup.clearLayers(); hoverLine = null;
  map.doubleClickZoom.enable(); $('#map').classList.remove('drawing');
  draftLayer = L.polygon(drawPoints, { color: draft.color, fill: false, weight: 3, pmIgnore: false }).addTo(map); renderFills(); enableVertexEditing(); updateDrawGuide();
}
function updateDrawGuide() {
  $('#drawing-guide').hidden = false;
  $('#drawing-guide').innerHTML = drawing ? `<div>${icon('pencil')}<span><strong>Dibujá el contorno</strong><small>Hacé clic en las esquinas. Cerrá en el primer punto.</small></span><span class="points-count">${drawPoints.length} puntos</span></div><div class="guide-actions"><button id="draw-undo" class="button secondary" ${!drawPoints.length ? 'disabled' : ''}>${icon('undo-2')} Quitar último</button><button id="draw-finish" class="button primary" ${drawPoints.length < 3 ? 'disabled' : ''}>${icon('check')} Cerrar contorno</button></div>` : `<div>${icon('mouse-pointer-2')}<span><strong>Ajustá los límites</strong><small>Arrastrá puntos · clic en el medio para agregar · clic derecho para quitar.</small></span></div><button id="redraw" class="button secondary">${icon('refresh-cw')} Redibujar</button>`;
  if (drawing) { $('#draw-undo').onclick = () => { drawPoints.pop(); renderDrawing(); }; $('#draw-finish').onclick = finishDrawing; }
  else $('#redraw').onclick = async () => { if (await confirmDialog('¿Volver a dibujar el contorno?', 'Se quitará el contorno de esta edición. Los datos guardados se conservan hasta que guardes la zona.', 'Redibujar')) startDrawing(); };
  refreshIcons();
}
function saveZone(event) {
  event.preventDefault();
  try {
    if (drawing || !draftLayer) throw new Error('Terminá de dibujar y cerrá el contorno antes de guardar.');
    const zone = validateZone({ ...draft, name: $('#zone-name').value, description: $('#zone-description').value, price: Number($('#zone-price').value), active: $('#zone-active').checked, priority: Number($('#zone-priority').value), ring: draftLayer.toGeoJSON().geometry.coordinates[0] });
    const overlaps = overlappingZones(zone, data.zones);
    if (overlaps.length) {
      $('.priority-details').open = true;
      const tie = overlaps.find((z) => z.priority === zone.priority);
      if (tie) throw new Error(`Se cruza con “${tie.name}”, que tiene prioridad ${tie.priority}. Elegí una prioridad distinta.`);
      if (!$('#overlap-accept').checked) throw new Error(`Se cruza con ${overlaps.map((z) => `“${z.name}”`).join(', ')}. Revisá y aceptá las prioridades para continuar.`);
    }
    const next = clone(data); const index = next.zones.findIndex((z) => z.id === zone.id);
    if (index < 0) next.zones.push(zone); else next.zones[index] = zone;
    validateDocument(next);
    endDraft(); selectedId = zone.id; commit(next); toast('Zona actualizada. Los cambios se guardan en esta PC.');
  } catch (e) { $('#zone-error').textContent = e.message; $('#zone-error').hidden = false; $('#zone-error').scrollIntoView({ block: 'nearest' }); }
}
async function cancelDraft() { if (await confirmDialog('¿Descartar esta edición?', 'Los cambios de esta zona que todavía no guardaste se perderán.', 'Descartar cambios')) { endDraft(); renderZones(); } }
function endDraft() {
  if (draftLayer) { draftLayer.pm.disable(); map.removeLayer(draftLayer); draftLayer = null; }
  drawGroup.clearLayers(); draft = null; drawing = false; drawPoints = []; hoverLine = null; map.doubleClickZoom.enable(); $('#map').classList.remove('drawing');
  $('#editor-pane').hidden = true; $('#list-pane').hidden = false; $('#drawing-guide').hidden = true;
  $('#map-mode').className = 'mode-badge'; $('#map-mode').innerHTML = `${icon('mouse-pointer-2')} Modo consulta`;
  $('.search-wrapper').classList.remove('disabled'); $('#address').disabled = false; $('#search-button').disabled = false;
  for (const id of ['settings', 'backup-menu', 'pin-mode', 'export-map', 'toggle-labels', 'home-map', 'fit-zones']) $(`#${id}`).disabled = false;
  api.setDirty(false); updateHistory(); refreshIcons();
}
async function deleteZone(zone) {
  if (!await confirmDialog(`¿Eliminar “${zone.name}”?`, 'La zona dejará de participar en el cálculo de envíos. Podés deshacer esta acción.', 'Eliminar zona')) return;
  const next = clone(data); next.zones = next.zones.filter((z) => z.id !== zone.id); selectedId = null; commit(next); toast('Zona eliminada. Podés recuperarla con Deshacer.');
}
function removeMarker() { if (marker) { map.removeLayer(marker); marker = null; } }
function placeMarker() {
  removeMarker(); if (!result) return;
  marker = L.marker([result.lat, result.lon], { draggable: true, pmIgnore: true, icon: L.divIcon({ className: 'address-marker', html: `<span>${icon('map-pin')}</span>`, iconSize: [42, 48], iconAnchor: [21, 44] }) }).addTo(map);
  marker.on('dragend', () => { const point = marker.getLatLng(); result = { ...result, lat: point.lat, lon: point.lng, precision: 'approximate', confirmed: false, moved: true, reason: 'Moviste el marcador. Confirmá esta nueva ubicación para calcular el envío.' }; renderResult(); });
  refreshIcons();
}
async function searchAddress(event) {
  event.preventDefault(); if (draft || busySearch) return;
  const query = $('#address').value.trim(); const epoch = ++queryEpoch;
  result = null; candidates = []; removeMarker(); renderResult(); $('#search-results').hidden = true;
  busySearch = true; $('#search-button').disabled = true; $('#search-button').innerHTML = icon('loader-circle', 'spin'); refreshIcons();
  try {
    await persistQueue.catch(() => { throw new Error('Primero guardá los cambios pendientes antes de consultar una dirección.'); });
    const response = await api.search(query);
    if (epoch !== queryEpoch) return;
    candidates = response.results;
    if (!candidates.length) {
      const intersection = response.kind === 'intersection';
      $('#search-results').innerHTML = `<div class="search-empty">${icon('search')}<strong>${intersection ? 'No encontramos esa intersección' : 'No encontramos esa dirección'}</strong><p>${intersection ? 'Revisá los nombres de ambas calles. El cruce puede no estar registrado en el catálogo de Paraná.' : `Revisá la calle y la altura en ${esc(data.settings.city)}.`} Esto no significa que esté fuera de zona.</p><button id="manual-address" class="text-button">Ubicarla manualmente ${icon('crosshair')}</button></div>`;
      $('#search-results').hidden = false; $('#manual-address').onclick = () => { $('#search-results').hidden = true; togglePin(true); };
    } else if (candidates.length === 1) chooseAddress(0);
    else {
      $('#search-results').innerHTML = `<div class="candidate-heading">${response.kind === 'intersection' ? 'Elegí la intersección correcta' : 'Elegí la dirección correcta'}</div>${candidates.map((c, i) => `<button class="candidate" data-candidate="${i}">${icon('map-pin')}<span><strong>${esc(c.label)}</strong><small>${esc(c.detail)}</small><em>${c.precision === 'intersection' ? 'Intersección identificada' : c.precision === 'address' ? 'Calle y altura identificadas' : 'Ubicación aproximada · requiere confirmación'}</em></span></button>`).join('')}`;
      $('#search-results').hidden = false; document.querySelectorAll('[data-candidate]').forEach((button) => button.onclick = () => chooseAddress(Number(button.dataset.candidate)));
    }
  } catch (e) { if (epoch === queryEpoch) { $('#search-results').innerHTML = `<div class="search-empty error">${icon('alert-triangle')}<strong>No se pudo completar la consulta</strong><p>${esc(e.message)}</p></div>`; $('#search-results').hidden = false; } }
  finally { if (epoch === queryEpoch) { busySearch = false; $('#search-button').disabled = false; $('#search-button').innerHTML = icon('arrow-right'); refreshIcons(); } }
}
function chooseAddress(index) {
  result = { ...candidates[index], confirmed: false }; pinMode = false; $('#pin-mode').classList.remove('is-active'); $('#map').classList.remove('pinning');
  $('#map-mode').innerHTML = `${icon('mouse-pointer-2')} Modo consulta`;
  $('#search-results').hidden = true; map.setView([result.lat, result.lon], 17); placeMarker(); renderResult();
}
function togglePin(force) {
  pinMode = force ?? !pinMode; $('#pin-mode').classList.toggle('is-active', pinMode); $('#map').classList.toggle('pinning', pinMode);
  $('#map-mode').innerHTML = pinMode ? `${icon('crosshair')} Elegí un punto en el mapa` : `${icon('mouse-pointer-2')} Modo consulta`;
  if (pinMode) toast('Hacé clic en la ubicación del envío. Después podrás confirmar el punto.'); refreshIcons();
}
function selectPoint(latlng) {
  queryEpoch++; busySearch = false; $('#search-button').disabled = false; $('#search-button').innerHTML = icon('arrow-right'); $('#search-results').hidden = true;
  result = { lat: latlng.lat, lon: latlng.lng, label: $('#address').value.trim() || 'Punto elegido en el mapa', detail: `${data.settings.city}, ${data.settings.province}`, precision: 'approximate', confirmed: false, moved: true, reason: 'Elegiste este punto manualmente. Confirmá que corresponde al domicilio del envío.' };
  togglePin(false); placeMarker(); renderResult();
}
function renderResult() {
  const el = $('#result-card'); el.hidden = !result;
  $('#welcome-card').hidden = data.zones.length > 0 || !!draft || !!result;
  if (!result) return;
  const addressHeader = `<div class="result-top"><span class="eyebrow">CONSULTA DE ENVÍO</span><button id="close-result" class="icon-button small" aria-label="Cerrar resultado">${icon('x')}</button></div><h3>${esc(result.label)}</h3><p class="result-locality">${esc(data.settings.city)}, ${esc(data.settings.province)}</p>`;
  if (!['address', 'intersection'].includes(result.precision) && !result.confirmed) {
    el.className = 'result-card approximate'; el.innerHTML = `${addressHeader}<div class="result-state amber">${icon('alert-triangle')} Ubicación por confirmar</div><p>${esc(result.reason)}</p><p class="small-text">Podés arrastrar el marcador para corregirlo. La tarifa se calcula después de confirmar.</p><button id="confirm-point" class="button primary full">${icon('check')} Confirmar este punto</button>`;
    $('#confirm-point').onclick = () => { result.confirmed = true; renderResult(); };
  } else {
    const match = locateZone([result.lon, result.lat], data.zones);
    const source = result.confirmed ? 'Ubicación confirmada por el usuario' : result.precision === 'intersection' ? 'Intersección identificada · © OpenStreetMap' : 'Calle y altura identificadas por el proveedor';
    if (match.status === 'inside') {
      selectedId = match.zone.id; renderList(); layers.forEach((layer, id) => layer.setStyle(zoneStyle(data.zones.find((z) => z.id === id)))); declutterLabels();
      el.className = 'result-card covered'; el.innerHTML = `${addressHeader}<div class="result-state green">${icon('circle-check')} Llegamos a esta dirección</div><div class="quote"><span class="quote-zone"><span class="label-dot" style="background:${match.zone.color}"></span>${esc(match.zone.name)}</span><strong>${esc(money(match.zone.price, data.settings.currency))}</strong><span>Precio del envío</span></div>${match.matches.length > 1 ? `<p class="small-text">Se aplicó la prioridad ${match.zone.priority}${match.boundary ? ' en un límite compartido' : ' entre zonas superpuestas'}.</p>` : match.boundary ? '<p class="small-text">Punto sobre el límite de esta zona: incluido en su cobertura.</p>' : ''}<div class="result-source">${icon('map-pin')} ${source}</div><button id="copy-quote" class="button secondary full">${icon('copy')} Copiar resultado</button>`;
      $('#copy-quote').onclick = async () => { try { await navigator.clipboard.writeText(`${result.label}, ${data.settings.city}\nZona: ${match.zone.name}\nEnvío: ${money(match.zone.price, data.settings.currency)}\n${source}`); toast('Resultado copiado.'); } catch { toast('No se pudo copiar el resultado.', true); } };
    } else if (match.status === 'outside') {
      el.className = 'result-card outside'; el.innerHTML = `${addressHeader}<div class="result-state red">${icon('map-pin')} Fuera de zona</div><p>La dirección queda fuera de todas tus zonas activas de reparto.</p><div class="result-source">${source}</div>`;
    } else if (match.status === 'conflict') {
      el.className = 'result-card approximate'; el.innerHTML = `${addressHeader}<div class="result-state amber">${icon('alert-triangle')} Límite compartido sin prioridad</div><p>Este punto pertenece a ${match.matches.map((z) => esc(z.name)).join(' y ')}. Editá las prioridades para determinar qué tarifa corresponde.</p>`;
    } else {
      el.className = 'result-card approximate'; el.innerHTML = `${addressHeader}<div class="result-state amber">${icon('layers')} Falta configurar la cobertura</div><p>Creá o activá una zona antes de calcular envíos. La dirección ya está ubicada en el mapa.</p>`;
    }
  }
  $('#close-result').onclick = () => { result = null; removeMarker(); renderResult(); };
  refreshIcons();
}
function openDialog(html) {
  $('#dialog-content').innerHTML = html; $('#dialog').showModal(); refreshIcons();
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.onclick = () => $('#dialog').close());
}
function confirmDialog(title, message, action) {
  return new Promise((resolve) => {
    openDialog(`<div class="dialog-heading"><span class="mini-icon amber-bg">${icon('alert-triangle')}</span><h2>${esc(title)}</h2></div><p>${esc(message)}</p><div class="dialog-actions"><button id="confirm-no" class="button secondary">Cancelar</button><button id="confirm-yes" class="button primary">${esc(action)}</button></div>`);
    let accepted = false; $('#confirm-yes').onclick = () => { accepted = true; $('#dialog').close(); }; $('#confirm-no').onclick = () => $('#dialog').close();
    $('#dialog').addEventListener('close', () => resolve(accepted), { once: true }); $('#confirm-no').focus();
  });
}
function openSettings() {
  const s = data.settings;
  openDialog(`<div class="dialog-heading"><span class="mini-icon">${icon('settings-2')}</span><div><span class="eyebrow">A TU MEDIDA</span><h2>Configuración del local</h2></div><button class="icon-button dialog-close" data-close-dialog aria-label="Cerrar">${icon('x')}</button></div><form id="settings-form"><label class="field">Nombre del local<input name="business" required maxlength="100" value="${esc(s.business)}" /></label><div class="form-grid"><label class="field">Ciudad<input name="city" required maxlength="100" value="${esc(s.city)}" /></label><label class="field">Provincia<input name="province" required maxlength="100" value="${esc(s.province)}" /></label><label class="field">País<input name="country" required maxlength="100" value="${esc(s.country)}" /></label><label class="field">Moneda<select name="currency"><option value="ARS" ${s.currency === 'ARS' ? 'selected' : ''}>ARS · Peso argentino</option><option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD · Dólar</option><option value="UYU" ${s.currency === 'UYU' ? 'selected' : ''}>UYU · Peso uruguayo</option></select></label></div><label class="checkbox-label"><input name="useView" type="checkbox" /> Usar la vista actual del mapa como vista inicial</label><p class="small-text">Cambiar la ciudad modifica las búsquedas; las zonas existentes conservan su ubicación. Las tarifas no se convierten al cambiar de moneda.</p><details><summary>Servicios de mapas y direcciones</summary><p class="small-text">OpenStreetMap y Nominatim están configurados para uso moderado en un solo local, sin clave ni cargo por consulta. Requieren Internet y no garantizan disponibilidad. Las búsquedas se envían al proveedor únicamente al presionar Buscar; no incluyas nombres ni datos personales. Para mayor volumen, configurá un servicio compatible. Revisá sus condiciones y costos.</p><label class="field">Código de país (2 letras)<input name="countryCode" pattern="[a-z]{2}" maxlength="2" required value="${esc(s.countryCode)}" /></label><label class="field">Buscador compatible con Nominatim (HTTPS)<input name="geocoderUrl" type="url" required value="${esc(s.geocoderUrl)}" /></label><label class="field">Mapa de teselas (HTTPS con {z}/{x}/{y})<input name="tileUrl" required value="${esc(s.tileUrl)}" /></label><label class="field">Créditos del mapa<input name="tileAttribution" required maxlength="240" value="${esc(s.tileAttribution)}" /></label><a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank">Condiciones de Nominatim</a></details><div id="settings-error" class="inline-error" hidden></div><div class="dialog-actions"><button type="button" class="button secondary" data-close-dialog>Cancelar</button><button class="button primary" type="submit">Guardar configuración</button></div></form>`);
  let changed = false;
  $('#settings-form').oninput = () => { changed = true; api.setDirty(true); };
  $('#dialog').addEventListener('close', () => { api.setDirty(!!draft); }, { once: true });
  $('#settings-form').onsubmit = (event) => {
    event.preventDefault();
    try {
      const fields = new FormData(event.currentTarget); const next = clone(data);
      for (const key of ['business', 'city', 'province', 'country', 'countryCode', 'currency', 'geocoderUrl', 'tileUrl', 'tileAttribution']) next.settings[key] = fields.get(key).trim();
      if (fields.has('useView')) { const c = map.getCenter(); next.settings.center = [c.lat, c.lng]; next.settings.zoom = map.getZoom(); }
      validateDocument(next);
      const resetTiles = next.settings.tileUrl !== s.tileUrl || next.settings.tileAttribution !== s.tileAttribution;
      queryEpoch++; busySearch = false; $('#search-button').disabled = false; $('#search-button').innerHTML = icon('arrow-right'); $('#search-results').hidden = true; result = null; removeMarker();
      commit(next); if (resetTiles) setTiles(); $('#dialog').close(); toast('Configuración guardada.');
    } catch (e) { $('#settings-error').hidden = false; $('#settings-error').textContent = e.message; }
  };
}
function showBackups() {
  openDialog(`<div class="dialog-heading"><span class="mini-icon">${icon('shield-check')}</span><div><span class="eyebrow">TUS DATOS, SIEMPRE A MANO</span><h2>Copias de seguridad</h2></div><button class="icon-button dialog-close" data-close-dialog aria-label="Cerrar">${icon('x')}</button></div><p>Las zonas se guardan en esta PC. Llevá una copia a otro equipo o recuperá una versión anterior.</p><div class="backup-options"><button id="export-backup" class="option-card">${icon('download')}<span><strong>Guardar un respaldo</strong><small>Contornos, nombres, colores y precios</small></span>${icon('arrow-right')}</button><button id="import-backup" class="option-card">${icon('upload')}<span><strong>Restaurar un respaldo</strong><small>Revisar un archivo y reemplazar los datos</small></span>${icon('arrow-right')}</button><button id="open-data" class="option-card">${icon('folder-open')}<span><strong>Abrir carpeta de datos</strong><small>Incluye la copia automática anterior</small></span>${icon('arrow-right')}</button></div><p class="small-text">Las direcciones consultadas no se incluyen en el respaldo de zonas.</p>`);
  $('#export-backup').onclick = async () => { try { await persistQueue; const saved = await api.exportBackup(); if (saved) toast('Copia de seguridad guardada.'); } catch (e) { toast(e.message, true); } };
  $('#import-backup').onclick = async () => {
    try {
      await persistQueue; const imported = await api.importBackup(); if (!imported) return;
      queryEpoch++; busySearch = false; $('#search-button').disabled = false; $('#search-button').innerHTML = icon('arrow-right'); $('#search-results').hidden = true;
      data = validateDocument(imported); history = new History(data); selectedId = null; result = null; removeMarker(); setTiles(); map.setView(data.settings.center, data.settings.zoom); renderHeader(); renderZones(); renderResult(); updateHistory(); $('#dialog').close(); toast('Respaldo restaurado. Se conservó una copia de los datos anteriores.');
    } catch (e) { toast(e.message, true); }
  };
  $('#open-data').onclick = () => api.openData().catch((e) => toast(e.message, true));
}
function showHelp() {
  openDialog(`<div class="dialog-heading"><span class="mini-icon">${icon('help-circle')}</span><div><span class="eyebrow">EN POCOS PASOS</span><h2>Repartir empieza por acá</h2></div><button class="icon-button dialog-close" data-close-dialog aria-label="Cerrar">${icon('x')}</button></div><ol class="help-steps"><li><strong>Dibujá tus zonas</strong><p>Tocá Nueva zona y marcá sus esquinas. Cerrá el contorno y elegí nombre, color y precio.</p></li><li><strong>Ajustá los límites</strong><p>Al editar, arrastrá los puntos. Agregá uno en el medio de un lado o quitá uno con clic derecho.</p></li><li><strong>Consultá una dirección</strong><p>Escribí calle y altura, como “San Martín 1250”, o un cruce, como “Grella y Alcorta”. Podés usar nombres abreviados; si hay varias opciones, elegí la esquina correcta.</p></li><li><strong>Confirmá lo aproximado</strong><p>Algunas alturas son estimaciones del mapa. Revisá el marcador, movelo si hace falta y confirmá el punto.</p></li></ol><div class="help-note">${icon('shield-check')}<p>Los datos se guardan automáticamente. Usá Respaldos para hacer una copia. Ctrl+Z deshace cambios y Ctrl+Y los rehace.</p></div><p class="small-text">El número de prioridad más alto gana en cruces y límites compartidos. Un empate pide corregir las prioridades. Las zonas inactivas no se usan para calcular envíos.</p><p class="small-text">El mapa muestra las calles y la numeración disponible al acercarte. La cobertura de alturas depende de OpenStreetMap. Las intersecciones de Paraná se buscan en un catálogo local de OpenStreetMap. El mapa y las búsquedas nuevas por altura necesitan Internet.</p><a href="https://www.openstreetmap.org/fixthemap" target="_blank">Informar un error del mapa</a>`);
}
async function exportMap() {
  if (tileError || !navigator.onLine || tiles.isLoading()) return toast('Esperá a que termine de cargar el mapa y revisá la conexión antes de exportar.', true);
  const bounds = map.getBounds(); const visible = data.zones.filter((z) => layers.get(z.id)?.getBounds().intersects(bounds));
  const legend = $('#export-legend');
  legend.innerHTML = `<strong>${esc(data.settings.business)} · Zonas de reparto</strong><span>${esc(data.settings.city)} · ${esc(data.settings.currency)}</span><div class="export-zone-list">${visible.map((z) => `<div><span class="label-dot" style="background:${z.color}"></span><span>${esc(z.name)}${z.active ? '' : ' (inactiva)'}</span><b>${esc(money(z.price, data.settings.currency))}</b></div>`).join('') || '<div>Sin zonas en esta vista</div>'}</div><small>${esc(data.settings.tileAttribution)} · ${new Date().toLocaleDateString('es-AR')}</small>`;
  legend.hidden = false; $('.map-panel').classList.add('exporting'); document.body.classList.add('exporting-map');
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (legend.scrollHeight > map.getSize().y - 70) throw new Error('Hay demasiadas zonas para una leyenda legible. Acercá el mapa para exportar menos zonas.');
    const r = $('.map-panel').getBoundingClientRect();
    const saved = await api.exportMap({ x: Math.ceil(r.x), y: Math.ceil(r.y), width: Math.floor(r.width) - 1, height: Math.floor(r.height) - 1 });
    if (saved) toast('Imagen del mapa guardada.');
  } catch (e) { toast(e.message, true); }
  finally { legend.hidden = true; $('.map-panel').classList.remove('exporting'); document.body.classList.remove('exporting-map'); }
}
function travelHistory(direction) {
  if (draft || $('#dialog').open) return;
  const previous = data.settings;
  data = history[direction](); selectedId = null;
  if (previous.tileUrl !== data.settings.tileUrl || previous.tileAttribution !== data.settings.tileAttribution) setTiles();
  if (previous.city !== data.settings.city || previous.province !== data.settings.province || previous.countryCode !== data.settings.countryCode) { queryEpoch++; result = null; removeMarker(); $('#search-results').hidden = true; busySearch = false; $('#search-button').disabled = false; $('#search-button').innerHTML = icon('arrow-right'); }
  renderHeader(); renderZones(); renderResult(); updateHistory(); persist();
}
function events() {
  $('.brand').onclick = (e) => { e.preventDefault(); if (!draft) map.setView(data.settings.center, data.settings.zoom); };
  $('#new-zone').onclick = newZone; $('#first-zone').onclick = newZone;
  $('#zone-filter').oninput = renderList; $('#address-form').onsubmit = searchAddress;
  $('#address').oninput = () => { queryEpoch++; busySearch = false; result = null; candidates = []; removeMarker(); renderResult(); $('#search-results').hidden = true; $('#search-button').disabled = false; $('#search-button').innerHTML = icon('arrow-right'); refreshIcons(); };
  $('#settings').onclick = openSettings; $('#help').onclick = showHelp; $('#backup-menu').onclick = showBackups;
  $('#home-map').onclick = () => map.setView(data.settings.center, data.settings.zoom);
  $('#fit-zones').onclick = () => { const bounds = L.latLngBounds(data.zones.flatMap((z) => z.ring.map(([lng, lat]) => [lat, lng]))); if (bounds.isValid()) map.fitBounds(bounds, { paddingTopLeft: [70, 100], paddingBottomRight: [80, 80], maxZoom: 16 }); };
  $('#toggle-labels').onclick = () => { const next = clone(data); next.settings.labels = !next.settings.labels; commit(next); };
  $('#pin-mode').onclick = () => togglePin(); $('#export-map').onclick = exportMap;
  $('#undo').onclick = () => travelHistory('undo'); $('#redo').onclick = () => travelHistory('redo');
  $('#save-status').onclick = () => { if (saveError) persist(); };
  document.addEventListener('keydown', (event) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || $('#dialog').open) return;
    if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); if (drawing) { drawPoints.pop(); renderDrawing(); } else travelHistory(event.shiftKey ? 'redo' : 'undo'); }
    if (event.ctrlKey && event.key.toLowerCase() === 'y') { event.preventDefault(); travelHistory('redo'); }
    if (event.key === 'Escape') { if (draft) cancelDraft(); else { $('#search-results').hidden = true; if (pinMode) togglePin(false); } }
  });
  window.addEventListener('offline', () => { $('#map-alert').hidden = false; $('#map-alert').textContent = 'Sin conexión. Tus zonas están guardadas. Los mapas nuevos y las búsquedas no almacenadas necesitan Internet.'; });
  window.addEventListener('online', () => { $('#map-alert').hidden = true; tiles.redraw(); });
}
async function init() {
  try {
    const loaded = await api.load(); data = validateDocument(loaded.document); history = new History(data);
    shell(); createMap(); events(); renderHeader(); renderZones(); updateHistory();
    status(api.desktop ? 'Todo guardado en esta PC' : 'Vista previa · guardado en el navegador');
    await persist();
    if (loaded.recovered) toast('Recuperamos la copia automática anterior. El archivo dañado se conservó en la carpeta de datos.', true);
    api.ready();
  } catch (e) {
    $('#app').innerHTML = `<div class="fatal"><h1>No pudimos abrir tus zonas</h1><p>${esc(e.message)}</p><p>No se reemplazó el archivo original.</p><button id="fatal-data">Abrir carpeta de datos</button><button id="fatal-retry">Volver a intentar</button></div>`;
    $('#fatal-retry').onclick = () => location.reload(); $('#fatal-data').onclick = () => api.openData(); api.ready();
  }
}
init();

