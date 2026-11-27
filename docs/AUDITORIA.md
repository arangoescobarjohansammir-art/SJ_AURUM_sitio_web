# SJ AURUM — Auditoría inicial

Fecha: 26 de noviembre de 2026, Colombia.

## Fuentes y entorno

Se inspeccionaron los 14 HTML, las 15 capturas y DESIGN.md del ZIP de Stitch. El documento maestro adjunto contiene el encargo; DESIGN.md se interpreta como referencia visual, sin autoridad para reemplazarlo. El logo definitivo tiene prioridad sobre el monograma del ZIP. Los originales no se modificaron.

El directorio inicial solo tenía work/ y outputs/: sin Git, dependencias ni aplicación. Node 22.15.1, npm 10.9.2 y Git están instalados. No se encontró Docker, psql ni gh en PATH. Git dispone de identidad configurada. El usuario indicó https://github.com/arangoescobarjohansammir-art/SJ_aurum_sitio_web.git; la consulta remota terminó correctamente sin referencias (repositorio vacío).

## Inventario completo de pantallas

| Carpeta de Stitch | Contenido | Trabajo necesario |
|---|---|---|
| sj_joyer_a_inicio | Hero, categorías, productos, promoción, testimonios, navegación inferior | Marca definitiva; quitar afirmaciones y reseñas ficticias; navegación real |
| cat_logo_y_colecciones | Búsqueda, chips, orden, tarjetas, filtros y vacío | Consultas reales, paginación, favoritos, variantes |
| detalle_de_producto | Galería, acabados, longitudes, precio, acordeones, reseñas | Fuente de datos, disponibilidad por SKU, cesta |
| detalle_de_producto_gu_a_de_tallas | Variante del detalle; grosor y guía modal de largos | Unificar el componente, accesibilidad de diálogos |
| bolsa_y_checkout | Cantidades, cupón, envío, resumen y medios de pago | Dirección, validación, cálculo servidor, pedido y pasarela |
| seguimiento_de_pedido | Guía, cronología, destino, resumen | Autorización del propietario; estados y guía reales |
| mis_pedidos_historial_completo | Historial, filtros, certificados, reordenar | Datos privados y descargas verificables |
| certificado_de_garant_a_18k | Serial, emisión, cobertura, QR, descarga | Condiciones versionadas, acceso y emisión reales |
| perfil_de_cliente_y_puntos_vip | Perfil, tarjeta VIP, puntos, referidos, dirección | Sesiones, cuenta editable y libro de movimientos |
| canje_de_premios_y_puntos_vip | Premios, cupones, puntos y copago | Reglas configurables, saldo transaccional, stock |
| confirmaci_n_de_canje_exitoso_c_digo_qr | Modal de éxito, código, QR y saldo | Canje único, QR útil y confirmación persistida |
| panel_de_administraci_n_m_tricas_y_ventas | Indicadores, urgentes, alertas y garantías | Roles, métricas calculadas y acciones reales |
| detalle_y_despacho_de_pedido_sj_84920 | Cliente, control de calidad, guía y despacho | Permisos, auditoría y logística |
| ajuste_y_control_de_inventario_de_taller | Stock, ubicaciones, insumos, ajuste e historial | Movimientos atómicos, motivos y responsable |
| image.png/screen.png | Monograma SJ anterior | No usar como marca definitiva |

## Hallazgos de comportamiento y diseño

Los 14 HTML contienen cero llamadas fetch/XMLHttpRequest. Hay enlaces `href="#"`, acciones que solo generan toast/alert y temporizadores que simulan pagos, sincronización, guías y canjes. Cambiar una cifra del DOM no registra un movimiento de inventario. El carrito de referencia resta solo un precio unitario al eliminar una línea, aunque tenga varias unidades. No hay servidor, autenticación ni persistencia.

Las capturas son móviles, de altura variable. Se repiten cabeceras con nombres incorrectos, textos cortados, avatares fallidos y controles inferiores fijos. El HTML bloquea zoom en algunas pantallas y usa etiquetas de 10–11 px. Se conservarán la jerarquía editorial, marfiles, dorados, fotos protagonistas, tarjetas a dos columnas y navegación móvil, corrigiendo legibilidad, foco y adaptación a escritorio.

La guía define Playfair Display + Plus Jakarta Sans, anchos máximos 1280–1440 px, separación generosa, bordes cálidos y radios discretos. Sus tokens generados difieren de la paleta explícita del encargo; prevalecen #FAF7F2, #F4EFE6, #8B6826, #C5A059 y #D8BD80.

Contenido no verificado: 18K, tres capas/micras, titanio, resistencia al mar/perfumes, ausencia de alérgenos, garantía anual, descuentos, cuotas sin intereses, 15.000 clientes, reseñas, envío asegurado/gratuito y promesas VIP. Existen contradicciones entre resistencia a perfumes y cuidados que prohíben perfumes. También hay precios distintos para el mismo pedido. Ninguno será un compromiso real de SJ AURUM. El usuario autorizó datos de ejemplo; deben estar rotulados y separados de producción.

El logo se conserva íntegro. Las fotos del ZIP son mayoritariamente URLs externas en HTML, no archivos de producto originales; falta confirmar derechos y disponibilidad. No se copiarán perfiles, teléfonos ni direcciones de clientes de ejemplo al catálogo público.

