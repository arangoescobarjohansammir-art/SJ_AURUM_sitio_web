# Envia.com Sandbox

## Configuración local

En .env: ENVIA_ENVIRONMENT=sandbox y ENVIA_API_TOKEN con el token completo del panel https://shipping-test.envia.com/settings/developers. No usar NEXT_PUBLIC, no copiar credenciales a .env.example ni Git. Las URLs están fijadas en el servidor a https://api-test.envia.com; no hay selector de producción. Reiniciar npm run dev después de cambiar variables si el servidor no las recarga.

## Uso desde pedidos

Abrir /admin/pedidos con una cuenta administradora. En un pedido PAID con pago APPROVED, sin solicitud de reembolso y sin despacho, abrir Envia.com Sandbox → Datos para cotizar. El destinatario se toma de la instantánea del pedido; el administrador completa los códigos del destino, remitente y medidas/peso total. Es un paquete nacional de Colombia, caja, kg/cm. El valor declarado es el valor de productos después de descuento.

Envia requiere código de ciudad de ocho dígitos para Colombia, código de departamento propio y código postal aceptado por su catálogo. No se convierte automáticamente el nombre de ciudad a código. El administrador debe verificar esa correspondencia. Coordinadora es una propuesta inicial, no disponibilidad garantizada; la respuesta de cotización determina los servicios válidos.

Cotizar muestra servicios en COP y conserva la respuesta en el servidor durante diez minutos. Seleccionar un servicio y confirmar Generar guía de prueba. El coste logístico no cambia el total que el cliente ya pagó, y las tarifas del checkout siguen configurándose en /admin/envios. No se ofrece cotización dinámica en el checkout en este incremento.

Una guía confirmada registra transportadora y número, enlace PDF HTTPS del dominio Envia en el panel y evento de preparación visible al cliente. Crear una guía no significa recogida ni tránsito. Consultar seguimiento obtiene el estado del proveedor y lo muestra al propietario; los estados logísticos internos se actualizan manualmente. No se configuran webhooks, recogidas ni cancelación de guías en este incremento.

## Duplicados y fallos

La solicitud se registra antes de contactar al proveedor. Un segundo intento queda bloqueado incluso si el proceso se interrumpe. GENERATING o UNKNOWN exige verificar el panel de Envia y conciliación asistida; no existe botón para repetir o borrar una solicitud ambigua. También bloquea cambios manuales del envío y reembolsos mientras se revisa. CREATED conserva la guía ante futuras ediciones. No almacenar tokens ni respuestas completas del proveedor en auditoría.

## Verificación

npm run test:envia verifica el flujo contra proveedor simulado y aurum_test: autorización, pago, producción bloqueada, códigos, cotización persistida, selección, concurrencia, privacidad y resultados ambiguos. npm test incluye validación de monedas, URLs y errores sin secretos. Verificados: compilación de producción, 12 pruebas unitarias, 7 grupos Envia con proveedor simulado, regresiones de envíos (6) y pagos (7), y rutas HTTP protegidas. Pruebas simuladas no certifican conexión externa ni una guía real Sandbox.

Prueba externa inicial: /ship/rate/ respondió 401; la API queries.test.envia.com respondió 503 Application Error. No se generó una guía externa. Pendiente validar el token y la disponibilidad de Envia Sandbox.

## Referencias oficiales

- https://docs.envia.com/docs/authentication
- https://docs.envia.com/reference/shipping-rates
- https://docs.envia.com/reference/create-shipping-label
- https://docs.envia.com/reference/track-shipments
