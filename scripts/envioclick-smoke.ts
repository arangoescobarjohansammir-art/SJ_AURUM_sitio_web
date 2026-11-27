import "dotenv/config";
import fs from "node:fs";
import {
  quoteProvider,
  generateProvider,
} from "../src/modules/shipping/provider";
if (
  process.env.SHIPPING_PROVIDER !== "envioclick" ||
  process.env.ENVIOCLICK_ENVIRONMENT !== "sandbox"
)
  throw Error("Solo Sandbox");
const marker = ".local/envioclick-sandbox-smoke.json";
if (fs.existsSync(marker))
  throw Error(
    "Ya se solicitó la guía de prueba; consulta el registro local antes de repetir.",
  );
const contact = {
  company: "SJ AURUM Pruebas",
  firstName: "Cliente",
  lastName: "Pruebas",
  email: "pruebas@example.invalid",
  phone: "3000000000",
  address: "Calle ficticia 123",
  suburb: "Centro",
  crossStreet: "Calle ficticia",
  reference: "Porteria ficticia",
  daneCode: "11001000",
};
const payload = {
  origin: contact,
  destination: { ...contact, address: "Calle ficticia 456" },
  packages: [{ weight: 1, height: 5, width: 10, length: 15 }],
  description: "Bisuteria de prueba",
  contentValue: 100000,
};
const rates = await quoteProvider("envioclick", payload);
console.log(
  "Cotización aceptada: " + rates.length + " servicios sin contraentrega.",
);
fs.mkdirSync(".local", { recursive: true });
fs.writeFileSync(
  marker,
  JSON.stringify({ state: "GENERATING", at: new Date().toISOString() }),
  { flag: "wx" },
);
try {
  const label = await generateProvider(
    "envioclick",
    payload,
    rates[0],
    "SJAURUMPRUEBA" + Date.now(),
  );
  fs.writeFileSync(
    marker,
    JSON.stringify(
      { state: "CREATED", at: new Date().toISOString(), ...label },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      state: "CREATED",
      carrier: label.carrier,
      trackingNumber: label.trackingNumber,
      label: label.label,
    }),
  );
} catch (e) {
  fs.writeFileSync(
    marker,
    JSON.stringify({ state: "UNKNOWN", at: new Date().toISOString() }),
  );
  throw e;
}
