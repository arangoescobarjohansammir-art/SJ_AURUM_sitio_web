# Envíoclick Colombia: pruebas temporales

La integración conserva Envia.com. El proveedor activo se elige en el archivo local .env:

```dotenv
SHIPPING_PROVIDER=envioclick
ENVIOCLICK_ENVIRONMENT=sandbox
ENVIOCLICK_API_KEY=
```

La clave solo va en .env, que está excluido de Git. Reinicia el servidor tras cambiar la configuración.

## Probar desde el panel

1. Abre Administración → Pedidos y elige un pedido de ejemplo pagado, con pago aprobado y sin solicitud de reembolso.
2. Abre «Datos para cotizar el envío». Completa remitente ficticio, códigos DANE de 8 dígitos, barrio, entre calles y referencia del origen y destino.
3. El nombre, correo, celular y dirección del destinatario se toman del pedido. Envíoclick admite nombre y apellidos de 2 a 14 caracteres cada uno, dirección de 8 a 50 caracteres y celular de 10 dígitos. El peso mínimo es 1 kg y el valor declarado máximo es $3.000.000.
4. Confirma los datos de prueba y consulta tarifas. El importe incluye flete y seguro mínimo, excluye contraentrega y no cambia el total ya pagado.
5. Elige servicio y genera la guía de prueba. La cotización vence en 10 minutos o si cambia el pedido.
6. Abre el PDF de prueba. La guía Sandbox es ficticia: no solicita recogida ni permite consultar movimientos reales. Los estados del pedido se pueden simular mediante seguimiento manual.

## Límites y seguridad

Según la [documentación oficial de Colombia](https://apidoc.envioclickpro.com.co/), solo la generación de guías tiene endpoint Sandbox. Se utiliza la cotización normal en /quotation y exclusivamente /shipment_sandbox para guías. La aplicación bloquea /shipment, el entorno productivo, la contraentrega y la recogida automática.

Cada pedido conserva su proveedor. Una guía creada o de resultado incierto impide crear otra, incluso cambiando de proveedor. Ante un resultado incierto se debe consultar al proveedor antes de resolverlo; no hay reintento automático.

El nombre interno de la tabla y la ruta /envia se conservan por compatibilidad. El campo provider identifica el proveedor real; las filas anteriores se migran como envia.

## Volver a Envia.com

Cambia SHIPPING_PROVIDER=envia y conserva ENVIA_ENVIRONMENT=sandbox y su token válido en ENVIA_API_TOKEN. Reinicia el servidor. Las guías anteriores conservan Envíoclick como proveedor; las cotizaciones pendientes deben volver a solicitarse. Esto no activa producción.

## Verificaciones

- npm run test:envioclick: integración con proveedor simulado y base aurum_test.
- npm run test:envia: regresión de Envia.com.
- npm test: validación de tarifas, enlaces y bloqueo del endpoint productivo.
- npx tsx scripts/envioclick-smoke.ts: cotización y una guía contra la API Sandbox. Guarda un registro en .local/envioclick-sandbox-smoke.json y bloquea repetirla automáticamente.

La prueba con la clave local fue aceptada el 27 de noviembre de 2026. Devolvió cuatro servicios sin contraentrega y una guía ficticia de Coordinadora, con el PDF genérico de Sandbox. No prueba un despacho ni un seguimiento real.
