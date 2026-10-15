# Verificación de Reparto 1.0.5

## Alcance

Se amplía Ayuda con una explicación desplegable de las prioridades, un ejemplo con dos tarifas, los pasos para editarlas y el comportamiento ante empates y zonas inactivas. Se agrega el contacto jordangreck@gmail.com, con enlace para abrir la aplicación de correo y botón para copiar la dirección. La guía de uso incorpora el mismo contenido.

El permiso de apertura externa agregado se limita exactamente a mailto:jordangreck@gmail.com. Las reglas existentes para enlaces del mapa se conservan. La aplicación informa cómo copiar el email si no se puede abrir un cliente de correo.

## Verificación realizada

- Compilación de la interfaz e instalador NSIS x64 1.0.5 completadas correctamente.
- Las 68 pruebas de lógica existentes pasaron, incluyendo zonas, prioridades, colores, direcciones, intersecciones, calles complementarias, almacenamiento y recuperación.
- Revisión visual de Ayuda, explicación desplegada y contacto, tanto en la ventana normal como en el tamaño mínimo de 1050 × 740. Sin desbordamiento horizontal.
- Comprobación interactiva del enlace: solicita abrir exactamente mailto:jordangreck@gmail.com. Se interceptó la apertura externa durante la revisión para no abrir un cliente real ni enviar mensajes.
- Comprobación de Copiar email y su aviso de éxito. Se interceptó la escritura para conservar el portapapeles del usuario.
- Comprobación de alternativas ante errores al abrir el correo o copiar la dirección.
- Cierre y reapertura de Ayuda sin duplicar controles ni producir errores de interfaz.
- Las mismas comprobaciones de Ayuda y contacto pasaron en el ejecutable empaquetado 1.0.5.
- La revisión usó una copia aislada de las tres zonas guardadas. Esa copia conservó exactamente las zonas y la configuración, y el archivo real del usuario sigue idéntico al respaldo tomado al comenzar esta tarea.
- Se compararon con 1.0.4 los catálogos de calles, el buscador, la lógica de zonas y los rellenos: sus archivos permanecen idénticos.
- Se verificó que el ejecutable empaquetado incluye la versión 1.0.5, el nuevo contacto, la guía y los mismos catálogos y lógica probados.

Las 39 comprobaciones amplias de escritorio documentadas en 1.0.4 no se repitieron en esta actualización de Ayuda. No se cambió el cálculo de tarifas ni las funciones de mapa, búsqueda o almacenamiento. No se agregaron pruebas permanentes que simplemente repliquen el contenido de Ayuda.

## Actualización

Cerrar Reparto e instalar Reparto-Instalador-1.0.5.exe con el mismo usuario de Windows. Los datos del local se conservan. El instalador no se ejecutó sobre el perfil real del usuario.

El enlace de email depende del cliente de correo configurado en Windows; Copiar email permite usar un correo web u otra aplicación. El envío lo realiza la persona desde su correo. Windows 10/11 de 64 bits. El instalador no tiene certificado de firma digital.
