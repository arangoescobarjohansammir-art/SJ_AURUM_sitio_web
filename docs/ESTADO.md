# Estado de desarrollo — administración de catálogo e inventario

## Incremento más reciente: correos con Resend

Verificación y recuperación enviables por Resend; avisos de pedidos, pagos, reembolsos y envíos con cola persistente y reintentos idempotentes. Primer correo real aceptado por el proveedor y recepción confirmada por el usuario. Solo su correo habilitado, sin dominio propio ni habilitación comercial. Worker separado; ver CORREOS.md.

## Incremento anterior: Envia.com Sandbox

Integración administrativa para cotizar paquetes nacionales, elegir servicio, solicitar una guía de prueba una sola vez y consultar su estado. Credenciales solo en .env; producción bloqueada. Mantiene las tarifas manuales del checkout. Primer intento externo devolvió 401 en cotización y 503 en consultas; guía externa aún sin verificar. Ver ENVIA-SANDBOX.md.

## Incremento anterior: envíos de ejemplo

27 de noviembre de 2026. Panel de cobertura, tarifas, transportadora y plazos; direcciones guardadas con comprobación de propiedad/cobertura; instantánea de dirección y tarifa al comprar; seguimiento manual con guía e historial visible al propietario. Solo pedidos con pago aprobado, sin reembolsos solicitados. No hay integración con transportadora real. Detalles: ENVIOS.md. Verificación: TypeScript, compilación, 10 pruebas unitarias, 6 grupos de envíos, controles HTTP y regresiones de pedidos (7), pagos (7) y comercio (8) aprobados.

## Incremento anterior: Wompi Sandbox

Actualización: el widget oficial con postMessage abre correctamente en navegador, muestra SJ aurum y el importe de prueba, y evita el recorrido /p/ que devolvía 403. Receptor restringido a eventos y túnel ngrok HTTPS activos; el usuario confirmó guardar la URL en Wompi Sandbox. Diez pruebas unitarias/receptor, siete grupos de pagos y TypeScript aprobados. Pendiente completar el pago Sandbox y verificar la entrega real del webhook; no equivale a comercio en producción.

Inicio de checkout con referencia y firma, receptor de eventos verificados y consulta al API, estados de pagos, protección de inventario frente a duplicados/pagos tardíos y solicitud de reembolso total auditada desde el panel. Solo pruebas, producción bloqueada. Nueve pruebas unitarias, siete grupos de pagos con proveedor simulado, regresión de comercio/pedidos y protección HTTP verificadas. La llave pública responde 200 para SJ aurum; el checkout externo devolvió 403 CloudFront durante la revisión en navegador. No se certifica aún un pago o reembolso externo completo. Falta HTTPS y configurar/probar webhook externo. Detalles y límites en PAGOS-WOMPI.md. Los apartados siguientes describen los incrementos anteriores.

26 de noviembre de 2026, Colombia. Entrega incremental; no certifica el alcance final completo.

## Implementado

- Fases 0–1: auditoría de 14 HTML, 15 imágenes y guía de Stitch; identidad, arquitectura y proyecto Next.js/TypeScript.
- Fase 2: inicio editorial, catálogo responsive con búsqueda/filtros/orden, detalle con galería y variantes, favoritos, bolsa y notas informativas.
- Primera unidad de fase 3: PostgreSQL 17 de desarrollo, Prisma 7, migración SQL, seed protegido de ejemplos, catálogo y precios del servidor, bolsa persistida, tarifas por destino y cupón limitado.
- Checkout de prueba con datos ficticios precargados, revisión de importe, consentimiento de demostración y reserva persistida durante 15 minutos.
- Historial de sesión, cancelación y vencimiento, devolución de inventario y cupón con movimientos auditables. Idempotencia y transacciones serializables.
- Cookie HttpOnly, hash del token en base, verificación de origen, validación Zod, límite de cuerpo y límites de frecuencia. Datos de destinatario no expuestos en la API de historial.

## Verificación

- TypeScript, siete pruebas unitarias y compilación de producción correctos.
- Ocho pruebas PostgreSQL: precios servidor y cantidades inválidas; concurrencia sobre última unidad; reintento idempotente; autorización y cancelación; cambio de precio; cupón de último uso y expiración; restricción SQL de stock; cierre del checkout fuera de desarrollo.
- Pruebas HTTP: sesión obligatoria, origen externo rechazado, atributos de cookie, entrada inválida, cuerpo excesivo y aislamiento del historial.
- Navegador: añadir una Cadena Cubana, revisar bolsa, elegir Bogotá, aplicar EJEMPLO10, revisar $145.000 − $14.500 + $12.000 = $142.500, confirmar, recargar historial y cancelar. La bolsa quedó vacía tras crear el pedido.
- Resumen de checkout a 390 px y pedidos a 320 px sin desbordamiento horizontal; consola final sin errores ni advertencias.
- Se conserva la validación previa de catálogo, favoritos, variantes agotadas y bolsa a tamaños móvil/tableta/escritorio.

