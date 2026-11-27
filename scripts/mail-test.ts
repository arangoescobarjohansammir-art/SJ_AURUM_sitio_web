import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  sendMail,
  sender,
  mailOrigin,
  mailMode,
} from "../src/modules/mail/transport";
import { template } from "../src/modules/mail/templates";
const to = process.argv[2];
if (!to) throw Error("Uso: npm run mail:test -- tu-correo");
try {
  const result = await sendMail(
    {
      to,
      from: sender(),
      ...template(
        "Prueba de correo",
        [
          "Este mensaje confirma que SJ AURUM puede solicitar el envío de un correo. No crea cuentas ni pedidos.",
        ],
        mailOrigin() + "/cuenta",
        "Abrir mi cuenta",
      ),
    },
    "test:" + randomUUID(),
  );
  console.log(
    JSON.stringify({ mode: mailMode(), accepted: true, id: result.id }),
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : "MAIL_TEST_FAILED");
  process.exitCode = 1;
}
