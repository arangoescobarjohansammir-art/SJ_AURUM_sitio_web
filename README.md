# SJ AURUM

Tienda de joyería y accesorios de oro laminado para Colombia. Desarrollo por fases a partir del ZIP de Stitch y el logotipo definitivo.

## Estado

Auditoría completa en `docs/AUDITORIA.md`. Preparación técnica en curso. **No es todavía una tienda operativa ni está habilitada para pagos.** Los datos de ejemplo están autorizados por el usuario y deberán sustituirse antes del lanzamiento.

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

Logo original en `public/brand/sj-aurum.png`, sin modificaciones. Paleta y tipografías en `src/app/globals.css`. Las fuentes deben incorporarse localmente antes de validar fidelidad tipográfica. Las referencias originales permanecen fuera del repositorio de aplicación.

## Control de versiones

Remoto solicitado: https://github.com/arangoescobarjohansammir-art/SJ_aurum_sitio_web.git . Commits separados por fase/unidad. El informe de cierre debe distinguir commits locales y push completado.
