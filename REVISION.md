# Revisión de Control de inventarios — 18 de septiembre de 2026

## Cambios aplicados

- Nombre unificado en inicio, encabezado, pestaña del navegador, actualización y aplicación instalable.
- Eliminados «Modo Tableta» y la etiqueta duplicada del auditor. Se conservan Ubicado por, Auxiliado por e Intercambiar.
- Los diálogos cerrados ya no se ofrecen al teclado ni a las tecnologías de asistencia.
- Duplicar un adicional conserva automáticamente el borrador y elimina advertencias de serie de la captura anterior.
- Eliminado el registro redundante del service worker; su administración queda en el módulo de plataforma.
- Las actualizaciones recargan los recursos desde la red para no reutilizar archivos antiguos de la caché HTTP. El identificador de caché también cambia al modificar el generador del service worker.
- Se conservan las claves de almacenamiento y la URL para mantener acceso a los datos existentes.

## Verificación realizada

Build correcto. 28 pruebas unitarias correctas, una omitida porque requiere cuatro archivos originales que no se distribuyen en el repositorio.

Pruebas de navegador con Edge/Playwright, datos sintéticos y perfil aislado; escritorio de 1440 × 1000 y móvil de 390 × 844. Sin errores de consola durante los flujos probados.

| Flujo | Resultado |
| --- | --- |
| Número de empleado, confirmación, rechazo de pareja duplicada e intercambio | Correcto |
| Captura individual, masiva y reetiquetado; preservación de autoría | Correcto |
| Adicionales, duplicación y recuperación de borrador al recargar | Correcto |
| Quitar asignación y deshacer | Correcto |
| Importación XLSX y reimportación sin duplicar bienes | Correcto |
| Excel con nombres de auditores y sin columnas de empleado | Correcto |
| Guardar notas | Correcto |
| Vista previa de resguardo, pendientes y adicionales | Correcto |
| ZIP con imagen, inspección y restauración de contenido | Correcto |
| Rechazo de ZIP corrupto sin cambiar el inventario | Correcto |
| Importación de tags en worker, guardado y consulta RFID | Correcto |
| Cambio de pareja, recarga y apertura sin conexión | Correcto |
| Edición de ubicaciones, transferencia y conciliación de datos | Cubiertas por pruebas unitarias; sin recorrido completo de todas sus pantallas |

No se verificaron cámara física, lector RFID físico, impresora, instalación PWA en teléfono real ni grandes volúmenes de datos. Las imágenes del respaldo fueron sintéticas; no representan una prueba del dispositivo de captura. Estas pruebas no garantizan la ausencia de fallos fuera de los casos ejercitados.

## Mejoras implementadas — 21 de septiembre de 2026

- Una sola pestaña puede abrir el espacio de trabajo. Las demás esperan; al cerrar la primera, la siguiente carga los datos recientes. Requiere un navegador con Web Locks y protege pestañas del mismo origen y perfil.
- Restaurar ZIP presenta cantidades actuales y entrantes, permite cancelar y guarda un punto previo en la misma transacción que reemplaza los datos. Una escritura fallida revierte toda la transacción.
- El catálogo de auditores se migra al almacenamiento del inventario y viaja en los ZIP nuevos. Los ZIP antiguos conservan los catálogos ausentes.
- Los nuevos puntos de recuperación incluyen directorio y RFID, además de inventario, fotos y borradores.
- Detalles del bien con serie en una fila completa y acciones siempre visibles; captura y edición de adicionales con espacios y controles ampliados; restauración con resumen comparativo. Se mantiene la paleta y los componentes de la aplicación existente.

Validación: 29 pruebas unitarias correctas y una omitida por archivos originales ausentes. Edge/Playwright en 1440 × 1000 y 390 × 844: bloqueo entre pestañas, apertura tras cierre, cancelación, restauración, recuperación, fallo de escritura simulado sin pérdida, ZIP antiguo y catálogo inválido. Sin errores de consola. Se revisaron distribución, tipografía, contraste, botones visibles y adaptación móvil. También pasó la regresión de captura, Excel, reportes, notas y RFID.

