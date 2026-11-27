# Wompi Sandbox

Integración exclusiva de pruebas. Los productos siguen siendo ejemplos. El código rechaza llaves de producción y APP_ENV distinto de development; COMMERCE_ENABLED no habilita cobros reales.

## Configuración local

Completar en `.env` (ignorado por Git) WOMPI_ENVIRONMENT=sandbox, WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_INTEGRITY_SECRET y WOMPI_EVENTS_SECRET con las llaves de pruebas. `.env.example` debe permanecer sin secretos. Reiniciar el servidor al cambiar variables.

Ejecutar `npm run db:deploy` y `npm run dev` con PostgreSQL local activo. Crear una reserva desde checkout, abrir `/pedidos` y elegir «Probar pago con Wompi». El botón genera una referencia única persistida, total en centavos y firma de integridad con vencimiento; no envía datos personales del destinatario en la URL. Wompi recoge los datos del pagador.

El enlace de datáfono virtual entregado por el propietario no se usa para los carritos: permite escribir un importe libre y no identifica nuestros pedidos.

## Confirmación

El retorno `/pagos/resultado?id=...` consulta desde el servidor la transacción y comprueba referencia, importe, moneda y propietario. Nunca aprueba un pedido a partir de parámetros del navegador.

El receptor es `POST /api/payments/wompi/events`. Verifica checksum con las propiedades indicadas por Wompi, exige un ID firmado y ambiente test, y consulta la transacción en el API Sandbox antes de aplicarla. No almacena el cuerpo con datos personales. Admite eventos repetidos y no retrocede estados finales. Los eventos de otros links del mismo comercio se ignoran tras verificarlos.

Para recibir notificaciones externas, desplegar en un entorno de pruebas accesible mediante HTTPS y configurar en Wompi Sandbox la URL completa `https://<dominio-de-pruebas>/api/payments/wompi/events`. Localhost no es accesible desde Wompi. No exponer el panel de desarrollo mediante un túnel sin preparar y revisar el acceso. Mientras no exista esa URL, la consulta al volver de Wompi permite verificar manualmente el resultado; no hay confirmación externa desatendida.

`npm run payments:reconcile` consulta hasta 100 transacciones conocidas, priorizando las menos recientemente verificadas. No puede descubrir un pago que no llegó por retorno ni webhook. Su programación y monitorización quedan pendientes del entorno de pruebas publicado.

## Inventario y fallos

La aprobación consume stock y reserva una única vez en una transacción serializable, registrando SALE. Rechazo/error libera reserva. Un pago aprobado después del vencimiento o cancelación queda en PAYMENT_REVIEW con incidencia; no consume stock liberado ni autoriza despacho. Se revisa para reembolso. La referencia no se reutiliza para nuevos intentos después de un rechazo: crear un pedido nuevo.

## Reembolsos

El administrador puede solicitar un reembolso TOTAL de pruebas con motivo y confirmación desde el detalle del pedido. La solicitud y auditoría se persisten antes del POST al API V2 de Wompi. Una sola solicitud por pago evita duplicar envíos concurrentes. Si hay timeout, respuesta no válida o fallo del proveedor, queda UNKNOWN y se bloquea otro envío. REQUESTED también puede indicar una interrupción antes de conocer el resultado. Revisar estos casos, PENDING, ERROR y DECLINED en Wompi; no se infiere éxito ni se reintenta automáticamente. No existe todavía conciliación automática del recurso de reembolso ni reembolsos parciales. Solo APPROVED cambia el pedido a REFUNDED; una anulación verificada VOIDED también cierra el pedido. El inventario vendido no se repone automáticamente y el cupón consumido no se restituye automáticamente: requiere decisión comercial y revisión de devolución.

## Validación y límites

`npm test`, `npm run test:payments`, `npm run test:payments-http` y `npm run typecheck`. Las pruebas de integración usan aurum_test y proveedor simulado; nunca llaves reales en fixtures. Verifican firmas, ambiente, importes, propiedad, eventos repetidos, concurrencia, rechazo, pagos tardíos y reembolsos inciertos. La prueba HTTP requiere servidor local con configuración Sandbox.

La consulta al comercio Sandbox respondió 200 e identificó SJ aurum. En navegador se creó una reserva de $157.000, se abrió el checkout con ese importe y referencia, pero Wompi devolvió 403 CloudFront. Se canceló esa reserva para liberar inventario. No se conoce aún la causa del bloqueo externo; no se certificó un pago ni un reembolso contra Wompi. Para certificar el recorrido externo faltan resolver ese acceso, ejecutar una transacción Sandbox, validar su retorno, configurar HTTPS/webhook y comprobar la notificación y reembolso en el proveedor. Producción requiere además autenticación y administración endurecidas, catálogo/políticas reales y revisión comercial.

Documentación oficial: https://docs.wompi.co/docs/colombia/widget-checkout-web/ · https://docs.wompi.co/docs/colombia/eventos/ · https://docs.wompi.co/docs/colombia/reembolsos-sandbox/ · https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/
