# Fotografías y colecciones

## Uso desde el panel

Entrar con una cuenta ADMIN verificada en `/admin/biblioteca` o elegir Fotografías y colecciones desde Administración.

### Fotografías

1. Escribir una descripción identificable y seleccionar una fotografía JPG, PNG o WebP.
2. Pulsar Subir fotografía. La imagen queda guardada en la biblioteca y puede reutilizarse en varios productos.
3. En Catálogo e inventario, abrir o crear un producto. Buscar la fotografía en la biblioteca y pulsar Añadir a galería.
4. Elegir Usar como principal. Ordenar las vistas con Subir posición/Bajar posición; se admite un máximo de siete imágenes. Quitar de galería no borra el archivo de la biblioteca.
5. Guardar la ficha con un motivo. La portada se usa tanto en el catálogo como al abrir el detalle público.

También se puede subir desde la ficha: si hay espacio, la nueva foto se añade a la selección; si ya hay siete, queda disponible en la biblioteca. La ficha se bloquea durante la carga para evitar guardar antes de que termine. Las siete referencias originales siguen disponibles.

Cada archivo admite hasta 5 MB y 20 megapíxeles. El servidor comprueba los bytes, rechaza SVG/formatos no admitidos/animaciones y recodifica a WebP, hasta 1800 × 1800 px sin ampliar, calidad 85, con orientación corregida y sin metadatos EXIF. No conserva el original. La descripción sirve para encontrar la imagen y no es una especificación comercial del producto.

Las imágenes se guardan como bytes en PostgreSQL, fuera de Git y de la carpeta public. Persisten al reiniciar y deben incluirse en el respaldo de la base. La biblioteca local admite 500 fotografías. Las URL `/media/<uuid>` son públicas y tienen caché larga: cargar solamente imágenes de producto destinadas al catálogo. No almacenar documentos privados. No se implementó eliminación ni revocación de estas URL; retirar una fotografía de una ficha no invalida copias en caché.

### Colecciones

Crear nombre, enlace único, descripción y estado visible/oculto, siempre indicando el motivo. Cambiar el enlace cambia su URL y no crea redirecciones. Las ediciones usan versión para evitar sobrescrituras entre operadores.

Asignar hasta diez colecciones a cada producto desde su ficha. Una colección puede contener muchos productos. La tienda ofrece un filtro Colección combinado con categoría, búsqueda, precio y disponibilidad, y enlaces como `/catalogo?coleccion=clasicos-ejemplo`.

Ocultar una colección elimina su opción pública, pero mantiene las asociaciones y no oculta sus productos del catálogo general. Una URL de colección oculta o inexistente muestra cero resultados. La colección visible sin productos también muestra cero resultados. Recargar la tienda refleja los cambios.

El seed agrega Clásicos de ejemplo con Cadena Cubana y Pulsera Veneciana solo si esa colección no existe; no reemplaza ediciones posteriores. En la revisión visual se creó además Esenciales de ejemplo y Cadena Esencial de ejemplo ($95.000, cinco unidades ficticias), utilizando una fotografía ilustrativa ya incluida en el proyecto.

## Actualización local

Mantener PostgreSQL activo; detener la web antes de actualizar dependencias o compilar:

```powershell
npm ci --include=dev
npm run db:deploy
npm run db:seed
npm run dev
```

`npm ci` genera Prisma. La migración es aditiva: Collection, relación múltiple con productos y MediaAsset. No reinicia precios, existencias, cuentas ni pedidos.

## Reglas y validación

Carga y biblioteca requieren administrador activo y verificado en desarrollo. La subida exige origen de la tienda y multipart; limita cuerpo en streaming y frecuencia (10 intentos/minuto por administrador), antes de procesar imágenes. Un cliente que envíe un cuerpo excesivo recibe rechazo 413 o cierre de conexión del servidor; la interfaz lo evita verificando tamaño antes de enviar. Las otras mutaciones conservan protección JSON, origen y auditoría.

Los productos solo aceptan referencias incorporadas o fotografías existentes en MediaAsset; no aceptan URLs externas ni rutas arbitrarias. Se verifican las colecciones antes de asociarlas. Guardar el producto mantiene el indicador demo y no abre ventas. Cargas, colecciones y asociaciones registran auditoría transaccional. El historial de producto muestra las asociaciones por sus identificadores; la auditoría de cargas/ediciones de colección queda en la base, sin visor independiente en esta entrega.

- `npm run test:catalog-media`: siete grupos PostgreSQL (permisos, formatos/tamaño, EXIF/WebP, colecciones únicas/concurrencia, referencias y persistencia, ocultamiento/auditoría, revocación).
- `npm run test:catalog-media-http`: permisos, origen, multipart/tamaño, carga real, entrega pública, asociación al catálogo y conflicto de versión.
- Regresión: nueve grupos de catálogo/inventario, ocho de comercio y siete pruebas unitarias.
- Navegador: creación de colección, carga desde selector de archivos, elección de portada, asociación de producto, cinco unidades ficticias y precio de $95.000, filtro público y persistencia. Biblioteca a 390 px, selector/catálogo a 320 px sin desbordamiento horizontal. Portada pública corregida y verificada.

## Pendientes comerciales

El usuario confirmó continuar con ejemplos. Sigue pendiente aportar y revisar catálogo real, fotografías propias, precios, existencias y nombres definitivos. Para producción faltan almacenamiento de objetos/CDN dimensionado, políticas de eliminación/retención, respaldos y recuperación probados, controles de acceso de producción y validación bajo carga. Este incremento prepara la administración; no convierte los ejemplos en productos comerciales ni habilita pagos.
