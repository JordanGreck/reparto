# Verificación de Reparto 1.0.2

## Cambio

El buscador acepta intersecciones de Paraná con nombres parciales, sin exigir una altura. Por ejemplo, «Grella y Alcorta» encuentra «Amancio Alcorta y Padre Grella», identifica el punto y calcula la tarifa de la zona correspondiente. Acepta el orden inverso, mayúsculas, nombres sin tildes y separadores como «esquina», «esq.», «con», «/» y «&».

Cuando varias esquinas coinciden, el operador debe elegir una. Si no se encuentra el cruce, se ofrece ubicarlo manualmente y no se informa incorrectamente que está fuera de cobertura. Al mover el marcador hay que confirmar el nuevo punto antes de cotizar.

Se mantiene la búsqueda por calle y altura y la representación de colores sin mezcla de la versión 1.0.1. La geometría guardada, el formato de los respaldos, la identidad de la aplicación y el cálculo de tarifas conservan su compatibilidad.

## Validaciones

- 50 pruebas automatizadas aprobadas: dominio, geocodificación, recorte visual y búsqueda de intersecciones. Incluyen nombres compuestos, alias, ambigüedad, cruces inexistentes y el ejemplo real solicitado.
- 16 comprobaciones de escritorio aprobadas: creación de zonas, consulta por calle y altura, precios, ubicaciones aproximadas, edición de vértices, deshacer/rehacer, respaldo, restauración, exportación y persistencia al reabrir.
- 5 comprobaciones específicas de intersecciones aprobadas tanto en desarrollo como en el ejecutable empaquetado: esquina real y tarifa, variantes del nombre, confirmación después de mover el punto, cruce no encontrado y selección entre coincidencias.
- Captura del ejecutable empaquetado revisada: búsqueda «Grella y Alcorta», nombre completo del cruce, marcador y tarifa de la zona de prueba.
- Compilación de producción e instalador NSIS x64 1.0.2 generados correctamente.

Las pruebas de escritorio usan datos separados de las zonas reales del comercio y mapas de fondo sintéticos. La búsqueda de intersecciones utiliza el catálogo real incluido. El ejemplo solicitado corresponde al nodo OpenStreetMap 331938704, latitud -31.7355837 y longitud -60.5075758. No hubo errores de la aplicación durante las comprobaciones de escritorio.

## Datos y alcance

El catálogo contiene 1363 nombres de vías y 3497 nodos de intersección. Procede del extracto de Argentina de Geofabrik con fecha de datos 2026-10-14T20:21:12Z y limita las intersecciones al municipio de Paraná. Los cruces requieren un nodo compartido en OpenStreetMap; no se calculan por la mera superposición visual de dos líneas. Incluye atribución y licencia ODbL 1.0.

La búsqueda local de intersecciones corresponde a Paraná, Entre Ríos. Puede haber omisiones o cambios posteriores en los datos cartográficos. Las consultas de calle y altura mantienen el proveedor existente; sus respuestas se simulan en las pruebas de regresión.

Windows de 64 bits. El instalador conserva el mismo identificador de la aplicación y no elimina los datos del usuario. No se ejecutó el asistente de actualización sobre la instalación real del usuario. El instalador no tiene firma digital.

## Repetir

```powershell
npm ci
npm test
npm run build
npm run test:desktop
node scripts/check-intersections.mjs
npm run dist
$env:REPARTO_PACKAGED = '1'
node scripts/check-intersections.mjs
```

