# Wompi Sandbox

Integración exclusiva de pruebas. Los productos siguen siendo ejemplos. El código rechaza llaves de producción y APP_ENV distinto de development; COMMERCE_ENABLED no habilita cobros reales.

## Configuración local

Completar en `.env` (ignorado por Git) WOMPI_ENVIRONMENT=sandbox, WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_INTEGRITY_SECRET y WOMPI_EVENTS_SECRET con las llaves de pruebas. `.env.example` debe permanecer sin secretos. Reiniciar el servidor al cambiar variables.

Ejecutar `npm run db:deploy` y `npm run dev` con PostgreSQL local activo. Crear una reserva desde checkout, abrir `/pedidos` y elegir «Probar pago con Wompi». El botón abre el widget oficial con transporte postMessage, referencia única persistida, total en centavos y firma de integridad con vencimiento. No envía datos personales del destinatario en la URL. Wompi recoge los datos del pagador. El callback solo aporta el identificador: el servidor consulta el estado real antes de actualizar el pedido.

El enlace de datáfono virtual entregado por el propietario no se usa para los carritos: permite escribir un importe libre y no identifica nuestros pedidos.

## Confirmación

El retorno `/pagos/resultado?id=...` consulta desde el servidor la transacción y comprueba referencia, importe, moneda y propietario. Nunca aprueba un pedido a partir de parámetros del navegador.

El receptor es `POST /api/payments/wompi/events`. Verifica checksum con las propiedades indicadas por Wompi, exige un ID firmado y ambiente test, y consulta la transacción en el API Sandbox antes de aplicarla. No almacena el cuerpo con datos personales. Admite eventos repetidos y no retrocede estados finales. Los eventos de otros links del mismo comercio se ignoran tras verificarlos.

Para pruebas locales se añadió un receptor restringido y un túnel HTTPS. Mantener PostgreSQL y la tienda activos en 127.0.0.1:3000. En dos terminales adicionales ejecutar, desde el proyecto:

1. `npm run webhooks:local` — receptor en 127.0.0.1:3001.
2. `npm run webhooks:https` — requiere ngrok instalado y configurado; desactiva la inspección local de cuerpos.

Copiar el dominio HTTPS anunciado por ngrok y añadir `/api/payments/wompi/events`; guardar esa URL en Wompi Sandbox. No cambiar APP_URL: la tienda continúa en http://127.0.0.1:3000. No lanzar túneles contra el puerto 3000. El receptor solo reenvía POST JSON de hasta 16 KiB a la ruta de eventos; rechaza las demás rutas, no reenvía cookies y limita concurrencia/frecuencia. El servidor sigue verificando firma, ambiente y transacción. Los límites pueden provocar reintentos del proveedor durante ráfagas; no es infraestructura de producción.

El usuario confirmó haber guardado la URL HTTPS. Se verificó acceso externo al receptor (400 ante un cuerpo vacío inválido) y 404 para /admin. No confundir esto con una notificación real aprobada: falta completar la transacción Sandbox y observar respuesta 200 del evento firmado. Mantener PC y procesos activos; si ngrok anuncia otro dominio al reiniciar, actualizar la URL en Wompi. Ctrl+C detiene cada proceso. HTTPS usa la cuenta local de ngrok; su servicio transporta los eventos de pruebas. Para producción se necesita hosting estable y revisión de seguridad.

`npm run payments:reconcile` consulta hasta 100 transacciones conocidas, priorizando las menos recientemente verificadas. No puede descubrir un pago que no llegó por retorno ni webhook. Su programación y monitorización quedan pendientes del entorno de pruebas publicado.

## Inventario y fallos

La aprobación consume stock y reserva una única vez en una transacción serializable, registrando SALE. Rechazo/error libera reserva. Un pago aprobado después del vencimiento o cancelación queda en PAYMENT_REVIEW con incidencia; no consume stock liberado ni autoriza despacho. Se revisa para reembolso. La referencia no se reutiliza para nuevos intentos después de un rechazo: crear un pedido nuevo.

## Reembolsos

El administrador puede solicitar un reembolso TOTAL de pruebas con motivo y confirmación desde el detalle del pedido. La solicitud y auditoría se persisten antes del POST al API V2 de Wompi. Una sola solicitud por pago evita duplicar envíos concurrentes. Si hay timeout, respuesta no válida o fallo del proveedor, queda UNKNOWN y se bloquea otro envío. REQUESTED también puede indicar una interrupción antes de conocer el resultado. Revisar estos casos, PENDING, ERROR y DECLINED en Wompi; no se infiere éxito ni se reintenta automáticamente. No existe todavía conciliación automática del recurso de reembolso ni reembolsos parciales. Solo APPROVED cambia el pedido a REFUNDED; una anulación verificada VOIDED también cierra el pedido. El inventario vendido no se repone automáticamente y el cupón consumido no se restituye automáticamente: requiere decisión comercial y revisión de devolución.

## Validación y límites

`npm test`, `npm run test:payments`, `npm run test:payments-http` y `npm run typecheck`. Las pruebas de integración usan aurum_test y proveedor simulado; nunca llaves reales en fixtures. Verifican firmas, ambiente, importes, propiedad, eventos repetidos, concurrencia, rechazo, pagos tardíos y reembolsos inciertos. La prueba HTTP requiere servidor local con configuración Sandbox.

La consulta al comercio Sandbox respondió 200 e identificó SJ aurum. El checkout por redirección /p/ devolvía 403 CloudFront. Se sustituyó en la interfaz por el widget oficial con bootstrapTransport=postmessage: verificado en navegador, abre Modo de pruebas, SJ aurum y $157.000 sin bloqueo. No se atribuye una causa específica al 403 original. Diez pruebas unitarias/receptor y siete grupos de pagos con proveedor simulado aprobados; TypeScript correcto. La URL HTTPS es accesible. Falta completar y observar una transacción Sandbox y su webhook firmado, además de certificar un reembolso externo. Producción requiere autenticación y administración endurecidas, catálogo/políticas reales y revisión comercial.

Documentación oficial: https://docs.wompi.co/docs/colombia/widget-checkout-web/ · https://docs.wompi.co/docs/colombia/eventos/ · https://docs.wompi.co/docs/colombia/reembolsos-sandbox/ · https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/
