# Estado de desarrollo — primera entrega

26 de noviembre de 2026 (Colombia). El proyecto continúa en desarrollo. Este documento no certifica que se haya cumplido el alcance final.

## Implementado

- Fase 0: inventario de 14 HTML, 15 imágenes y guía de Stitch, revisión de scripts, logo, entorno y remoto GitHub; arquitectura y riesgos en AUDITORIA.md.
- Fase 1: Next.js/TypeScript, React, dependencias bloqueadas, fuentes locales, paleta, logo íntegro, variables de entorno vacías, cabeceras básicas y documentación.
- Primera unidad de fase 2: inicio editorial responsive, categorías, catálogo con búsqueda normalizada, categoría, máximo de precio, disponibilidad, orden ascendente/descendente, carga adicional y estados vacíos.
- Detalle visual con galería, selección de variantes, disponibilidad ilustrativa, especificaciones pendientes y relacionados.
- Favoritos y bolsa persistidos en navegador: añadir, limitar por stock de ejemplo, cambiar cantidad, eliminar toda una línea y calcular subtotal COP. No hay persistencia servidor ni reservas reales.
- Páginas de marca y notas de información pendientes de aprobación; 404 propia y enlace de salto al contenido.

## Validación realizada

- TypeScript sin errores.
- Siete pruebas automatizadas: filtros combinados, orden sin mutación, datos manipulados, variante agotada, duplicados de carrito, eliminación completa de una línea, formato COP y conversión a centavos (dos casos agrupados en money.test.ts).
- Compilación de producción correcta.
- npm audit: cero vulnerabilidades conocidas tras fijar effect 3.22.1 y actualizar Prisma.
- Navegador: inicio → catálogo → filtros sin resultados → limpiar → favorito → detalle → variante agotada bloqueada → añadir variante de 60 cm → aumentar a dos → recargar → subtotal $290.000 → eliminar → bolsa vacía.
- Revisión visual en escritorio y móvil 390×844; catálogo a 320×800 y 768×1024. El ancho de contenido coincidió con el viewport útil, sin desbordamiento horizontal. Ajuste adicional para mostrar los selectores en una columna a 320 px.
- Se corrigieron advertencias de contenedor de imágenes y se ocultó el indicador de desarrollo que tapaba el botón Inicio móvil. Consola de la última revisión del catálogo sin warnings ni errores.

Estas pruebas no son una auditoría integral de seguridad, accesibilidad, dispositivos reales ni compra. No se probaron base de datos, identidad o pasarela porque aún no están implementadas.

## Pendiente para cumplir el encargo

1. Completar inicio conectado a datos: colecciones administrables, novedades, popularidad real y newsletter con consentimiento y almacenamiento. No mostrar reseñas hasta que existan.
2. Fase 3: esquema/migraciones PostgreSQL, repositorios, productos administrables, precios servidor, cupones, envíos, checkout, pedidos y reservas transaccionales. El límite de stock del navegador actual no protege ventas reales.
3. Fase 4: registro, login, verificación, recuperación, roles, perfil, direcciones, historial y seguimiento privado.
4. Fase 5: Wompi u otro proveedor confirmado, verificación de webhook, idempotencia, conciliación, reembolsos, correo y transportadora.
5. Fase 6: certificados verificables, condiciones versionadas, puntos, movimientos, recompensas y canjes.
6. Fase 7: administración protegida de productos, imágenes, clientes, pedidos, inventario, marketing y configuración.
7. Fase 8: integración, concurrencia, autorización, seguridad, accesibilidad, responsive ampliado y rendimiento.
8. Fase 9: hosting, dominio, HTTPS, datos y políticas reales aprobados, copias/restauración, monitoreo y compra de validación.

## Datos y operación

El usuario autorizó usar ejemplos mientras prepara catálogo y políticas. Eso permite avanzar con fixtures, pero no habilita garantías inventadas o cobros simulados. No se han solicitado claves por chat. No se creó hosting ni se publicó la tienda; el despliegue corresponde a la fase 9 del encargo.

La siguiente unidad técnica es el modelo de datos y los servicios transaccionales. Se necesita un PostgreSQL de desarrollo para probar las migraciones y la concurrencia; no hay PostgreSQL/Docker disponible en PATH en este entorno ni una conexión configurada.

## Archivos principales

- `src/app/`: rutas, composición y estilos.
- `src/components/`: navegación, tarjetas, filtros, detalle y estado de sesión de navegador.
- `src/modules/catalog/`: fixtures autorizados y filtros.
- `src/modules/cart/`: validación de la bolsa ilustrativa.
- `tests/`: pruebas de catálogo, carrito e importes.
- `public/`: logotipo y fotos de referencia.
- `docs/`: auditoría, fuentes y este estado.

Preparación guardada inicialmente en el commit `8606ad3`. La interfaz se guarda en un commit separado. Consultar `git log` para hashes completos y comprobar remoto con `git remote -v`; el informe del chat distingue el push del commit local.
