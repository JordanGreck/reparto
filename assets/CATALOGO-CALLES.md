# Catálogo de calles e intersecciones de Paraná

`parana-streets.json` contiene una base de datos derivada de OpenStreetMap, bajo **ODbL 1.0**.

- Atribución: © OpenStreetMap contributors.
- Fuente: https://www.openstreetmap.org/relation/2879942
- Descarga regional: https://download.geofabrik.de/south-america/argentina.html
- Licencia: https://opendatacommons.org/licenses/odbl/1-0/
- Información sobre derechos: https://www.openstreetmap.org/copyright

La fecha del mapa se encuentra en `osmTimestamp` y la fecha de extracción en `downloadedAt`. La base derivada se distribuye con la aplicación y el código fuente bajo la misma licencia ODbL. Esta licencia se aplica a los datos cartográficos; no cambia la licencia de las bibliotecas de software.

La extracción conserva nombres y alias de vías con la etiqueta `highway` y nodos compartidos por dos o más nombres de calle, dentro del límite administrativo de Paraná. No infiere cruces a partir de líneas que solo se cruzan en el dibujo: dos vías necesitan compartir un nodo de OpenStreetMap.

Para reconstruir el catálogo, descargar un extracto actualizado de Argentina de Geofabrik y el límite GeoJSON de la relación 2879942 mediante Nominatim. Con pyosmium instalado, ejecutar desde la raíz:

```text
python scripts/extract-street-catalog.py argentina.osm.pbf parana-boundary.json
```

También se incluye un extractor alternativo de Overpass para consultas manuales cuando el servicio esté disponible. No se realizan descargas de calles durante las búsquedas del operador.
