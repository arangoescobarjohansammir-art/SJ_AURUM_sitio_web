"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api-client";
type Mode = "login" | "register" | "request-reset" | "request-verification";
export function AccessForm() {
  const [mode, setMode] = useState<Mode>("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    lock = useRef(false);
  const titles = {
    login: "Bienvenido de nuevo",
    register: "Crea tu cuenta de prueba",
    "request-reset": "Recupera tu acceso",
    "request-verification": "Verifica tu correo",
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ message?: string; adjusted?: boolean }>(
        "/api/auth/" + mode,
        "POST",
        { name, email, password, acceptedDemo: accepted },
      );
      setPassword("");
      if (mode === "login") {
        window.location.assign(
          "/cuenta" + (result.adjusted ? "?bolsa=ajustada" : ""),
        );
        return;
      }
      setMessage(result.message ?? "Solicitud registrada.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la operación.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function change(next: Mode) {
    setMode(next);
    setPassword("");
    setError("");
    setMessage("");
  }
  return (
    <section className="account-panel">
      <p className="eyebrow">Tu espacio AURUM</p>
      <h2>{titles[mode]}</h2>
      <div className="account-tabs">
        <button
          className="text-button"
          disabled={busy}
          aria-pressed={mode === "login"}
          onClick={() => change("login")}
        >
          Iniciar sesión
        </button>
        <button
          className="text-button"
          disabled={busy}
          aria-pressed={mode === "register"}
          onClick={() => change("register")}
        >
          Crear cuenta
        </button>
      </div>
      <form className="checkout-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>
            {mode === "register" ? "Datos de tu cuenta" : "Acceso a tu cuenta"}
          </legend>
          {mode === "register" && (
            <label>
              Nombre
              <input
                required
                minLength={3}
                maxLength={100}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Correo electrónico de prueba
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@example.invalid"
            />
          </label>
          {(mode === "login" || mode === "register") && (
            <label>
              Contraseña
              <input
                type="password"
                required
                minLength={mode === "register" ? 15 : 1}
                maxLength={128}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "register" && (
                <small>
                  Usa una frase de 15 a 128 caracteres. No reutilices una
                  contraseña real.
                </small>
              )}
            </label>
          )}
          {mode === "register" && (
            <label className="checkbox">
              <input
                type="checkbox"
                required
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              Entiendo que es una cuenta de desarrollo y utilizaré datos
              ficticios.
            </label>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy
            ? "Procesando…"
            : mode === "login"
              ? "Entrar"
              : mode === "register"
                ? "Registrar cuenta"
                : "Solicitar enlace"}
        </button>
      </form>
      <div className="account-tabs">
        <button
          className="text-button"
          disabled={busy}
          onClick={() => change("request-reset")}
        >
          Olvidé mi contraseña
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => change("request-verification")}
        >
          Solicitar verificación
        </button>
      </div>
      <p className="muted">
        La verificación y recuperación usarán el canal de correo configurado
        para esta prueba. El resultado de la solicitud indica dónde recibir el
        enlace.
      </p>
    </section>
  );
}
