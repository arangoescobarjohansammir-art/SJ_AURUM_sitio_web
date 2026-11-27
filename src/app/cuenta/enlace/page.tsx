"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
export default function Page() {
  const [token, setToken] = useState(""),
    [kind, setKind] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false),
    initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const values = new URLSearchParams(window.location.hash.slice(1));
    setToken(values.get("token") ?? "");
    setKind(values.get("kind") ?? "");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (kind === "RESET" && password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api(
        "/api/auth/" + (kind === "RESET" ? "reset" : "verify"),
        "POST",
        { token, password },
      );
      setToken("");
      setPassword("");
      setConfirmation("");
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos validar el enlace.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Seguridad de tu cuenta</p>
      <h1>{kind === "RESET" ? "Nueva contraseña" : "Verificar correo"}</h1>
      <section className="account-panel">
        {done ? (
          <p role="status">
            {kind === "RESET"
              ? "Contraseña actualizada. Cerramos las sesiones anteriores; inicia sesión de nuevo."
              : "Correo verificado correctamente."}
          </p>
        ) : !token || !["RESET", "VERIFY"].includes(kind) ? (
          <p>
            Abre un enlace válido de la bandeja local de desarrollo. Si
            recargaste esta página, vuelve a abrir el enlace.
          </p>
        ) : (
          <form className="checkout-form" onSubmit={submit}>
            <p>El enlace es de un solo uso y vence a los 30 minutos.</p>
            {kind === "RESET" && (
              <>
                <label>
                  Nueva contraseña
                  <input
                    type="password"
                    required
                    minLength={15}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Repetir contraseña
                  <input
                    type="password"
                    required
                    minLength={15}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <small>
                  Entre 15 y 128 caracteres. Usa una contraseña exclusiva para
                  esta prueba.
                </small>
              </>
            )}
            {error && (
              <p role="alert" className="notice">
                {error}
              </p>
            )}
            <button className="button" disabled={busy}>
              {busy
                ? "Validando…"
                : kind === "RESET"
                  ? "Guardar nueva contraseña"
                  : "Confirmar verificación"}
            </button>
          </form>
        )}
        <p>
          <Link className="text-link" href="/cuenta">
            Volver a mi cuenta
          </Link>
        </p>
      </section>
    </main>
  );
}
