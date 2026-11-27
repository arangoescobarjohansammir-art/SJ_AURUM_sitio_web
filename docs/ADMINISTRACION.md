# Administración de catálogo e inventario

## Alcance de esta entrega

Panel /admin para productos de ejemplo, variantes, precios COP, visibilidad, imágenes locales y ajustes de inventario. Búsqueda por nombre, enlace o SKU y paginación de 20 productos. Una ficha muestra sus últimos 50 cambios con autor, motivo y valores anteriores/nuevos.

No administra todavía clientes, pedidos, cupones, envíos, marketing ni configuración general. No carga archivos a almacenamiento externo. Las imágenes se seleccionan de las siete referencias locales ya incluidas. Los productos siguen siendo demo; el panel no habilita ventas, pagos ni datos comerciales reales.

## Preparación y acceso

1. Mantener PostgreSQL local activo y ejecutar npm run db:deploy para aplicar la migración de administración.
2. Registrar la cuenta deseada en /cuenta y verificar su correo con el enlace de la bandeja local (ver CUENTAS.md).
3. Desde la terminal local del proyecto, asignar explícitamente el rol a esa cuenta:

       npm run admin:role -- grant correo-de-tu-cuenta@example.invalid

4. Iniciar sesión de nuevo. Mi cuenta mostrará Administrar catálogo e inventario.
5. Para retirar el rol:

       npm run admin:role -- revoke correo-de-tu-cuenta@example.invalid

El comando solo admite APP_ENV=development y las bases aurum_dev/aurum_test en 127.0.0.1:55432. Exige una cuenta existente, activa y verificada para asignar ADMIN. No crea contraseñas ni administradores predeterminados. Cada cambio de rol se audita y revoca todas las sesiones de esa cuenta. Las cuentas administrativas usadas en pruebas se revocaron al terminar; no se eligió una cuenta personal del usuario.

No existe una ruta HTTP pública para asignar roles. Los operadores con acceso a la terminal y las credenciales de la base ya pueden cambiar los datos locales; este comando hace esa operación explícita y registrada.

## Uso

Crear un producto exige nombre, enlace único, categoría, descripción, imagen principal incluida en la galería y primera variante con SKU único. Empieza con stock cero; cargar unidades mediante Registrar ajuste con un motivo. Puede guardarse oculto hasta estar listo.

La ficha permite cambiar nombre, descripción, categoría, galería y visibilidad. Cambiar el enlace cambia la URL pública y no crea una redirección. La variante permite editar SKU, etiqueta, precio y estado. Los pedidos conservan los valores con los que fueron creados.

Stock total incluye las unidades reservadas; disponible = total − reservado. El formulario muestra la diferencia propuesta. No se puede reducir el total por debajo de lo reservado, introducir cantidades negativas/fraccionarias o repetir un ajuste idéntico. Las reservas no se alteran desde el panel.

Ocultar producto o desactivar variante conserva pedidos y movimientos. Para desactivar la última variante de un producto visible hay que ocultar primero el producto. No hay borrado irreversible de productos.

## Consistencia y permisos

Todas las lecturas y mutaciones administrativas exigen sesión vigente, cuenta activa, rol ADMIN y correo verificado. Las operaciones vuelven a comprobar permisos dentro de una transacción serializable. Las mutaciones exigen origen de la tienda, JSON válido, límites de tamaño/frecuencia y validación de campos.

Producto y variante tienen versiones independientes. El formulario envía la versión leída; si otra operación ya la cambió, el servidor responde 409 y la interfaz ofrece recargar. Reintentar un ajuste con la versión anterior no genera otro movimiento. Reservas concurrentes y restricciones SQL mantienen total >= reservado >= 0.

Cada mutación exitosa guarda un AdminAudit en la misma transacción. El ajuste agrega además un InventoryMovement de tipo ADJUST con diferencia positiva/negativa. Si falla la operación, ni el cambio ni la auditoría se confirman. La aplicación no ofrece edición/borrado de auditoría; no es un registro criptográfico a prueba de manipulación por el operador de la base.

## Validación

- npm run test:admin: nueve grupos PostgreSQL en aurum_test, incluyendo permisos, verificación, asignación/revocación local, creación, imágenes permitidas, SKU duplicado, ediciones concurrentes, auditoría, stock reservado, precio histórico, ocultamiento y carrera reserva/reducción de última unidad.
- npm run test:admin-http: servidor local activo; verifica las rutas protegidas, origen, validación, creación, stock, conflicto de versión y auditoría. Usa una cuenta ficticia y revoca su rol al terminar.
- Navegador: acceso restringido sin rol; creación de Cadena Aurora de prueba; ajuste de ocho unidades; precio de $95.000 a $99.000; activación, revisión pública y ocultamiento. Historial visible con todos los cambios.
- Panel revisado a 390 y 320 px sin desbordamiento horizontal.

## Desarrollo y límites

npm run dev usa Webpack, soportado por Next.js. Turbopack presentó recargas continuas en este entorno Windows tras operaciones locales; cambiar la ruta de la bandeja no bastó para resolverlo de forma estable. Webpack se verificó durante el recorrido completo. La compilación de producción mantiene el comando next build.

Antes de producción faltan MFA/controles de administración, revisión de seguridad, correo real, almacenamiento de imágenes, retención, respaldo y restauración. La tienda continúa sin despliegue comercial.
