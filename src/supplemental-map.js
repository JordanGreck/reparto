import L from 'leaflet';
import { streetData } from '../shared/supplemental-streets.js';
import { normalize } from '../shared/domain.js';
import sector from '../assets/parana-sector-crausaz.json' with { type: 'json' };

export function addSupplementalStreets(map) {
  const roadsPane = map.createPane('supplementalRoads');
  roadsPane.style.zIndex = '320'; roadsPane.style.pointerEvents = 'none';
  const namesPane = map.createPane('supplementalNames');
  namesPane.style.zIndex = '450'; namesPane.style.pointerEvents = 'none';
  const roads = L.layerGroup(), names = L.layerGroup().addTo(map);
  const streets = [...streetData.streets, ...sector.streets].filter((s) => s.supplemental);
  for (const street of streets) {
    if (street.labelsOnly) continue;
    const paths = street.paths.map((path) => path.map(([lon, lat]) => [lat, lon]));
    const options = { pane: 'supplementalRoads', interactive: false, pmIgnore: true, lineCap: 'round', lineJoin: 'round' };
    L.polyline(paths, { ...options, color: '#adb4b7', weight: 6, opacity: 0.8 }).addTo(roads);
    L.polyline(paths, { ...options, color: '#fff', weight: 4, opacity: 0.95 }).addTo(roads);
  }
  const attribution = '<a href="https://www.argentina.gob.ar/georef" target="_blank" rel="noreferrer">Servicio Georef / INDEC</a> · CC BY 4.0 · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · nombres complementados';
  let enabled = false;
  function render() {
    names.clearLayers();
    const visible = enabled && map.getZoom() >= 16;
    if (!visible) { if (map.hasLayer(roads)) map.removeLayer(roads); return; }
    if (!map.hasLayer(roads)) roads.addTo(map);
    const bounds = map.getBounds(), occupied = [];
    for (const street of streets) {
      const width = street.name.length * 6.3 + 10;
      const segments = street.paths.flatMap((path) => path.slice(1).map(([lon, lat], i) => {
        const a = map.latLngToContainerPoint([path[i][1], path[i][0]]), b = map.latLngToContainerPoint([lat, lon]);
        return { a, b, length: a.distanceTo(b), center: L.latLng((lat + path[i][1]) / 2, (lon + path[i][0]) / 2) };
      })).filter((s) => s.length >= width && bounds.contains(s.center)).sort((a, b) => b.length - a.length);
      for (const segment of segments) {
        let angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x) * 180 / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        const center = map.latLngToContainerPoint(segment.center), rad = angle * Math.PI / 180;
        const w = Math.abs(Math.cos(rad)) * width + Math.abs(Math.sin(rad)) * 15;
        const h = Math.abs(Math.sin(rad)) * width + Math.abs(Math.cos(rad)) * 15;
        const box = { left: center.x - w / 2, right: center.x + w / 2, top: center.y - h / 2, bottom: center.y + h / 2 };
        if (occupied.some((b) => box.left < b.right + 5 && box.right + 5 > b.left && box.top < b.bottom + 5 && box.bottom + 5 > b.top)) continue;
        const label = document.createElement('span');
        label.className = 'supplemental-street-name'; label.textContent = street.name;
        label.dataset.street = street.id;
        label.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        L.marker(segment.center, { pane: 'supplementalNames', interactive: false, keyboard: false, pmIgnore: true, icon: L.divIcon({ className: 'street-name-marker', html: label, iconSize: [0, 0], iconAnchor: [0, 0] }) }).addTo(names);
        occupied.push(box); break;
      }
    }
  }
  map.on('zoomend moveend resize', render);
  return {
    update(settings) {
      const next = normalize(settings.city) === normalize(streetData.city) && normalize(settings.province) === normalize(streetData.province) && settings.countryCode === streetData.countryCode;
      if (next !== enabled) {
        if (next) map.attributionControl.addAttribution(attribution);
        else map.attributionControl.removeAttribution(attribution);
      }
      enabled = next; render();
    },
  };
}
