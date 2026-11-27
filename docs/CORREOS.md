# Correos de SJ AURUM

## Proveedor y estado

Resend integrado y comprobado con un correo real de prueba: el proveedor aceptó el envío y el usuario confirmó recepción en su bandeja. No hay dominio propio todavía. El remitente de prueba es SJ AURUM <onboarding@resend.dev>; Resend permite usarlo para escribir al correo asociado a su cuenta. MAIL_ALLOWED_RECIPIENTS limita explícitamente los destinatarios y nunca redirige enlaces de otras cuentas. Producción sigue cerrada.

Configuración exclusivamente en .env: MAIL_PROVIDER=resend, RESEND_API_KEY, MAIL_FROM y MAIL_ALLOWED_RECIPIENTS (lista separada por comas). La clave no se versiona ni se muestra al navegador. MAIL_PROVIDER=local conserva la bandeja de archivos. No se necesitan SMTP_HOST ni SMTP_PASSWORD con Resend.

## Qué se envía

- Verificación de cuenta y recuperación: correo directo al destinatario habilitado. Enlace de un uso, 30 minutos, token en fragmento y hash en base. El fallo del proveedor se registra sin mostrar cuentas existentes o tokens. Solicitar un nuevo enlace si no llega; no hay reintento automático de estos mensajes.
- Pedidos nuevos, cancelados o vencidos; cambios de pago y reembolso; eventos manuales de envío y guía de Envia: aviso persistido en la misma transacción del cambio de negocio. El correo contiene número, estado y acceso a pedidos; no incluye dirección completa ni notas administrativas.

No se envían mensajes retroactivos de pedidos anteriores a la integración. Los avisos pendientes conservan el canal, remitente y contenido con que se crearon: activar Resend no envía por Internet una cola local anterior.

## Procesamiento de avisos

Mantener otra terminal abierta en el proyecto con:

    npm run mail:watch

Consulta la cola cada diez segundos, hasta veinte mensajes por lote. npm run mail:worker procesa un lote y sale. Consultar estados y errores sin destinatarios ni contenido con npm run mail:status.

Reintentos limitados para errores temporales, 429 y respuestas ambiguas. Se conserva la misma clave de idempotencia y el mismo contenido, hasta cinco intentos y nunca después de 23 horas desde el primero. Resend conserva idempotencia durante 24 horas. Un mensaje SENT significa aceptado por el proveedor; no certifica recepción, lectura o ausencia de rebote. No hay webhooks de entrega/rebote en este incremento. Los fallos permanentes requieren revisar configuración y panel de Resend; no se repiten automáticamente. Una pausa del proceso puede retrasar avisos hasta que vuelva a ejecutarse.

## Enlaces de prueba

MAIL_APP_URL permite configurar el origen de los enlaces; si está vacío usa APP_URL. Actualmente apuntan a http://127.0.0.1:3000: abrirlos en el mismo PC donde corre la tienda. El túnel existente de Wompi solo recibe webhooks y no sirve páginas de cuenta. Para otros equipos se requiere publicar la tienda con HTTPS. Los enlaces de recuperación y verificación no se deben compartir.

## Cómo probar

1. En /cuenta registra tu correo habilitado o solicita verificación/recuperación para una cuenta existente.
2. Abre el enlace recibido en el mismo PC y completa la acción. Un enlace ya usado o vencido no funciona.
3. Crea un pedido de ejemplo usando tu correo habilitado como destinatario. Mantén activo mail:worker; debe llegar el aviso.
4. Los pagos siguen siendo Sandbox y los envíos, de prueba. Los correos sí son reales cuando el proveedor es Resend.

npm run mail:test -- tu-correo envía una comprobación sin crear cuentas ni pedidos. No usar direcciones de terceros durante estas pruebas.

## Verificación técnica

npm run test:mail: cinco grupos PostgreSQL con proveedor simulado (atomicidad, duplicados, concurrencia, reintentos e idempotencia, errores y destinatarios). npm run test:mail-auth: verificación, recuperación, cambio de contraseña y enlaces de un solo uso con correo simulado. npm test incluye escape HTML y validación de URL. También se ejecutan regresiones de cuentas, pagos, envíos, Envia y comercio.

## Antes de producción

Verificar un dominio remitente en Resend y sus registros DNS; desplegar el sitio HTTPS y el trabajador como servicio supervisado; definir destinatarios comerciales, retención de mensajes/datos, monitorización y webhooks de entrega/rebote. No se ha hecho ese despliegue.

Documentación: https://resend.com/docs/api-reference/emails/send-email y https://resend.com/docs/dashboard/emails/idempotency-keys
