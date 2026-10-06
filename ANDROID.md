# Android

El APK de prueba se genera en GitHub Actions → Android APK → artefacto Control-de-inventarios-Android. Extraer el ZIP y abrir el APK desde Archivos en Android. Autorizar la instalación desde esa aplicación cuando Android lo solicite.

Esta primera entrega usa firma de depuración y es para validación en dispositivo, no para Google Play. Antes de distribuirla para trabajo definitivo debe configurarse una firma de publicación privada y estable. Una firma distinta impide actualizar sobre una instalación previa; exportar siempre el respaldo antes de cualquier reinstalación. La clave de firma nunca debe incorporarse al repositorio.

Los recursos están dentro del APK; no necesita cargar GitHub Pages al arrancar. Inventario y fotografías se guardan en el espacio privado de la aplicación. No se comparten automáticamente con Chrome, la PWA u otro teléfono. Importar el respaldo ZIP de la versión web para trasladar los datos. Desinstalar elimina los datos locales. No hay sincronización en la nube.

Excel, ZIP, JSON y TXT utilizan el selector de documentos de Android para elegir destino. Cancelar no marca un respaldo como guardado. Los reportes usan la impresión de Android, que ofrece Guardar como PDF cuando está disponible. La cámara requiere permiso al utilizarla; los archivos se importan mediante el selector del sistema. El código conserva la versión web.

## Compilación

En Configuración → Respaldo y Recuperación → Importar solo fotos de un ZIP se pueden agregar fotografías tomadas en otra sesión sin reemplazar el inventario ni las notas. Revisa las coincidencias antes de confirmar; las fotos actuales se conservan por defecto y los archivos sin coincidencia segura se omiten. Las claves automáticas CD/ARR de adicionales no bastan para asociar bienes entre equipos: se necesita identidad compartida, serie única o clave manual verificable.

Las fotografías de bienes muestran su clave en el visor y los álbumes. Guardar foto con clave descarga una copia JPEG con la marca incorporada. El almacenamiento y los ZIP conservan los originales para evitar marcas superpuestas al importar o cambiar la clave de un adicional.

Las sugerencias de descripción tienen una × para quitarlas mientras escribes. El texto capturado se conserva. Configuración → Sugerencias de descripciones permite restaurarlas desde Eliminadas; estas preferencias viajan en el respaldo ZIP.

Node 22+, JDK 21 y Android SDK compatibles con Capacitor 8. Ejecutar `npm ci`, `npm run android:prepare` y, dentro de `android`, `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`). `www` y `android` se generan; las modificaciones nativas permanentes viven en `native/android` y `tools/android-prepare.cjs`.

Documentación: https://capacitorjs.com/docs/getting-started/environment-setup

## Validación en teléfono pendiente

Probar instalación, apertura en modo avión, cámara y QR, importación de Excel, captura, cierre y reapertura, guardado/cancelación de ZIP, restauración, PDF y respaldo con muchas fotos. Las pruebas web y una compilación correcta no sustituyen estas verificaciones físicas.
