# Reparto

Reparto nació de una conversación por teléfono con una amiga y de un problema frecuente en su lugar de trabajo, una rotisería de Paraná, Entre Ríos: saber cuánto cobrar por cada envío sin perder tiempo ni generar confusiones.

Para consultar las tarifas, el equipo buscaba las direcciones en un mapa físico con las zonas de reparto marcadas. En medio del trabajo, encontrar una calle podía demorar la atención; las calles o numeraciones desactualizadas complicaban la búsqueda, y confundir una zona terminaba en un precio mal informado. Una consulta sencilla podía encadenar demoras, pérdidas y estrés para todo el negocio.

Cuando me contó lo que pasaba, le respondí: «Esto se puede resolver. Mañana te mando una primera versión para que la prueben». Así empezó Reparto: una herramienta pensada a partir de una necesidad concreta, para que consultar una dirección y comunicar el costo del envío sea más claro y rápido.

La idea es simple: reducir los errores al cotizar y el tiempo dedicado a buscar direcciones, para que el equipo pueda atender con más tranquilidad. Resolver esa pequeña fricción cotidiana puede mejorar mucho la dinámica de todo el local.

Reparto es una aplicación de escritorio para Windows 10/11 de 64 bits. Permite dibujar zonas de delivery sobre el mapa de Paraná, asignar colores y tarifas en pesos argentinos y consultar direcciones o intersecciones, como **Grella y Alcorta**, para determinar cobertura y precio.

## Abrir la aplicación

