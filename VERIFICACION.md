# Verificación de Reparto 1.0.4

## Cambio y conservación de datos

Se completan 12 nombres sobre 15 vías que ya estaban dibujadas sin nombre en el sector Crausaz–Paracao. Se agregan 28 nodos compartidos para búsquedas de intersecciones. La geometría proviene del mismo extracto OpenStreetMap que la aplicación; los nombres se cotejaron con Georef / INDEC y la captura aportada por el usuario. Ver assets/SECTOR-CRAUSAZ.md para procedencia, asociación de cada nombre y diferencias entre fuentes.

El cambio visual solo agrega etiquetas: no vuelve a dibujar esas calles ni reemplaza nombres del mapa base. Los dos catálogos anteriores conservan exactamente sus bytes. Los resultados anteriores tienen prioridad. No cambian la geometría de zonas, colores, precios, prioridades, identidad de la aplicación, configuración ni formato de almacenamiento.

## Pruebas realizadas

- 68 pruebas de lógica aprobadas, incluyendo las 59 anteriores y 9 casos específicos del sector: nombres y apellidos, calles numéricas, alturas no verificadas, cruces reales, calles paralelas, compatibilidad de catálogos, resultados del proveedor y caché anterior sin resultados.
- 16 comprobaciones generales de escritorio aprobadas: dibujo y edición de zonas, tarifas, búsquedas, confirmación manual, deshacer/rehacer, respaldos, importación, exportación PNG, reapertura y aislamiento.
- 6 comprobaciones de colores aprobadas, incluyendo superposición, selección, edición/cancelación y exportación sin mezcla de colores.
- 5 comprobaciones del buscador de intersecciones anterior aprobadas.
- 6 comprobaciones del complemento de calles 893 y 868 aprobadas, con conservación de las zonas y configuración guardadas.
- 6 comprobaciones nuevas del sector aprobadas usando una copia aislada de las tres zonas del usuario: rótulos visibles, cruces del norte y sur, tarifas de las zonas originales, alturas aproximadas, cruces inexistentes y persistencia después de cancelar una edición y reabrir.
- Las mismas 6 comprobaciones nuevas también pasaron en el ejecutable empaquetado 1.0.4.
- Revisión visual sobre un encuadre real de OpenStreetMap: Calle 1666 y Ángela O. Sors aparecen sobre sus calles, con el marcador en el vértice compartido. Revisión de los rótulos del sur en las pruebas de escritorio.
- Reconstrucción del nuevo catálogo reproducible byte a byte con las fuentes conservadas.
- Verificación del contenido empaquetado: versión 1.0.4, ambos catálogos anteriores, catálogo nuevo, buscadores y lógica de zonas coinciden con los archivos probados. No contiene zonas del usuario, perfiles de prueba ni capturas personales.
- Instalador NSIS x64 1.0.4 generado correctamente. No se ejecutó sobre el perfil real del usuario.

Se comparó el archivo real de zonas con la copia previa al trabajo: permanece idéntico. Los perfiles y resultados de prueba se guardan en .test-data, excluido del repositorio y del instalador.

## Límites

Se completan los tramos identificados del sector solicitado; no es un relevamiento de todas las calles de Paraná. Los nombres numéricos de esta ampliación proceden de la referencia del usuario y no se presentan como registros oficiales Georef. Calle 1661 ya estaba incluida. Las divergencias de nombres preexistentes, especialmente el tramo rotulado Crisólogo Larralde en el mapa base, se documentan sin renombrarlo.

Al acercar el mapa se muestran los rótulos que tienen espacio. Los domicilios sin altura verificada requieren confirmar el punto antes de cotizar. Las búsquedas anteriores con resultados se conservan y las calles alfabéticas con altura siguen consultando al proveedor antes de recurrir al complemento.

Windows 10/11 de 64 bits. El instalador conserva los datos del mismo usuario de Windows y no tiene certificado de firma digital. Para trasladar las zonas a otra PC se necesita exportar e importar un respaldo.

## Repetir

~~~powershell
npm ci
npm test
npm run build
npm run test:desktop
node scripts/check-zone-colors.mjs
node scripts/check-intersections.mjs
node scripts/check-supplemental-streets.mjs
node scripts/check-sector-crausaz.mjs
npm run dist
$env:REPARTO_PACKAGED = '1'
node scripts/check-sector-crausaz.mjs
~~~