Pendiente: pruebas con archivos anonimizados reales y cámara, lector e impresora físicos. La protección entre pestañas requiere actualizar todas las ventanas antiguas; no sincroniza equipos ni perfiles de navegador distintos.

## Búsqueda y limpieza — versión 1.2.0

- Notas: búsqueda en vivo por texto, clave, descripción, usuario y serie; tolera acentos y mayúsculas. Activas y archivadas se filtran por separado. Seleccionar e imprimir se limitan a las coincidencias de todas las páginas.
- Reportes: opciones por tipo, área y resguardante conforme se escribe; selección abre la vista previa con los filtros correspondientes. Se muestran hasta 40 opciones para mantener la lista manejable. No es un archivo histórico de PDF; busca los reportes generables con los datos actuales.
- Limpieza: retiradas funciones antiguas getTipoBien/getProcedencia y variables sin uso de revisión y reportes. La búsqueda se centraliza en un módulo probado. Se conserva la compatibilidad del formato de datos.
- Auditoría: sintaxis de todos los módulos propios, referencias a recursos, IDs HTML duplicados y búsqueda de restos de autenticación y depuración. Las cuatro referencias a datalist se crean dinámicamente y son válidas. No se modificaron librerías de terceros.
- Pruebas: 31 unitarias correctas, una omitida por ausencia de archivos originales. Regresión de navegador y nuevas búsquedas correctas en Edge, escritorio 1440 × 1000 y móvil 390 × 844, sin errores de consola. La revisión no garantiza ausencia de fallos en combinaciones no probadas ni reemplaza pruebas con equipos físicos.

## Auditor individual y regreso — versión 1.2.1

Compañero opcional: dejar vacío o pulsar Sin compañero. Los nuevos registros y Excel conservan Auxiliado por vacío; el intercambio se oculta. Cambiar pareja abre la selección con los auditores actuales y Regresar vuelve a la misma pestaña sin aplicar ediciones ni recargar. Se verifica sesión individual tras recarga, captura, regreso con cambios descartados, vuelta a pareja e intercambio. 32 pruebas unitarias correctas, una omitida por archivos externos ausentes; regresión de navegador sin errores.

## Paleta institucional y experiencia de uso — versión 1.3.0

- Paleta de las referencias del usuario: verde #03564B, verde oscuro #033E3C, verde #006847, cobre #C48D5C y #A35C2B, crema #FFF7D2 y vino #721738. Rojo reservado para errores y acciones destructivas. Tokens centralizados en styles/theme.css y utilidades generadas con Tailwind.
- Cabecera compacta, indicadores en una sola franja y progreso de verificación. Navegación verde con pestaña activa diferenciada; buscador y carga de Excel en una barra independiente.
- Filtros con etiquetas visibles y acciones de inventario con texto. Formularios, ventanas y selección de auditores comparten tipografía, bordes, colores y foco de teclado.
- En móvil la cabecera deja de ocupar permanentemente la pantalla; las pestañas se desplazan hasta la activa y la tabla conserva columnas legibles mediante desplazamiento horizontal dentro de su contenedor.
- El concepto visual se implementó conservando el logotipo institucional original, las columnas reales del inventario y los controles existentes. Las imágenes y los datos del concepto eran ilustrativos. Los formatos oficiales de impresión y las claves del almacenamiento se conservan.
- Validación: build correcto, 32 pruebas unitarias correctas y una omitida por archivos externos ausentes. Edge/Playwright: seis apartados en 1536×1024 y 390×844, detalle del bien, selección de auditores, captura individual/en pareja, búsquedas, notas, reportes, Excel, RFID, funcionamiento sin conexión, restauración y recuperación atómica. Sin errores de consola en los recorridos. Revisión visual del concepto frente a las pantallas finales, sin desbordamiento de página en móvil. Cámara, lector e impresora físicos siguen fuera de esta validación.
