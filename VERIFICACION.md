# Verificación de Reparto 1.0.3

## Cambio y conservación de datos

Se incorpora una capa complementaria de calles numeradas oficiales de Paraná (Servicio Georef / INDEC), incluyendo Calle 893 y Calle 868. Contiene 125 registros de vías, correspondientes a 122 nombres, y 281 nodos de intersección. Los trazados se consultaron el 15 de octubre de 2026 y se compararon con el extracto OpenStreetMap existente para excluir calles ya identificadas.

El catálogo original de OpenStreetMap permanece idéntico al de 1.0.2. La geometría de las zonas, los precios, las prioridades, los colores, la configuración, el formato de guardado y la identidad de la aplicación se conservan. No se ejecutó el instalador sobre el perfil real del usuario.

## Pruebas realizadas

- 59 pruebas de lógica aprobadas, incluyendo los 50 casos anteriores y 9 casos nuevos de calles oficiales, calles con nombre numérico, alturas sin verificar, cruces existentes e inexistentes, ambigüedad y conservación de la prioridad de las tarifas.
- 16 comprobaciones de escritorio aprobadas: creación y edición, precios, búsquedas por calle y altura, ubicaciones aproximadas, deshacer/rehacer, respaldo, importación, exportación PNG, reapertura y aislamiento.
- 6 comprobaciones visuales de colores aprobadas: zonas anidadas, selección, prioridades, edición/cancelación y colores sin mezcla en el PNG exportado.
- 5 comprobaciones del buscador de intersecciones anterior aprobadas: Grella y Alcorta, nombres completos y abreviados, orden inverso, confirmación tras mover el marcador y selección entre opciones.
- 6 comprobaciones de calles complementarias aprobadas en desarrollo usando una copia aislada de las tres zonas guardadas: nombres visibles, consulta por calle sin inventar alturas, esquina nueva con la tarifa existente, cruces no encontrados, compatibilidad de Grella y Alcorta y conservación de zonas y configuración después de cancelar una edición y reabrir.
- Revisión visual de un encuadre real de OpenStreetMap: las calles 893 y 868 se muestran sobre sus trazados y el marcador se ubica en el cruce oficial.
- Las 6 comprobaciones de calles complementarias también pasaron en el ejecutable empaquetado 1.0.3. Se verificó que ambos catálogos y el buscador incluidos coinciden con las fuentes probadas.
- Instalador NSIS x64 1.0.3 generado correctamente.

Se comparó el archivo real de zonas con la copia previa al trabajo: sigue idéntico, sin modificaciones. Los archivos de prueba permanecen en .test-data y están excluidos del repositorio y del instalador.

## Límites

La ampliación cubre calles numeradas disponibles en el nomenclador oficial que faltaban en el catálogo anterior. No representa un relevamiento nuevo de todas las calles de la ciudad. La fecha de descarga no es una fecha de relevamiento. Las calles sin altura verificada requieren ubicar y confirmar el domicilio antes de cotizar.

Windows 10/11 de 64 bits. El instalador conserva los datos del mismo usuario de Windows y no tiene firma digital. Para trasladar zonas a otra PC sigue siendo necesario exportar e importar un respaldo.

## Repetir

~~~powershell
npm ci
npm test
npm run build
npm run test:desktop
node scripts/check-zone-colors.mjs
node scripts/check-intersections.mjs
node scripts/check-supplemental-streets.mjs
npm run dist
$env:REPARTO_PACKAGED = '1'
node scripts/check-supplemental-streets.mjs
~~~
