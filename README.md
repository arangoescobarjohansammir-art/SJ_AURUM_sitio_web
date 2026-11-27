# SJ AURUM

Envíos de ejemplo: cobertura y tarifas en /admin/envios, direcciones guardadas en checkout y seguimiento manual desde pedidos. Guía: [docs/ENVIOS.md](docs/ENVIOS.md).

Tienda de joyería y accesorios de oro laminado para Colombia, desarrollada por fases desde las referencias de Stitch y el logo original.

## Estado

Inicio, catálogo, detalle, favoritos y bolsa responsive. El catálogo y la bolsa consultan PostgreSQL. El checkout genera pedidos de prueba persistidos, calcula precios, cupones y envíos en el servidor y reserva inventario durante 15 minutos. El historial privado del navegador o de la cuenta permite cancelarlos. Mi cuenta incluye registro, acceso, perfil, direcciones, verificación y recuperación mediante bandeja local.

**No es una tienda operativa. No hay cobros ni envíos reales. Las cuentas funcionan solo en desarrollo.** Los productos, tarifas y condiciones son ejemplos autorizados. Alcance y pendientes en docs/ESTADO.md.

## Desarrollo local

Node >=22.12 y npm. Desde esta carpeta:

1. Ejecutar npm ci (genera el cliente Prisma).
2. En una terminal, ejecutar npm run db:local y mantenerla abierta. El primer inicio crea PostgreSQL 17 local, las bases aurum_dev/aurum_test y un archivo .env privado si no existe. Solo escucha en 127.0.0.1:55432. Las credenciales aleatorias y datos quedan en .local/, ignorado por Git. No sustituye un PostgreSQL de producción.
3. En otra terminal: npm run db:deploy y npm run db:seed.
4. Ejecutar npm run dev. Abrir http://127.0.0.1:3000.

El lanzador se ha verificado en Windows. No sobreescribe un .env existente: si se usa una base externa, configurar DATABASE_URL localmente. APP_URL debe coincidir exactamente con el origen visitado, incluido el puerto. No compartir credenciales por chat ni subir .env/.local a Git.

El checkout requiere APP_ENV=development y DEMO_CHECKOUT_ENABLED=true. El lanzador local establece ambos. .env.example lo deja cerrado por defecto. Wompi está integrado exclusivamente para Sandbox: widget oficial en pedidos, verificación desde el servidor, receptor de eventos y reembolso total desde administración. Las llaves de producción se rechazan. El widget abre correctamente; la prueba completa de pago y notificación sigue pendiente. Configuración del receptor restringido con HTTPS, arranque y límites en [docs/PAGOS-WOMPI.md](docs/PAGOS-WOMPI.md). COMMERCE_ENABLED=false mantiene documentado que el comercio real no está habilitado.

El seed solo crea ejemplos ausentes; preserva cambios existentes de precios e inventario. Usar Ctrl+C en ambas terminales al terminar. La carpeta .local conserva los datos para el siguiente inicio.

## Verificación

- npm run typecheck
- npm test
- npm run build
- npm run test:integration (PostgreSQL local activo; migra y usa exclusivamente aurum_test en 127.0.0.1:55432).
- npm run test:http (tienda y PostgreSQL locales activos).
- npm run test:auth (PostgreSQL local activo).
- npm run test:auth-http (servidor local activo).
- npm run test:admin (PostgreSQL local activo).
- npm run test:admin-http (servidor local activo).
- npm run test:admin-orders (PostgreSQL local activo).
- npm run test:admin-orders-http (servidor local activo).
- npm run test:catalog-media (PostgreSQL local activo).
- npm run test:catalog-media-http (servidor local activo).
- npm run test:payments (base local aurum_test y proveedor simulado).
- npm run test:payments-http (servidor local con llaves Sandbox).
- npm audit

Las pruebas de integración agregan registros aislados por identificador, sin borrar datos anteriores. No apuntarlas a producción.

## Pedidos e inventario

Sesión anónima de 30 días mediante cookie HttpOnly/SameSite strict, con token aleatorio guardado como hash. Bolsa persistida por sesión; favoritos locales. La bolsa anterior de localStorage no se importa automáticamente: se conserva intacta y debe seleccionarse de nuevo en esta versión.

El servidor recalcula importes COP, valida disponibilidad, cupón y destino. La revisión incluye una huella de precios; un cambio exige nueva revisión. Las transacciones serializables y restricciones SQL protegen inventario y cupones. La clave de idempotencia evita duplicar un mismo intento; el botón de reintento conserva la clave mientras la pantalla permanece abierta.

Los pedidos tienen estados RESERVED, CANCELLED y EXPIRED; nunca se presentan como pagados. Se registran movimientos de reserva y liberación. Al confirmar se vacía la bolsa. Cancelar o vencer devuelve unidades y cupón una sola vez.

La limpieza de vencidos se ejecuta al consultar catálogo, pedidos o checkout, en lotes de 100. npm run reservations:expire permite ejecutarla manualmente. Antes de producción necesita un proceso periódico operado y monitorizado; no se ha configurado ninguno. Existe un panel limitado a catálogo e inventario de ejemplo; no hay todavía administración de clientes ni política final de retención de sesiones/datos. Las cuentas de desarrollo se describen en docs/CUENTAS.md.

## Marca y referencias

Logo íntegro en public/brand/sj-aurum.png. Fuentes locales Playfair Display y Plus Jakarta Sans. Paleta en src/app/globals.css. Fotos ilustrativas y procedencias en docs/asset-sources.json. Las notas de información no constituyen políticas comerciales vigentes.

## Control de versiones

Repositorio solicitado: https://github.com/arangoescobarjohansammir-art/SJ_aurum_sitio_web.git

Commits por unidad funcional, tras verificar. No se ha desplegado hosting. La fijación transitoria effect@3.22.1 corrige una alerta de Prisma; revisarla al actualizar dependencias.

## Mi cuenta y bandeja local

Abrir /cuenta para registrar datos ficticios. Si .env ya existía, añadir LOCAL_MAIL_DIRECTORY=.local/mail. Para ver el enlace de verificación o recuperación: npm run mail:local -- cliente@example.invalid. Solo prepara mensajes locales; no envía correo real. Ver docs/CUENTAS.md para seguridad, sesiones, asociación de pedidos y límites antes de producción.

## Administración

Panel /admin con rol ADMIN verificado: productos, variantes, precios, fotografías cargadas, colecciones, visibilidad, ajustes de stock y auditoría. Preparación explícita de la cuenta y comandos de rol en docs/ADMINISTRACION.md. No hay administrador ni contraseña predeterminados. El servidor de desarrollo usa Webpack para evitar recargas continuas observadas con Turbopack en este entorno Windows.

El panel de pedidos está en /admin/pedidos: búsqueda, filtros, detalle privado, notas de seguimiento, cancelación de reservas e historial. Uso y límites en docs/PEDIDOS-ADMIN.md.

Biblioteca de fotografías y colecciones en /admin/biblioteca. Permite subir JPG/PNG/WebP, elegir portada, ordenar galería y agrupar productos. Los bytes se guardan en PostgreSQL; ver docs/CATALOGO-MEDIA.md para uso, límites y respaldo. El catálogo definitivo sigue pendiente de tus datos reales.
