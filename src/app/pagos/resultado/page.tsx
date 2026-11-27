"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useShop } from "@/components/shop-provider";
export default function PaymentResult() {
  const { ready } = useShop();
  const [message, setMessage] = useState("Consultando el pago de prueba…");
  const [busy, setBusy] = useState(false);
  async function verify() {
    const id = new URL(window.location.href).searchParams.get("id");
    if (!id) {
      setMessage(
        "No recibimos un identificador. Consulta el estado en tus pedidos.",
      );
      return;
    }
    setBusy(true);
    try {
      await api("/api/payments/sync", "POST", { id });
      setMessage(
        "Consulta completada. Revisa el estado actualizado en tus pedidos; volver de Wompi no significa que el pago esté aprobado.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No pudimos confirmar el pago.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (ready) void verify();
  }, [ready]);
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Wompi · Sandbox</p>
      <h1>Resultado del pago de prueba</h1>
      <p role="status" className="notice">
        {message}
      </p>
      <button
        className="button secondary"
        disabled={!ready || busy}
        onClick={() => void verify()}
      >
        {busy ? "Consultando…" : "Consultar nuevamente"}
      </button>
      <p>
        <Link className="text-link" href="/pedidos">
          Ver mis pedidos
        </Link>
      </p>
    </main>
  );
}
