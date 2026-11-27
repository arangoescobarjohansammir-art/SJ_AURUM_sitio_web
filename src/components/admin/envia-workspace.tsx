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
  const lock = useRef(false);
  const path = "/api/admin/orders/" + encodeURIComponent(order.id) + "/envia";
  async function load() {
    const r = await api<{ configured: boolean; shipment: EnviaView | null }>(
      path,
    );
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
        city: String(f.get(prefix + "City")),
        state: String(f.get(prefix + "State")),
        postalCode: String(f.get(prefix + "Postal")),
      });
    void run("QUOTE", {
      expectedVersion: order.version,
      origin: {
        ...location("origin"),
        name: f.get("name"),
        phone: f.get("phone"),
        street: f.get("street"),
      },
      destination: location("destination"),
      carrier: f.get("carrier"),
      weight: Number(f.get("weight")),
      length: Number(f.get("length")),
      width: Number(f.get("width")),
      height: Number(f.get("height")),
      acceptedSandbox: f.get("accepted") === "on",
    });
  }
  return (
    <section className="order-card">
      <h3>Envia.com Sandbox</h3>
      <p>
        Guías de prueba para Colombia. El importe cotizado aquí corresponde al
        servicio de transporte; no modifica el total ya pagado del pedido.
      </p>
      {!configured && (
        <p className="notice">
          Falta configurar ENVIA_API_TOKEN y ENVIA_ENVIRONMENT=sandbox en el
          archivo .env local.
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
              Comprueba el resultado en Envia Sandbox. No se repetirá la
              solicitud; si la conexión falló, la guía podría haberse creado.
            </p>
          )}
          {view.state === "CREATED" && (
            <>
              <p>
                {view.carrier} · {view.service} · Guía {view.trackingNumber}
              </p>
              <p>
                Estado informado por Envia: {view.providerStatus}
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
                disabled={busy || !configured}
                onClick={() => void run("TRACK")}
              >
                Consultar seguimiento en Envia
              </button>
              <p className="muted">
                Esta consulta muestra el estado del proveedor. Registra los
                cambios logísticos en el seguimiento del pedido; no hay
                notificaciones automáticas.
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
                  {(["origin", "destination"] as const).map((prefix) => (
                    <fieldset key={prefix}>
                      <legend>
                        {prefix === "origin"
                          ? "Ubicación de origen"
                          : "Destino del pedido: " + order.shippingLabel}
                      </legend>
                      <label>
                        Código de ciudad Envia (DANE de 8 dígitos)
                        <input
                          name={prefix + "City"}
                          required
                          pattern="[0-9]{8}"
                          maxLength={8}
                        />
                      </label>
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
                    </fieldset>
                  ))}
                  <p>
                    Usa los códigos del catálogo Envia que correspondan al
                    destino. El nombre, celular y dirección de entrega se toman
                    del pedido.
                  </p>
                  <label>
                    Transportadora (código Envia)
                    <input
                      name="carrier"
                      defaultValue="coordinadora"
                      required
                      pattern="[a-zA-Z][a-zA-Z0-9_-]{1,60}"
                    />
                  </label>
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
                        defaultValue={value}
                        min={min}
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
                  <button className="button">Cotizar en Sandbox</button>
                </fieldset>
              </form>
            </details>
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
                  <fieldset disabled={busy || !configured}>
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
