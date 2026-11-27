"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
type Address = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  department: string;
  city: string;
  street: string;
  additional: string;
};
const blank = {
  label: "",
  recipient: "",
  phone: "",
  department: "",
  city: "",
  street: "",
  additional: "",
};
const fields = [
  { key: "label", label: "Nombre de la dirección", max: 50 },
  { key: "recipient", label: "Destinatario", max: 100 },
  { key: "phone", label: "Celular", max: 13 },
  { key: "department", label: "Departamento", max: 100 },
  { key: "city", label: "Ciudad", max: 100 },
  { key: "street", label: "Dirección", max: 200 },
  { key: "additional", label: "Indicaciones opcionales", max: 300 },
] as const;
export function Addresses() {
  const [addresses, setAddresses] = useState<Address[]>([]),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState<string | null>(null),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    lock = useRef(false);
  async function load() {
    const result = await api<{ addresses: Address[] }>(
      "/api/account/addresses",
    );
    setAddresses(result.addresses);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api(
        "/api/account/addresses" + (editing ? "/" + editing : ""),
        editing ? "PATCH" : "POST",
        form,
      );
      await load();
      setShow(false);
      setEditing(null);
      setForm(blank);
      setMessage("Dirección de prueba guardada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/api/account/addresses/" + id, "DELETE", {});
      await load();
      setMessage("Dirección eliminada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos eliminar.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="account-panel">
      <h2>Tus direcciones</h2>
      <p className="muted">
        Guarda hasta cinco direcciones ficticias. Todavía no se usan para
        despachos.
      </p>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {addresses.map((a) => (
        <article className="address-card" key={a.id}>
          <h3>{a.label}</h3>
          <p>
            {a.recipient} · {a.phone}
          </p>
          <p>
            {a.street}, {a.city}, {a.department}
          </p>
          <p>{a.additional}</p>
          <div className="account-tabs">
            <button
              disabled={busy || show}
              className="text-button"
              onClick={() => {
                setEditing(a.id);
                setForm(a);
                setShow(true);
                setMessage("");
              }}
            >
              Editar
            </button>
            <button
              disabled={busy || show}
              className="text-button"
              onClick={() => remove(a.id)}
            >
              Eliminar dirección
            </button>
          </div>
        </article>
      ))}
      {!addresses.length && !show && <p>Aún no has guardado direcciones.</p>}
      {!show ? (
        <button
          disabled={busy || addresses.length >= 5}
          className="button secondary"
          onClick={() => {
            setForm(blank);
            setEditing(null);
            setShow(true);
            setMessage("");
          }}
        >
          Añadir dirección
        </button>
      ) : (
        <form className="checkout-form" onSubmit={save}>
          <fieldset disabled={busy}>
            <legend>{editing ? "Editar dirección" : "Nueva dirección"}</legend>
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  required={f.key !== "additional"}
                  maxLength={f.max}
                  type={f.key === "phone" ? "tel" : "text"}
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm({ ...form, [f.key]: e.target.value })
                  }
                />
              </label>
            ))}
          </fieldset>
          <div className="account-tabs">
            <button disabled={busy} className="button">
              {busy ? "Guardando…" : "Guardar dirección"}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setShow(false)}
            >
              Cancelar edición
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
