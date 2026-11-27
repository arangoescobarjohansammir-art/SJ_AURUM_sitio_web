# Cuentas de desarrollo

## Alcance

Registro, acceso, cierre de sesión, perfil (nombre), verificación de correo, recuperación de contraseña y direcciones privadas. La bolsa y el historial pasan a una sesión de comercio persistente de la cuenta al iniciar sesión. Las cuentas y entregas locales requieren APP_ENV=development; están cerradas fuera de ese entorno.

No hay correos enviados a Internet, acceso social, MFA, cambio de correo ni seguimiento de transportadora. El panel de catálogo e inventario de desarrollo se documenta en ADMINISTRACION.md. Las direcciones guardadas todavía no se seleccionan desde el checkout de demostración. Los favoritos continúan ligados al navegador.

## Sesiones y autorización

- Cookie aurum_account: aleatoria de 256 bits, HttpOnly, SameSite strict, Secure cuando APP_URL usa HTTPS, siete días de duración absoluta.
- PostgreSQL guarda el SHA-256 del token; cada petición protegida verifica sesión vigente y cuenta activa.
- Logout elimina la sesión del servidor. Restablecer contraseña elimina todas las sesiones de esa cuenta.
- El rol se fija en CUSTOMER en el registro. Los campos adicionales como role enviados desde el cliente se descartan. requireAdmin exige rol ADMIN y correo verificado; no hay ruta pública para promover roles.
- El identificador de propietario proviene de la sesión, nunca del cuerpo del formulario. Las direcciones se consultan/actualizan/eliminan restringiendo customerId.
- Verificación de Origin, cuerpos JSON limitados y límites de frecuencia en PostgreSQL. No se confía en cabeceras IP arbitrarias. El límite global de desarrollo no sustituye defensa perimetral en producción.

## Contraseñas y recuperación

scrypt nativo de Node, N=131072, r=8, p=1, sal aleatoria de 128 bits y comparación de tiempo constante. Contraseñas de 15 a 128 caracteres sin truncado ni normalización. La comprobación de un correo inexistente ejecuta el mismo cálculo costoso con un hash ficticio.

Los enlaces de verificación/recuperación tienen tokens aleatorios de 256 bits, hash en base, propósito separado, caducidad de 30 minutos y consumo transaccional único. Solicitar otro enlace del mismo propósito invalida el anterior. Un enlace de verificación no sirve para recuperar la contraseña. Los enlaces se consumen mediante POST y acción explícita, no al visitar la URL.

El token viaja en el fragmento de la URL, que no se envía al servidor al navegar. La página lo retira de la barra al cargar. No hay tokens en respuestas públicas ni logs de aplicación. La bandeja local sí contiene el enlace en claro, como un buzón de correo: se debe proteger y nunca publicar.

Referencias consultadas:

- [OWASP: almacenamiento de contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP: recuperación de contraseña](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- Documentación de autenticación, Route Handlers y cookies incluida con la versión instalada de Next.js.

Se eligieron sesiones opacas en PostgreSQL para permitir revocación inmediata y mantener una única fuente de autorización. Es una implementación propia y acotada a desarrollo. Antes de habilitar cuentas comerciales debe evaluarse una biblioteca/proveedor mantenido, auditoría independiente, MFA para administración, controles de abuso, retención, consentimiento y correo transaccional real. No constituye una certificación de seguridad.

## Asociación de bolsa y pedidos

Cada cuenta dispone de una VisitorSession de comercio privada sin cookie de visitante emitida. Su fecha técnica lejana permite conservar la bolsa; el acceso real siempre depende de AuthSession (siete días).

Al acceder, se bloquean transaccionalmente las sesiones implicadas. Se suman las unidades invitadas y existentes hasta el stock disponible, 99 unidades por variante y 30 variantes. Se notifica si hubo ajustes. Las variantes desactivadas/no disponibles no se trasladan. No se reserva inventario al asociar la bolsa.

Se trasladan los pedidos del visitante, se vacía su bolsa y se invalida su token. Reintentos simultáneos no vuelven a sumar unidades. Cerrar sesión borra ambas cookies; el siguiente visitante recibe una sesión vacía y no puede acceder a la cuenta anterior. No se mezcla por dirección de correo del destinatario de un pedido.

## Bandeja local

Configurar en .env (el lanzador db:local lo incluye para instalaciones nuevas):

    APP_ENV=development
    APP_URL=http://127.0.0.1:3000
    LOCAL_MAIL_DIRECTORY=.local/mail

Si ya existía .env, añadir LOCAL_MAIL_DIRECTORY sin sustituir DATABASE_URL. Mantener la ruta dentro de una carpeta privada, ignorada por Git y fuera de public/. La ruta se lee en ejecución para impedir que Turbopack observe los datos mutables de PostgreSQL.

Desde Mi cuenta, registrar un correo de ejemplo o solicitar un enlace. Después, en la terminal local del proyecto:

    npm run mail:local -- cliente@example.invalid

El comando muestra el último enlace de ese correo. Abrirlo en el navegador y confirmar verificación o definir una nueva contraseña. No pegar ese enlace en chats ni guardarlo en Git. Si venció, solicitar otro. Esta bandeja no es un servidor SMTP.

## Pruebas

- npm run test:auth: ocho grupos de pruebas PostgreSQL en aurum_test; duplicados, hashes, autenticación fallida, roles, tokens concurrentes/de propósito/vencidos, privacidad de direcciones, revocación, bolsa/pedidos concurrentes, cuentas desactivadas y cierre en producción.
- npm run test:auth-http: recorrido API contra el servidor local, incluida escritura/lectura de la bandeja y recuperación; usa cuentas ficticias únicas y no imprime secretos.
- Prueba de navegador: registro, login, cambio de nombre, alta de dirección, recarga y logout; diseño móvil a 390/320 px.

Los datos de pruebas se conservan aislados por identificador. No ejecutar estos scripts contra producción.
