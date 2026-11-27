# SJ AURUM

Tienda de joyería y accesorios de oro laminado para Colombia. Desarrollo por fases a partir del ZIP de Stitch y el logotipo definitivo.

## Estado

Auditoría y preparación técnica completadas. Primera unidad de interfaz implementada: inicio, navegación responsive, catálogo con búsqueda/filtros/orden/carga adicional, detalle con variantes y galería, favoritos y bolsa persistentes en navegador. **No es todavía una tienda operativa ni está habilitada para pagos.** Los datos de ejemplo están autorizados por el usuario y deberán sustituirse antes del lanzamiento. Estado detallado y límites en `docs/ESTADO.md`.

## Desarrollo local

Requiere Node >=22.12 y npm. Desde esta carpeta:

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000. Copiar `.env.example` a `.env` solo cuando se configuren los servicios; no subir `.env` a Git. No compartir credenciales por chat.

## Verificación

```sh
npm run typecheck
npm test
npm run build
```

PostgreSQL y las integraciones externas requieren configuración independiente. La app no debe sustituir operaciones externas con confirmaciones falsas. `COMMERCE_ENABLED=false` es la intención de configuración para el futuro checkout; no existe todavía un servicio de cobro.

## Marca y referencias

Logo original en `public/brand/sj-aurum.png`, sin modificaciones. Paleta en `src/app/globals.css`. Playfair Display y Plus Jakarta Sans se sirven localmente mediante Fontsource. Las fotos ilustrativas de Stitch están en `public/images`; sus procedencias y limitación de uso están en `docs/asset-sources.json`. Las referencias originales permanecen fuera del repositorio de aplicación.

Las categorías sin productos de ejemplo muestran un estado vacío. No se inventan ventas para ordenar por popularidad, reseñas, beneficios comerciales ni garantías. Las páginas de información son notas pendientes de definición, no políticas comerciales vigentes.

Prisma 7 y su adaptador PostgreSQL están instalados para la siguiente fase; aún no existen esquema, migraciones ni conexión de datos. Los comandos `db:*` están preparados pero no son funcionales hasta crear esa capa. La fijación transitoria `effect@3.22.1` corrige la alerta ReDoS transitiva de Prisma; revisar su necesidad al actualizar Prisma.

## Control de versiones

Remoto solicitado: https://github.com/arangoescobarjohansammir-art/SJ_aurum_sitio_web.git . Commits separados por fase/unidad. El informe de cierre debe distinguir commits locales y push completado.