## Límites

Solo ejemplos; no compras, pagos, despachos, correos ni garantías comerciales. El visitante accede mediante cookie; al iniciar sesión se trasladan su bolsa y pedidos a la cuenta. Las cuentas solo se habilitan en desarrollo. Verificación y recuperación usan una bandeja local sin enviar correo. Los favoritos siguen en localStorage. La bolsa del prototipo anterior no se migra automáticamente.

Los vencimientos se procesan bajo demanda o con reservations:expire; falta programar y monitorizar el proceso para producción. No hay aún política de retención, limpieza de sesiones, protección perimetral ni auditoría de seguridad completa. La base local y sus credenciales no se versionan.

## Pendiente

1. Completar fase 2: novedades/popularidad respaldadas por datos y newsletter con consentimiento.
2. Completar fase 3 con configuración comercial real y futura transición a pagos. La reserva de demostración no sustituye una venta.
3. Completar fase 4 para producción: correo transaccional, endurecimiento y revisión de autenticación, controles administrativos, consentimiento/retención y revisión de direcciones para producción.
4. Fase 5: proveedor de pagos confirmado, webhooks verificados, conciliación, reembolsos, correo y transporte.
5. Fase 6: certificados, condiciones versionadas y fidelización.
6. Completar fase 7: almacenamiento de imágenes de producción, clientes, cupones, marketing y configuración; gestión logística/comercial de pedidos cuando existan pagos. Catálogo, variantes y ajustes de inventario ya disponen de panel protegido.
7. Fase 8: ampliar pruebas de seguridad, accesibilidad, rendimiento y dispositivos.
8. Fase 9: hosting, dominio, HTTPS, datos/políticas aprobados, copias/restauración, monitoreo y compra validada.

## Archivos

- prisma/: esquema, migración con restricciones y seed.
- src/modules/commerce/: reglas de pedidos e inventario y validadores.
- src/lib/http.ts: sesión y protección HTTP.
- src/app/api/: catálogo, bolsa, cotización y pedidos.
- src/app/checkout/ y src/app/pedidos/: experiencia de prueba.
- scripts/: PostgreSQL local, integración, pruebas HTTP y liberación de vencidos.

Identidad y cuentas de desarrollo implementadas; detalles y límites en CUENTAS.md. Panel de catálogo e inventario implementado; detalles en ADMINISTRACION.md. La gestión administrativa de pedidos de ejemplo ya está disponible; los pagos siguen cerrados hasta definir proveedor. La publicación comercial sigue pendiente.

## Incremento de cuentas

Registro, acceso y logout; perfil editable; cinco direcciones privadas; roles protegidos; verificación y recuperación de un uso; sesiones revocadas tras recuperación; bolsa e historial asociados a cuenta con migración transaccional del visitante. Ocho grupos de integración de cuentas y recorrido HTTP aprobados. Navegador: registro, login, perfil, dirección persistida y logout, sin desbordamiento a 320 px. El ajuste inicial de la bandeja no eliminó de forma estable las recargas de Turbopack; esta entrega cambia el desarrollo a Webpack y valida el recorrido sin ese bucle. No hay envío real de correo ni cuenta comercial habilitada.

## Incremento de administración

Panel protegido, creación/edición de productos y variantes, precio COP, galería de referencias locales, publicación/ocultamiento y búsqueda paginada. Ajustes de stock con motivo, autor e historial; versiones para evitar sobrescrituras; protección de reservas y movimientos transaccionales. Nueve grupos de integración y recorrido HTTP de administración. Revisión visual completa en escritorio y móvil; pieza de prueba ocultada y rol de la cuenta ficticia revocado al terminar. No se ha designado un administrador personal ni habilitado comercio.

## Incremento de pedidos administrativos

Listado paginado, búsqueda por número/nombre/correo, filtros por reserva y seguimiento, detalle privado con importes históricos, notas internas auditadas y cancelación transaccional. Siete grupos de pruebas PostgreSQL y recorrido HTTP aprobados; revisión visual de notas persistidas, cancelación y diseño móvil. Detalles en PEDIDOS-ADMIN.md. No hay cobros, despachos ni correos reales.

## Incremento de fotografías y colecciones

Biblioteca persistente en PostgreSQL, carga JPG/PNG/WebP con validación y optimización, portada, galería ordenable, colecciones múltiples editables y filtro público. Se conserva modo demo por decisión del usuario; datos definitivos pendientes. Siete grupos de integración nuevos y recorrido HTTP; regresión de inventario/comercio y revisión visual móvil/escritorio. Ver CATALOGO-MEDIA.md.
