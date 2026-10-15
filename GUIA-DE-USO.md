# Reparto · Guía rápida

## Primer inicio

Abrí **Reparto**. El mapa empieza en **Paraná, Entre Ríos**, y los precios están en **pesos argentinos**. El programa se entrega sin zonas ni tarifas de ejemplo: vos definís la cobertura real de tu local.

Entrá al botón de configuración, arriba a la derecha, para escribir el nombre de tu comercio. Podés elegir la vista inicial: mové y acercá el mapa, abrí Configuración y marcá **Usar la vista actual del mapa como vista inicial**.

## Crear tu primera zona

1. Presioná **Nueva zona**.
2. Escribí su nombre y elegí un color y el precio del envío.
3. Hacé clic en las esquinas del área que querés cubrir.
4. Cerrá el contorno tocando el primer punto o **Cerrar contorno**.
5. Presioná **Guardar zona**.

Mientras dibujás, **Quitar último** deshace el último punto. Podés cancelar sin cambiar las zonas guardadas.

## Editar una zona

Seleccioná la zona en la lista o en el mapa y presioná **Editar zona**.

- Cambiá el nombre, color, descripción o precio.
- Arrastrá los puntos del contorno para ajustar sus límites.
- Tocá un punto intermedio de un lado para agregar un vértice.
- Hacé clic derecho sobre un vértice para quitarlo.
- Desactivá la zona si temporalmente no hacés envíos allí.

Guardá los cambios. El programa utilizará la nueva tarifa en las consultas siguientes.

## Consultar el precio de un envío

Escribí **calle y altura** en el buscador, por ejemplo **San Martín 1250**, y presioná Enter o la flecha.

También podés buscar una **intersección sin altura**, por ejemplo **Grella y Alcorta**. No hace falta escribir los nombres completos ni usar tildes: el buscador reconoce los nombres abreviados y muestra los nombres registrados de ambas calles.

Podés escribir `Grella y Alcorta`, `Alcorta y Grella`, `Grella esquina Alcorta`, `Grella esq. Alcorta` o `Grella / Alcorta`. Si hay varias coincidencias, elegí la esquina correcta. Si no encuentra el cruce, podés revisar los nombres o ubicarlo manualmente; eso no significa que esté fuera de cobertura.

Las intersecciones identificadas muestran directamente la zona y el precio. Si movés el marcador, tenés que confirmar la nueva posición. Esta función usa un catálogo local de calles de **Paraná, Entre Ríos**, incluido con la aplicación; el mapa visible sigue necesitando conexión para cargar partes nuevas.

También se incluyen calles numeradas del nomenclador oficial, como **Calle 893** y **Calle 868**. Sus nombres aparecen al acercar el mapa. Podés buscar `893 y 868`, `893 y Balbín` o `868 y Parera` para consultar el cruce. Al buscar solamente `Calle 893` o una altura sin verificar, la aplicación muestra la calle y pide mover y confirmar el marcador en el domicilio. No calcula una tarifa hasta que confirmes el punto.

En el sector de **Pablo Crausaz–Paracao** también se completan nombres que antes estaban en blanco, como **Calle 1666**, **Ángela O. Sors**, **Calle 1853**, **Calle 1855**, **Calle 1165** y **Calle 1663**. Acercá el mapa para verlos. Podés buscar `1666 y Sors`, `Greca y Sors`, `1855 y 1165` o el nombre solo. Si buscás una calle sin domicilio verificado, confirmá el punto de entrega antes de cotizar.

El resultado puede ser:

- **Llegamos a esta dirección:** muestra la zona y su precio.
- **Fuera de zona:** se ubicó el domicilio, pero no pertenece a una zona activa.
- **Ubicación por confirmar:** el mapa devolvió una posición aproximada. Revisá el marcador, arrastralo si hace falta y tocá **Confirmar este punto**. Recién entonces se calcula la tarifa.
- **No encontramos esa dirección:** revisá la escritura o usá **Ubicarla manualmente**. No significa que esté fuera de cobertura.
- **Falta configurar la cobertura:** todavía no hay zonas activas.

Si aparecen varias opciones, elegí la que corresponda. Los datos del mapa pueden ser incompletos: la app identifica las alturas estimadas y no las presenta como exactas.

El botón con una mira, a la derecha del mapa, permite consultar un punto manual. Hacé clic en el lugar y confirmalo. **Copiar resultado** copia la dirección, la zona, el precio y cómo se confirmó la ubicación.

## Zonas que se superponen

Al guardar, la app avisa si la zona se cruza con otra. Podés corregir el contorno o entrar a **Prioridad y superposiciones**.

El número más alto tiene preferencia. Por ejemplo, si “Centro” tiene prioridad 1 y “Promoción” tiene prioridad 2, una dirección dentro de ambas usa “Promoción”. Debés aceptar los cruces antes de guardar.

Los colores no se mezclan: en el área compartida se muestra únicamente el relleno de la zona activa con mayor prioridad. Las calles siguen visibles a través del color. Seleccionar una zona no cambia esa prioridad. Las zonas inactivas quedan visualmente por debajo de las activas.

Durante la edición se muestra el color de la zona que estás ajustando por delante de las demás para que puedas ver su contorno completo. Al guardar o cancelar, el mapa vuelve a aplicar las prioridades. Esto también se respeta al exportar una imagen.

La misma regla se usa en los límites compartidos. Si dos zonas empatan, la aplicación pide corregir las prioridades y no inventa una tarifa.

## Guardar y hacer copias

Las zonas se guardan automáticamente en la PC. La barra inferior indica **Todo guardado en esta PC**. Si muestra un error, hacé clic allí para reintentar antes de cerrar.

En **Respaldos**:

- **Guardar un respaldo** crea un archivo que podés conservar en otra carpeta o equipo.
- **Restaurar un respaldo** revisa el archivo y pide confirmación antes de reemplazar los datos. Conserva una copia de los anteriores.
- **Abrir carpeta de datos** muestra los archivos de la aplicación y las copias automáticas.

Las flechas inferiores permiten deshacer y rehacer durante la sesión. También podés usar **Ctrl+Z** y **Ctrl+Y**. Los cambios en una zona en edición se guardan cuando presionás **Guardar zona**.

## Exportar una imagen

Acomodá el mapa para mostrar las zonas que querés compartir. Tocá el botón de imagen a la derecha y elegí dónde guardar el PNG. La imagen incluye el mapa visible, una leyenda de sus zonas, precios y créditos del mapa.

Esperá a que termine de cargar el mapa antes de exportar. Si hay muchas zonas, acercate a un sector para que la leyenda sea legible.

## Internet y otras consideraciones

El mapa y las búsquedas nuevas por calle y altura necesitan Internet. Las intersecciones de Paraná se buscan en el catálogo local sin enviar la consulta a un servidor. La información de tus zonas queda en la PC aun sin conexión. La aplicación puede reutilizar consultas recientes, pero no incluye un mapa completo sin conexión.

Los proveedores iniciales no requieren claves ni un servicio pago. Están pensados para consultas moderadas; para utilizar la aplicación en varias PC o locales, revisá la configuración de proveedores con quien mantenga el programa.

La búsqueda se envía al proveedor de direcciones. Ingresá únicamente el domicilio; no agregues nombres, teléfonos ni información del cliente.

El instalador de esta primera entrega no tiene firma digital. No desactives las protecciones de Windows para ejecutarlo; si tu equipo bloquea la instalación, consultá con quien administra la PC.
