# Envíos de ejemplo

Administración en /admin/envios; seguimiento desde el detalle en /admin/pedidos. Requiere cuenta administradora activa y verificada.

## Cobertura y tarifas

El catálogo inicial incluye Bogotá, Medellín y Cali. Cada destino tiene tarifa en COP, transportadora, plazo mínimo/máximo en días hábiles desde el despacho y disponibilidad. Todo es ilustrativo: no hay convenio con transportadora ni contratación de guías. El panel permite añadir, editar o desactivar destinos; exige motivo y registra auditoría. No admite destinos duplicados ignorando acentos, espacios y puntuación. Límite: 500 destinos.

## Direcciones y compra

En /checkout se elige una dirección guardada de la cuenta o se ingresan datos manuales. La dirección guardada debe coincidir con ciudad y departamento de una tarifa activa; el servidor verifica propiedad y cobertura. Cambiar dirección o tarifa después de revisar exige volver a revisar. El pedido conserva dirección, coste y plazo; editar posteriormente el domicilio o la tarifa no altera ese pedido. La transportadora asignada puede actualizarse en seguimiento.

## Seguimiento

Solo pedidos PAID con pago APPROVED y sin solicitud de reembolso. Estados: preparación, tránsito, entrega, novedad y devolución. Se exige guía desde tránsito; cada cambio tiene nota visible al propietario en /pedidos y auditoría administrativa. No se envían correos ni se consulta una API de transporte. Máximo 100 eventos. Una devolución no repone inventario ni reembolsa automáticamente. Los pedidos anteriores muestran transportadora/plazo «Por definir».

## Prueba local

Con PostgreSQL activo: npm run db:generate y npm run db:deploy; luego npm run dev. En una cuenta administradora abre /admin/envios y modifica una tarifa ficticia. Guarda una dirección de prueba en /cuenta, úsala en checkout y comprueba el importe. Después de un pago Sandbox aprobado dentro del plazo de reserva, usa /admin/pedidos para registrar preparación, tránsito con guía y entrega; consulta /pedidos con la cuenta propietaria.

npm run test:shipping usa exclusivamente aurum_test en PostgreSQL local y verifica permisos, versiones, destinos duplicados, direcciones ajenas, cobertura, cambios entre revisión y confirmación, conservación de direcciones, bloqueo sin pago, transiciones, guía y privacidad.

## Antes de operar comercialmente

Definir cobertura real, exclusiones, tarifas/convenio, tiempos y política de devoluciones. Elegir la transportadora y disponer de su integración para generación de guías, recogidas y eventos automáticos. Este incremento deja listo el flujo manual de demostración, no despachos reales.
