"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { formatCOP } from "@/lib/money";
import type { OrderDetail } from "@/modules/admin/orders-validation";
import type { EnviaView } from "@/modules/shipping/envia-validation";
export function EnviaWorkspace({
  order,
  onUpdated,
}: {
  order: OrderDetail;
  onUpdated: () => Promise<void>;
}) {
  const [view, setView] = useState<EnviaView | null>(null),
    [configured, setConfigured] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [provider, setProvider] = useState("envia");
  const isClick = provider === "envioclick";
  const providerLabel = isClick ? "Envíoclick" : "Envia.com";
  const recordLabel =
    view?.provider === "envioclick" ? "Envíoclick" : "Envia.com";
  const lock = useRef(false);
  const path = "/api/admin/orders/" + encodeURIComponent(order.id) + "/envia";
  async function load() {
    const r = await api<{
      configured: boolean;
      provider: string;
      shipment: EnviaView | null;
    }>(path);
    setProvider(r.provider);
    setView(r.shipment);
    setConfigured(r.configured);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [order.id, order.version]);
  async function run(action: string, data?: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      setView(await api<EnviaView>(path, "POST", { action, data }));
      await onUpdated();
      setMessage("Consulta Sandbox completada.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No pudimos consultar Envia.",
      );
      await load().catch(() => {});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function quote(form: HTMLFormElement) {
    const f = new FormData(form),
      location = (prefix: string) => ({
        suburb: isClick ? String(f.get(prefix + "Suburb")) : undefined,
        crossStreet: isClick
          ? String(f.get(prefix + "CrossStreet"))
          : undefined,
        reference: isClick ? String(f.get(prefix + "Reference")) : undefined,
        city: String(f.get(prefix + "City")),
        state: isClick ? "DC" : String(f.get(prefix + "State")),
        postalCode: isClick ? "000000" : String(f.get(prefix + "Postal")),
      });
    void run("QUOTE", {
      expectedVersion: order.version,
      origin: {
        ...location("origin"),
        email: isClick ? f.get("email") : undefined,
        name: f.get("name"),
        phone: f.get("phone"),
        street: f.get("street"),
      },
      destination: location("destination"),
      carrier: isClick ? "automatic" : f.get("carrier"),
      weight: Number(f.get("weight")),
      length: Number(f.get("length")),
      width: Number(f.get("width")),
      height: Number(f.get("height")),
      acceptedSandbox: f.get("accepted") === "on",
    });
  }
  return (
    <section className="order-card">
      <h3>{providerLabel} · Guías de prueba</h3>
      {isClick && (
        <p>
          La cotización consulta tarifas normales. La guía será ficticia, sin
          cobro, recogida ni seguimiento real.
        </p>
      )}
      <p>
        Guías de prueba para Colombia. El importe cotizado aquí corresponde al
        servicio de transporte; no modifica el total ya pagado del pedido.
      </p>
      {!configured && (
        <p className="notice">
          El proveedor de envíos aún no está configurado para pruebas.
        </p>
      )}
      <p role="status">{message}</p>
      <button
        type="button"
        className="text-button"
        disabled={busy}
        onClick={() => void load().catch((e) => setMessage(e.message))}
      >
        Actualizar configuración y solicitud
      </button>
      {view && (
        <>
          <p>
            Solicitud:{" "}
            {
              (
                {
                  QUOTED: "Cotizada",
                  GENERATING: "Solicitando guía",
                  CREATED: "Guía creada",
                  UNKNOWN: "Resultado sin confirmar",
                } as Record<string, string>
              )[view.state]
            }
          </p>
          {["UNKNOWN", "GENERATING"].includes(view.state) && (
            <p className="notice">
              Comprueba el resultado en {recordLabel}. No se repetirá la
              solicitud; si la conexión falló, la guía podría haberse creado.
            </p>
          )}
          {view.state === "CREATED" && (
            <>
              <p>
                {view.carrier} · {view.service} · Guía {view.trackingNumber}
              </p>
              <p>
                Estado informado por {recordLabel}: {view.providerStatus}
                {view.checkedAt &&
                  " · " +
                    new Date(view.checkedAt).toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                    })}
              </p>
              {view.labelUrl && (
                <p>
                  <a
                    href={view.labelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir guía PDF de prueba
                  </a>
                </p>
              )}
              <button
                className="button secondary"
                disabled={busy || view.provider === "envioclick"}
                onClick={() => void run("TRACK")}
              >
                Consultar seguimiento en {recordLabel}
              </button>
              <p className="muted">
                {view.provider === "envioclick"
                  ? "La guía Sandbox no tiene movimientos reales. Puedes simular los estados desde el seguimiento manual del pedido."
                  : "Esta consulta muestra el estado del proveedor. Registra los cambios logísticos en el seguimiento del pedido."}
              </p>
            </>
          )}
        </>
      )}
      {(!view || view.state === "QUOTED") &&
        order.status === "PAID" &&
        !order.payment?.refund && (
          <>
            <details>
              <summary>Datos para cotizar el envío</summary>
              <form
                className="checkout-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  quote(e.currentTarget);
                }}
              >
                <fieldset disabled={busy || !configured}>
                  <legend>Remitente ficticio</legend>
                  {(
                    [
                      ["name", "Nombre", "SJ AURUM Pruebas"],
                      ["phone", "Celular", "3000000000"],
                      ["street", "Dirección de origen", "Calle ficticia 123"],
                    ] as const
                  ).map(([name, label, value]) => (
                    <label key={name}>
                      {label}
                      <input
                        name={name}
                        defaultValue={value}
                        required
                        maxLength={name === "street" ? 200 : 100}
                      />
                    </label>
                  ))}
                  {isClick && (
                    <label>
                      Correo del remitente ficticio
                      <input
                        type="email"
                        name="email"
                        defaultValue="pruebas@example.invalid"
                        required
                        maxLength={60}
                      />
                    </label>
                  )}
                  {(["origin", "destination"] as const).map((prefix) => (
                    <fieldset key={prefix}>
                      <legend>
                        {prefix === "origin"
                          ? "Ubicación de origen"
                          : "Destino del pedido: " + order.shippingLabel}
                      </legend>
                      <label>
                        Código DANE de ciudad (8 dígitos)
                        <input
                          name={prefix + "City"}
                          required
                          pattern="[0-9]{8}"
                          maxLength={8}
                        />
                      </label>
                      {!isClick && (
                        <>
                          <label>
                            Código de departamento Envia (ejemplo: DC)
                            <input
                              name={prefix + "State"}
                              required
                              pattern="[A-Z0-9]{2,3}"
                              maxLength={3}
                            />
                          </label>
                          <label>
                            Código postal requerido por Envia
                            <input
                              name={prefix + "Postal"}
                              required
                              pattern="[0-9]{5,8}"
                              maxLength={8}
                            />
                          </label>
                        </>
                      )}
                      {isClick &&
                        (
                          [
                            ["Suburb", "Barrio", 30],
                            ["CrossStreet", "Entre calles", 35],
                            ["Reference", "Referencia de ubicación", 25],
                          ] as const
                        ).map(([suffix, label, max]) => (
                          <label key={suffix}>
                            {label}
                            <input
                              name={prefix + suffix}
                              minLength={2}
                              maxLength={max}
                              required
                            />
                          </label>
                        ))}
                    </fieldset>
                  ))}
                  <p>
                    Usa los códigos del catálogo del proveedor que correspondan
                    al destino. El nombre, celular y dirección de entrega se
                    toman del pedido.
                  </p>
                  {!isClick && (
                    <label>
                      Transportadora (código Envia)
                      <input
                        name="carrier"
                        defaultValue="coordinadora"
                        required
                        pattern="[a-zA-Z][a-zA-Z0-9_-]{1,60}"
                      />
                    </label>
                  )}
                  {(
                    [
                      ["weight", "Peso total, kg", 0.2, 0.01, 30],
                      ["length", "Largo, cm", 15, 1, 100],
                      ["width", "Ancho, cm", 10, 1, 100],
                      ["height", "Alto, cm", 5, 1, 100],
                    ] as const
                  ).map(([name, label, value, min, max]) => (
                    <label key={name}>
                      {label}
                      <input
                        name={name}
                        type="number"
                        defaultValue={isClick && name === "weight" ? 1 : value}
                        min={isClick && name === "weight" ? 1 : min}
                        max={max}
                        step="0.01"
                        required
                      />
                    </label>
                  ))}
                  <label className="checkbox">
                    <input name="accepted" type="checkbox" required />
                    Confirmo que son datos de prueba y que los códigos
                    corresponden al origen y destino indicados.
                  </label>
                  <button className="button">Consultar tarifas</button>
                </fieldset>
              </form>
            </details>
            {view?.state === "QUOTED" && view.provider !== provider && (
              <p className="notice">
                El proveedor cambió. Vuelve a cotizar antes de generar una guía.
              </p>
            )}
            {view?.state === "QUOTED" && (
              <>
                <p>
                  Cotización válida hasta{" "}
                  {new Date(view.expiresAt).toLocaleTimeString("es-CO", {
                    timeZone: "America/Bogota",
                  })}{" "}
                  (Colombia).
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run("GENERATE", {
                      quoteKey: view.quoteKey,
                      rateIndex: Number(f.get("rateIndex")),
                      acceptedSandbox: f.get("accepted") === "on",
                    });
                  }}
                >
                  <fieldset
                    disabled={busy || !configured || view.provider !== provider}
                  >
                    <legend>Elegir servicio</legend>
                    {view.rates.map((r, i) => (
                      <label className="checkbox" key={i}>
                        <input
                          type="radio"
                          name="rateIndex"
                          value={i}
                          required
                        />
                        {r.carrier} · {r.service} · {formatCOP(r.totalPrice)} ·{" "}
                        {r.deliveryEstimate}
                      </label>
                    ))}
                    <label className="checkbox">
                      <input name="accepted" type="checkbox" required />
                      Solicitar una guía exclusivamente en Sandbox.
                    </label>
                    <button className="button">Generar guía de prueba</button>
                  </fieldset>
                </form>
              </>
            )}
          </>
        )}
    </section>
  );
}
