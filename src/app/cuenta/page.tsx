"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { AccessForm } from "@/components/account/access-form";
import { Addresses } from "@/components/account/addresses";
type Customer = {
  id: string;
  name: string;
  email: string;
  verifiedAt: string | null;
  role: string;
};
export default function Page() {
  const [customer, setCustomer] = useState<Customer | null>(null),
    [loaded, setLoaded] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  async function load() {
    try {
      const result = await api<{ customer: Customer }>("/api/account");
      setCustomer(result.customer);
      setName(result.customer.name);
      setLoaded(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setLoaded(true);
      else
        setError(
          e instanceof Error ? e.message : "No pudimos cargar tu cuenta.",
        );
    }
  }
  useEffect(() => {
    void load();
    if (new URLSearchParams(window.location.search).get("bolsa") === "ajustada")
      setMessage(
        "La bolsa se ajustó a las existencias disponibles. Revísala antes de continuar.",
      );
  }, []);
  async function action(kind: "profile" | "logout" | "verify") {
    if (lock.current || !customer) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (kind === "logout") {
        await api("/api/auth/logout", "POST", {});
        window.location.assign("/cuenta");
        return;
      }
      if (kind === "profile") {
        const result = await api<{ customer: Customer }>(
          "/api/account",
          "PATCH",
          { name },
        );
        setCustomer(result.customer);
        setMessage("Nombre actualizado.");
      } else {
        const result = await api<{ message: string }>(
          "/api/auth/request-verification",
          "POST",
          { email: customer.email },
        );
        setMessage(result.message);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la acción.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Un espacio para tu estilo</p>
      <h1>Mi cuenta</h1>
      <p className="notice">
        Cuentas de desarrollo. Usa datos ficticios y una contraseña exclusiva
        para esta prueba. No hay compras reales. Los correos de prueba pueden
        enviarse a las direcciones habilitadas por el administrador.
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}{" "}
          <button className="text-button" onClick={() => void load()}>
            Reintentar
          </button>
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!loaded ? (
        <p role="status">Consultando tu sesión…</p>
      ) : !customer ? (
        <AccessForm />
      ) : (
        <>
          <div className="account-grid">
            <section className="account-panel">
              <p className="eyebrow">Hola, {customer.name}</p>
              <h2>Tu perfil</h2>
              <p className="account-email">{customer.email}</p>
              <p>
                {customer.verifiedAt
                  ? "Correo verificado"
                  : "Verificación pendiente"}
              </p>
              {!customer.verifiedAt && (
                <button
                  disabled={busy}
                  className="text-button"
                  onClick={() => action("verify")}
                >
                  Solicitar verificación
                </button>
              )}
              <form
                className="checkout-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action("profile");
                }}
              >
                <label>
                  Nombre
                  <input
                    required
                    minLength={3}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <button className="button secondary" disabled={busy}>
                  Guardar nombre
                </button>
              </form>
            </section>
            <section className="account-panel">
              <h2>Tu colección personal</h2>
              <p>
                Tu bolsa y tus pedidos están asociados a esta cuenta y podrás
                recuperarlos al volver a entrar.
              </p>
              <div className="account-links">
                {customer.role === "ADMIN" && customer.verifiedAt && (
                  <Link href="/admin">Administrar catálogo e inventario</Link>
                )}
                <Link href="/bolsa">Ir a mi bolsa</Link>
                <Link href="/pedidos">Consultar pedidos de prueba</Link>
                <Link href="/favoritos">Ver favoritos de este navegador</Link>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => action("logout")}
              >
                Cerrar sesión
              </button>
            </section>
          </div>
          <Addresses />
        </>
      )}
    </main>
  );
}
