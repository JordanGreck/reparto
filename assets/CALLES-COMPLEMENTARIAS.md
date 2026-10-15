# Calles complementarias de Paraná

`parana-supplemental-streets.json` agrega 125 registros de vías, correspondientes a 122 nombres numerados que faltaban en el catálogo original, y 281 nodos compartidos con otras calles. Incluye **Calle 893**, **Calle 868** y **Calle 870**, en el sector de barrio Juan Pablo II.

## Fuente y licencia

- Fuente: **Servicio Georef – argentina.gob.ar/georef**, con nomenclador de **INDEC**.
- Localidad censal: Paraná, Entre Ríos, identificador `30084160`.
- Descarga: https://apis.datos.gob.ar/georef/api/v2.0/calles?localidad_censal=30084160&formato=gpkg&max=5000
- Fecha de descarga: 15 de octubre de 2026. La API no informa una fecha de relevamiento individual para cada calle; no se presenta la fecha de descarga como fecha de relevamiento.
- Condiciones: https://www.argentina.gob.ar/georef/condiciones-de-uso-y-licencia
- Licencia de estos datos: **Creative Commons Atribución 4.0 Internacional**, https://creativecommons.org/licenses/by/4.0/

Modificaciones: selección de calles numeradas ausentes, conversión de GeoPackage a JSON, ajuste de mayúsculas y derivación de cruces a partir de vértices exactamente compartidos. La topología y las coordenadas proceden de la misma fuente oficial; no se calculan cruces por la superposición visual de líneas. Se conserva el identificador oficial de cada vía.

## Compatibilidad y límites

El archivo original `parana-streets.json`, sus nombres y sus cruces permanecen intactos. Esta ampliación se muestra como una capa adicional, solo en Paraná y al acercar el mapa. No modifica el archivo de zonas, los precios, las prioridades ni los proveedores elegidos por el usuario.

Se excluyen vías cuyo trazado coincide en más de un 30 % con una calle ya nombrada en el extracto OpenStreetMap usado por la aplicación (segmentos paralelos a menos de 15 m). Esta comparación evita reemplazar nombres existentes con designaciones numéricas potencialmente antiguas. No garantiza que todas las calles faltantes de la ciudad estén incluidas; los casos descartados requieren revisión particular.

Las búsquedas existentes con resultados mantienen prioridad. Los cruces complementarios usan nodos compartidos del nomenclador. La búsqueda por una calle complementaria sola muestra un punto de referencia y exige confirmación; una altura solicitada no se inventa ni se interpola. Los distintos registros con el mismo nombre se ofrecen como alternativas.

## Reconstrucción

1. Descargar el GeoPackage indicado arriba y conservar la fuente y la fecha.
2. Obtener el extracto de Geofabrik y el límite municipal indicados en `CATALOGO-CALLES.md`.
3. Con pyosmium instalado, extraer la geometría para comparar nombres:

```text
python scripts/extract-road-geometry.py argentina.osm.pbf osm-roads.json
```

4. Con Node.js 24, generar el complemento:

```text
node scripts/build-supplemental-streets.mjs georef-parana.gpkg osm-roads.json parana-boundary.json
```

El informe de inclusiones y exclusiones se escribe en `.test-data/map-source/supplemental-report.json`. Verificarlo antes de distribuir una nueva extracción. Ningún extractor se ejecuta durante el uso normal de Reparto.