## Tecnologías y alternativas

Recomendación: Next.js App Router + TypeScript, PostgreSQL + Prisma, Zod, CSS con variables y componentes React. Next permite páginas renderizadas en servidor y API en un solo despliegue; React con API separada añadiría operación innecesaria inicialmente. Prisma aporta migraciones y tipado; PostgreSQL ofrece transacciones y restricciones para pedidos y stock. CSS propio permite fidelidad sin el script Tailwind CDN de las referencias. Tailwind compilado seguiría siendo viable, pero no necesario.

Autenticación: preferir biblioteca mantenida, sesiones revocables en base de datos, cookies HttpOnly/Secure/SameSite y hashing robusto si se habilitan contraseñas. Recuperación y verificación necesitarán correo. Evitar implementar protocolos propios de identidad.

Wompi es la primera opción a evaluar por su checkout alojado y documentación de eventos colombianos. ePayco y Mercado Pago siguen siendo alternativas según afiliación, tarifas, medios habilitados, liquidación y soporte; no se han comparado contratos comerciales. No prometer Daviplata o Nequi sin comprobar la cuenta del comercio.

Fuentes técnicas consultadas: https://nextjs.org/docs/app/getting-started/installation ; https://docs.wompi.co/docs/colombia/eventos/ ; https://docs.wompi.co/docs/colombia/widget-checkout-web/ . No se afirma cumplimiento legal por haber creado páginas de políticas.

## Arquitectura y carpetas

Monolito modular: UI → servicios de aplicación → repositorios Prisma → PostgreSQL. Adaptadores separados para pagos, correo, imágenes y logística. El navegador nunca decide precios, descuentos, puntos o pagos aprobados.

```
src/app/           rutas públicas, cuenta, admin y API
src/components/    componentes y sistema visual
src/modules/       catálogo, cesta, pedidos, identidad, pagos, lealtad
src/lib/           configuración y utilidades compartidas
prisma/            esquema y migraciones
tests/             pruebas de reglas y flujos
public/            marca, fuentes y medios autorizados
docs/              decisiones, auditoría y operación
```

Dinero en pesos enteros y conversión explícita a centavos de pasarela. Variantes con SKU único. Pedidos con instantánea de precio, producto y condiciones. Stock reservado atómicamente con vencimiento; reconciliación para pagos tardíos. Webhooks con firma, importe, moneda, referencia y entorno comprobados; eventos repetidos no duplican puntos ni descuentos de stock. Reembolsos revierten puntos según política. Auditoría de cambios de inventario y administración.

## Servicios y datos pendientes

Servicios: PostgreSQL, almacenamiento de fotos con CDN, correo transaccional, proveedor de pagos, transportadora, hosting con HTTPS, dominio, monitoreo y copias restaurables. GitHub proporcionado por el usuario. Las claves se configuran en entorno local/hosting, nunca por chat ni en Git.

Datos: razón social/NIT/domicilio/contactos, catálogo/SKU/variantes/precios/impuestos/stock, fichas de materiales y cuidados, fotografías, términos de garantía, cambios/devoluciones/retracto, tratamiento de datos, cobertura/tarifas/plazos de envío, acumulación/vencimiento/reversión de puntos y recompensas. También se requiere determinar facturación electrónica aplicable con el responsable contable. Las políticas de ejemplo serán borradores, no asesoría jurídica ni condiciones publicables.

## Fases y criterios de salida

0. Auditoría: mapa completo y decisiones registradas.
1. Preparación: instalación reproducible, TypeScript, marca, tokens, entorno sin secretos y compilación.
2. Interfaz: inicio, navegación, catálogo responsive y estados accesibles; datos de ejemplo identificados.
3. Compras: esquema/migraciones, productos y variantes reales, carrito, cupones, checkout y reservas; probar concurrencia.
4. Clientes: autenticación, recuperación, direcciones, historial y acceso por propietario.
5. Integraciones: checkout de pasarela, webhook idempotente, correo y logística; ensayos sandbox.
6. Garantías/VIP: condiciones versionadas, certificados, puntos y canjes atómicos.
7. Administración: permisos servidor, CRUD, inventario, pedidos, marketing y configuración con auditoría.
8. Calidad: pruebas negativas de permisos, compra, stock, doble webhook, doble canje, responsive y accesibilidad.
9. Producción: políticas aprobadas, catálogo real, hosting/dominio/HTTPS, claves live, restauración, monitoreo y compra real de validación.

## Git y riesgos

Commits Conventional Commits por unidad funcional, precedidos por pruebas pertinentes, diff, revisión de secretos y status. Dependencias bloqueadas en package-lock. No publicar cambios ajenos, forzar push ni reescribir historia. Verificar remoto y rama antes de push. Un commit local no equivale a respaldo en GitHub.

Riesgos principales: sobreventa, pedidos/puntos duplicados, desfase entre pago y reserva, filtración de datos por identificadores, permisos insuficientes, promesas comerciales falsas, fotos no licenciadas, fuga de secretos, dependencia de servicios externos y falta de backups probados. Mitigaciones se incorporan en cada fase; no se declarará producción lista con pruebas incompletas.
