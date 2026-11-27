# Administración de pedidos

## Acceso y uso

Con PostgreSQL y la tienda activos, abrir `/admin/pedidos` con una cuenta ADMIN activa y verificada. También se accede desde la pestaña Pedidos del panel de catálogo. La preparación de cuentas se describe en ADMINISTRACION.md.

1. Buscar por número de pedido, nombre o correo del destinatario; la búsqueda no distingue mayúsculas. Los filtros de reserva y seguimiento se combinan con el texto. Pulsar Buscar pedidos para aplicarlos.
2. Consultar las páginas de 20 pedidos, ordenados del más reciente al más antiguo.
3. Abrir Ver pedido para consultar destinatario, contacto, dirección, productos y precios históricos, descuento, cupón, envío y total COP. Las fechas se muestran en hora de Colombia.
4. Registrar una nota de 8 a 1000 caracteres y el seguimiento interno: Pendiente de revisión, Revisado, Con incidencia o Resuelto. Se puede añadir otra nota manteniendo el mismo seguimiento.
5. Para cancelar una reserva activa, escribir el motivo y marcar la confirmación. La cancelación no se revierte; devuelve unidades reservadas y uso del cupón una sola vez.
6. Consultar las últimas 100 entradas administrativas con autor, fecha, motivo y estados anterior/nuevo. Los movimientos de reserva muestran creación y liberación, incluido el vencimiento automático.

El seguimiento es independiente del estado de la reserva. Marcar Resuelto no cobra, despacha, reactiva ni prolonga una reserva. Las notas son privadas del equipo y no se envían correos. El estado mostrado se actualiza al consultar el listado o recargar el detalle; una vista abierta no recibe cambios en tiempo real.

## Instalación de esta actualización

Si ya están instaladas las dependencias, detener el servidor web con Ctrl+C, mantener PostgreSQL activo y ejecutar:

```powershell
npm run db:generate
npm run db:deploy
npm run dev
```

Para una instalación nueva, primero ejecutar `npm ci --include=dev` y seguir README.md. La migración agrega seguimiento, versión e índice a Order; conserva los pedidos existentes.

## Reglas y protección

Todas las operaciones verifican la sesión y el rol dentro de la transacción. Solo se gestionan pedidos demo y solo en desarrollo. El listado no devuelve datos de contacto; estos se consultan exclusivamente en el detalle protegido. No se exponen hashes, claves de idempotencia ni identificadores de sesión.

Las escrituras exigen origen local autorizado, límites de frecuencia/cuerpo y validación del servidor. Cada cambio administrativo agrega auditoría en la misma transacción. El número de versión impide repetir una mutación o sobrescribir cambios de otro operador; una respuesta 409 exige recargar. La cancelación del cliente, la administrativa y el vencimiento comparten la liberación transaccional de inventario/cupón. También incrementan la versión del pedido.

El listado procesa reservas demo vencidas antes de contar y filtrar. Este proceso local está pensado para volúmenes de demostración; antes de producción debe trasladarse a un trabajo programado y validarse bajo carga. Las notas no son un registro criptográfico inmutable frente a un operador de base de datos.

## Validación

- `npm run test:admin-orders`: siete grupos PostgreSQL en aurum_test para permisos, búsqueda, filtros, privacidad, validación, auditoría, edición concurrente, cancelación repetida, carrera cliente/administrador, vencimiento, exclusión de pedidos no demo y revocación.
- `npm run test:admin-orders-http`: prueba rutas, origen, permisos, validación, búsqueda, detalle, notas, conflicto de versión, cancelación y revocación. Crea datos ficticios aislados y oculta el producto/tarifa auxiliares al terminar.
- Regresión: ocho pruebas de comercio, nueve grupos de catálogo/inventario y siete pruebas unitarias.
- Navegador: búsqueda sin resultados y por destinatario, detalle, nota persistida tras recargar, cancelación con confirmación e historial. Escritorio 1280 px y detalle móvil 320 px sin desbordamiento horizontal; consola sin errores durante el recorrido.

## Pendiente para ventas reales

Pagos y conciliación, reembolsos, preparación/despacho/entrega, transportadora y guía, avisos al cliente, exportación, automatizaciones, permisos más granulares y controles de producción. Este panel no ofrece estados pagado, enviado o entregado sin esas integraciones.