Descargá el instalador de la [versión 1.0.5](https://github.com/jordangreck-cyber/reparto/releases/tag/v1.0.5). El repositorio y sus descargas son públicos. Para actualizar una instalación existente, cerrá Reparto y ejecutá el instalador con el mismo usuario de Windows; se conservan las zonas, precios y configuración.

Para llevar tus datos a otra PC, exportá un respaldo desde **Respaldos**, copiá ese archivo junto con el instalador e importalo en la otra PC. Los datos del local no forman parte del repositorio.

El instalador se genera en `entrega/Reparto-Instalador-1.0.5.exe`. Instala para el usuario actual, permite elegir carpeta y crea un acceso directo. No necesita Node.js en el equipo del comercio.

También puede abrirse `entrega/win-unpacked/Reparto.exe` conservando **toda** esa carpeta. El instalador de esta entrega no tiene certificado de firma de código.

La aplicación empieza sin zonas ni precios inventados. La ciudad inicial es Paraná, Entre Ríos, Argentina; la moneda es ARS.

## Funciones

- Mapa de calles con zoom, desplazamiento y numeración cuando el mapa la contiene y el zoom lo permite.
- Dibujo de polígonos, edición de vértices, colores, nombres, descripción, tarifa y activación.
- Búsqueda por calle y altura o por intersecciones de Paraná con nombres abreviados, como Grella y Alcorta. No hace consultas automáticas mientras se escribe.
- Nombres complementarios del sector Crausaz–Paracao: 12 calles que estaban sin identificar, con búsquedas como `1666 y Sors` o `1855 y 1165`.
- Distinción entre dirección localizada, aproximada, no encontrada, fuera de zona y falta de cobertura configurada.
- Confirmación de alturas interpoladas y puntos elegidos o movidos manualmente.
- Prioridades explícitas para cruces de zonas. El número mayor prevalece. En un límite compartido con empate, no se cotiza automáticamente.
- Rellenos sin mezcla de colores: solo se pinta la parte visible de cada zona según su prioridad. Los contornos guardados y el cálculo de tarifas conservan su geometría completa.
- Autoguardado local, historial de deshacer/rehacer durante la sesión, respaldo JSON e importación validada.
- Recuperación desde el respaldo anterior si el archivo principal está dañado. Conserva el original dañado.
- Exportación PNG del mapa visible con leyenda de sus zonas y precios. No descarga mapas adicionales para exportar.
- Configuración de local, localidad, moneda, vista inicial y proveedores compatibles.

## Uso rápido

Consultá [GUIA-DE-USO.md](GUIA-DE-USO.md).

## Desarrollo

Requisitos: Windows x64, Node.js 22.12 o posterior (verificado con Node 24.14.1), npm e Internet para descargar dependencias y los binarios de compilación.

```powershell
npm ci
npm start
```

`npm start` compila la interfaz y abre la aplicación de escritorio. Los datos reales se guardan en la carpeta de datos del usuario.

```powershell
npm run dev
```

Abre un servidor de vista previa en localhost. Esta vista usa almacenamiento de navegador separado; la restauración y exportación PNG requieren la versión de escritorio. No reemplaza el ejecutable.

```powershell
npm test
npm run build
npm run test:desktop
node scripts/check-zone-colors.mjs
node scripts/check-intersections.mjs
node scripts/check-supplemental-streets.mjs
node scripts/check-sector-crausaz.mjs
npm run dist
```

Las pruebas de escritorio usan carpetas nuevas dentro de `.test-data`, direcciones sintéticas en caché y bloquean el mapa externo; no modifican las zonas del comercio ni generan tráfico de teselas automatizado. El resultado se guarda en `.test-data/desktop-result.json`.

La compilación usa Electron y electron-builder con destino NSIS x64. Requiere acceso a npm y a las descargas oficiales de Electron y NSIS. Para firmar futuras distribuciones, configurar un certificado propio según la documentación de electron-builder. No se incluye ninguno.

## Archivos y arquitectura

- `src/`: interfaz en español, Leaflet, Geoman y estilos locales.
- `shared/domain.js`: validación de datos, geometría, precios, clasificación de direcciones e historial.
- `shared/zone-visibility.js`: recorte de los rellenos del mapa sin modificar las zonas originales.
- `shared/intersections.js`: nombres abreviados, alias, intersecciones y desambiguación local de calles.
- `assets/parana-streets.json`: catálogo local de calles y nodos compartidos de Paraná, con fuente, fechas y licencia ODbL.
- `assets/parana-supplemental-streets.json`: complemento Georef / INDEC con calles numeradas faltantes, trazados y cruces; licencia CC BY 4.0. Ver `assets/CALLES-COMPLEMENTARIAS.md`.
- `assets/parana-sector-crausaz.json`: etiquetas y cruces de 12 calles del sector revisado, sin modificar los catálogos anteriores. Ver [procedencia y alcance](assets/SECTOR-CRAUSAZ.md).
- `src/supplemental-map.js`: nombres y trazados adicionales que no alteran las zonas guardadas.
- `shared/geocoder.js`: cliente Nominatim, cola y caché de consultas.
- `desktop/`: ventana Electron, API acotada de IPC, diálogos de archivos, captura PNG y persistencia.
- `tests/`: pruebas de dominio, almacenamiento y servicio de direcciones.
- `scripts/smoke.mjs`: recorrido automatizado de la aplicación real.

El proceso de interfaz no tiene acceso a Node ni al sistema de archivos. Se usan context isolation, sandbox, CSP, navegación bloqueada y una API de escritorio limitada. El proceso principal valida los datos antes de escribirlos. Los archivos JSON se escriben de forma secuencial a un temporal, se sincronizan y se reemplaza el archivo principal; la versión anterior queda en `.bak`.

## Datos locales

Desde la versión 1.0.2 se puede buscar **Grella y Alcorta**, sin altura. El catálogo de intersecciones de Paraná se incluye en la aplicación y funciona sin consultas externas. Los mapas visibles y las consultas nuevas por altura mantienen sus requisitos de conexión. La búsqueda por cruces no está habilitada para otras localidades sin su correspondiente catálogo.

Los nombres admiten omitir nombres de pila, títulos y tildes, o usar prefijos de al menos tres letras. Si varias calles coinciden, se ofrecen las intersecciones posibles. Los cruces proceden de nodos compartidos de OpenStreetMap; no se generan por simples cruces geométricos de dos líneas. La cobertura depende de los datos disponibles en la fecha indicada en el catálogo. Ver `assets/CATALOGO-CALLES.md` para reconstruirlo desde un extracto actualizado.

En Windows, la ubicación habitual es `%APPDATA%/Reparto`. Se puede abrir desde **Respaldos → Abrir carpeta de datos**.

- `zonas.json`: zonas y configuración.
- `zonas.json.bak`: versión guardada anterior.
- `antes-de-importar-*.json`: copia de los datos reemplazados al restaurar un respaldo.
- `zonas-danadas-*.json`: originales preservados durante una recuperación.
- `direcciones-cache.json`: hasta 500 consultas, reutilizables durante siete días. El respaldo exportado no incluye esta caché.

El mapa se almacena en la caché HTTP normal de Chromium respetando los encabezados del proveedor. No se precargan ciudades ni se promete disponibilidad del mapa completo sin conexión. Las zonas pueden editarse sin conexión sobre las partes del mapa que permanezcan visibles; las consultas nuevas necesitan Internet.

## Servicios, cobertura y costos

Se configuraron OpenStreetMap Standard para el mapa y el servidor público de Nominatim para búsquedas moderadas de un único local. No requieren claves ni suscripciones, pero no ofrecen SLA y su acceso puede limitarse. No son una infraestructura garantizada para una distribución masiva o varios locales. Antes de escalar, configurar un proveedor adecuado y revisar sus condiciones y costos. La aplicación permite cambiar ambos endpoints sin actualizar su código.

Nominatim se consulta por acción explícita, con identificación de la aplicación, una cola separada por al menos 1,1 segundos y caché persistente. No se hace geocodificación masiva ni autocompletado remoto. El límite público se aplica a la suma de usuarios de una misma aplicación; una distribución a varias PC requiere una solución centralizada o un proveedor con capacidad adecuada.

Cada consulta envía calle, altura, ciudad, provincia y país al proveedor configurado. No agregues nombres, teléfonos ni notas del cliente al buscador. La configuración no incorpora ningún servicio pago.

Se comprobó una respuesta real para **San Martín 1250, Paraná**: el proveedor devuelve una altura interpolada y también puede devolver coincidencias de otras localidades del departamento. Reparto descarta localidades distintas y exige confirmar las alturas interpoladas. Esta comprobación no demuestra cobertura completa de la ciudad.

El mapa muestra numeración donde está disponible; no agrega números inexistentes ni garantiza el dibujo de cada altura. Los puntos geocodificados pueden representar una parcela o edificio, no necesariamente la puerta. Revisá los casos próximos a un límite.

Referencias oficiales consultadas:

- [Política de uso de Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
- [Búsqueda de Nominatim](https://nominatim.org/release-docs/latest/api/Search/)
- [Formato y direcciones interpoladas](https://nominatim.org/release-docs/latest/api/Output/)
- [Política de teselas de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/)
- [Créditos y licencia de OpenStreetMap](https://www.openstreetmap.org/copyright)
- [Seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security)

## Límites de la primera versión

Un local y un archivo de zonas por perfil de Windows; hasta 100 zonas y 500 vértices por zona. Polígonos simples sin agujeros; no hay sincronización entre equipos, rutas, pedidos ni cuentas. La moneda cambia la presentación de las tarifas, sin conversión de valores. Cambiar la ciudad no traslada las zonas: hay que dibujarlas y guardar la nueva vista inicial.

Los datos importados se validan con las mismas reglas que los creados en pantalla. Las zonas activas superpuestas deben tener prioridades diferentes. Una búsqueda no encontrada o fallida nunca se interpreta como fuera de zona.
