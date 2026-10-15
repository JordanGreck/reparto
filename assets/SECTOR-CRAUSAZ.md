# Nombres complementarios del sector Crausaz–Paracao

`parana-sector-crausaz.json` agrega etiquetas en 15 vías OpenStreetMap sin nombre, agrupadas en 12 calles. No cambia los dos catálogos anteriores ni dibuja caminos nuevos. La capa es exclusiva de Paraná y se muestra a partir del zoom 16, cuando hay espacio para cada rótulo. El buscador incluye 28 nodos compartidos.

## Procedencia

Geometría: extracto Argentina de Geofabrik / OpenStreetMap del 14 de octubre de 2026, el mismo usado por la aplicación. © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright. Se mantienen las coordenadas; los cruces proceden de vértices exactamente compartidos, no de intersecciones calculadas entre líneas.

Nombres alfabéticos: Servicio Georef / INDEC, descargado el 15 de octubre de 2026 bajo CC BY 4.0. Cada registro conserva el identificador de la calle oficial utilizada para cotejar el trazado. La fecha de descarga no implica un relevamiento reciente. Consulta: https://apis.datos.gob.ar/georef/api/v2.0/calles?localidad_censal=30084160&formato=gpkg&max=5000. Condiciones: https://www.argentina.gob.ar/georef/condiciones-de-uso-y-licencia.

Nombres numéricos de esta ampliación: referencia visual aportada por el usuario el 15 de octubre de 2026, contrastada por posición relativa con el trazado OSM. La existencia de Calle 1666 también aparece en la dirección publicada por un comercio de esa calle: https://informaticaparana.com.ar/pages/contact.html. No se presentan estos nombres numéricos como registros oficiales de Georef. No se distribuye la captura, ni se descargaron teselas de Google, ni se extrajeron coordenadas de Google Maps.

| Nombre agregado | Vías OSM sin nombre | Fuente del nombre |
| --- | --- | --- |
| Calle 1666 | 346723367 | Referencia del usuario y dirección comercial publicada |
| Ángela O. Sors | 219905572 | Georef 300841600000385 |
| Teresa Ratto | 219905559 | Georef 300841600008813 |
| Dolores Costa de Urquiza | 219905558, 1016916273 | Georef 300841600004647 |
| Amanda Mayor | 219905565 | Georef 300841600000335 |
| Carlos Diego Alberto | 219905568, 544461460 | Georef 300841600003920 |
| Nasario Medrano | 219905576, 544461459 | Georef 300841600007510; alias Medrano |
| Pascual Greca | 219905583 | Georef 300841600007670 |
| Calle 1853 | 654621006 | Referencia del usuario |
| Calle 1855 | 677296929 | Referencia del usuario |
| Calle 1165 | 677296932 | Referencia del usuario |
| Calle 1663 | 219905562 | Referencia del usuario |

## Alcance y diferencias entre fuentes

Solo se rotulan tramos previamente sin nombre entre las coordenadas -60.542 / -60.532 de longitud y -31.7745 / -31.764 de latitud. Los nombres que ya existían conservan prioridad, incluso cuando una fuente difiere. En particular, no se renombra el tramo que el mapa base muestra como Crisólogo Larralde aunque en el borde inferior de la captura figura Padre Pascual Uva.

El registro Georef llamado Calle 1165 está en otra parte de Paraná: no se trasladó ese registro. El nombre de la vía de este sector procede exclusivamente de la referencia del usuario. Calle 1661 ya estaba en el complemento de 1.0.3 y se conserva sin modificaciones. Los nombres propuestos para calles del barrio en publicaciones recientes no se aplican como si fueran denominaciones aprobadas.

Se conserva la consulta al proveedor para domicilios en calles alfabéticas con altura. Si no devuelve resultados, la calle complementaria ofrece una referencia aproximada que requiere confirmación. Las calles numeradas pueden consultarse localmente; sus alturas no se inventan. La selección de zona, precios, colores y almacenamiento no cambia.

## Reconstrucción

Con los archivos de fuentes descritos en `CATALOGO-CALLES.md` y `CALLES-COMPLEMENTARIAS.md`:

```text
node scripts/build-sector-crausaz.mjs .test-data/map-source/osm-roads.json .test-data/map-source/georef-roads.json
```

El generador rechaza vías ya nombradas o fuera del sector revisado. Una futura actualización de fuentes requiere volver a cotejar las asociaciones; no se ejecuta durante el uso de Reparto. Los datos derivados completos se incluyen en la aplicación y en el código fuente, con las atribuciones indicadas.
