"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { formatCOP } from "@/lib/money";
import type { Rate } from "@/modules/shipping/validation";
export function ShippingWorkspace() {
  const [rates, setRates] = useState<Rate[]>([]),
    [selected, setSelected] = useState<Rate | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  async function load() {
    setRates((await api<{ rates: Rate[] }>("/api/admin/shipping")).rates);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, []);
  async function save(form: HTMLFormElement) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const f = new FormData(form);
    try {
      await api("/api/admin/shipping", "POST", {
        ...(selected
          ? { id: selected.id, expectedVersion: selected.version }
          : {}),
        department: f.get("department"),
        city: f.get("city"),
        amount: Number(f.get("amount")),
        carrier: f.get("carrier"),
        minDays: Number(f.get("minDays")),
        maxDays: Number(f.get("maxDays")),
        active: f.get("active") === "on",
        reason: f.get("reason"),
      });
      await load();
      setSelected(null);
      form.reset();
      setMessage(
        "Tarifa guardada. Los pedidos anteriores conservan su tarifa.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <p role="status">{message}</p>
      <div className="admin-toolbar">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setSelected(null);
            void load().catch((e) => setMessage(e.message));
          }}
        >
          Recargar / nueva tarifa
        </button>
      </div>
      <div className="account-grid">
        <section>
          <h2>Cobertura</h2>
          {rates.map((r) => (
            <article className="order-card" key={r.id}>
              <h3>
                {r.city}, {r.department}
              </h3>
              <p>
                {formatCOP(r.amount)} · {r.carrier} · {r.minDays}–{r.maxDays}{" "}
                días hábiles
              </p>
              <p>{r.active ? "Disponible" : "Desactivado"}</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setSelected(r)}
              >
                Editar destino
              </button>
            </article>
          ))}
        </section>
        <form
          key={selected?.id + ":" + selected?.version}
          className="checkout-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget);
          }}
        >
          <h2>{selected ? "Editar tarifa" : "Nuevo destino"}</h2>
          <fieldset disabled={busy}>
            {(
              [
                ["department", "Departamento"],
                ["city", "Ciudad"],
                ["carrier", "Transportadora"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  required
                  minLength={key === "carrier" ? 3 : 2}
                  maxLength={100}
                  defaultValue={
                    selected?.[key] ??
                    (key === "carrier" ? "Transportadora de ejemplo" : "")
                  }
                />
              </label>
            ))}
            {(
              [
                ["amount", "Tarifa en COP", 0, 1000000],
                ["minDays", "Mínimo de días hábiles", 1, 60],
                ["maxDays", "Máximo de días hábiles", 1, 60],
              ] as const
            ).map(([key, label, min, max]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  type="number"
                  required
                  min={min}
                  max={max}
                  step={1}
                  defaultValue={
                    selected?.[key] ??
                    (key === "amount" ? 12000 : key === "minDays" ? 2 : 5)
                  }
                />
              </label>
            ))}
            <label className="checkbox">
              <input
                name="active"
                type="checkbox"
                defaultChecked={selected?.active ?? true}
              />
              Destino disponible
            </label>
            <label>
              Motivo del cambio
              <textarea name="reason" required minLength={8} maxLength={500} />
            </label>
            <button className="button">
              {busy ? "Guardando…" : "Guardar tarifa de ejemplo"}
            </button>
          </fieldset>
        </form>
      </div>
    </section>
  );
}
