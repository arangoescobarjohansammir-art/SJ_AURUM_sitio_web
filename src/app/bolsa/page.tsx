"use client";
import Image from "next/image";
import Link from "next/link";
import { useShop } from "@/components/shop-provider";
import { formatCOP } from "@/lib/money";
export default function Page() {
  const { cart, ready, busy, setQuantity } = useShop();
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Tus piezas elegidas</p>
      <h1>Tu bolsa</h1>
      <p>
        <Link href="/pedidos" className="text-link">
          Ver mis pedidos de prueba
        </Link>
      </p>
      {!ready ? (
        <p role="status">Conectando con tu bolsa…</p>
      ) : cart.length ? (
        <div className="bag-grid">
          <div>
            {cart.map((line) => (
              <article key={line.variantId} className="bag-item">
                <Image
                  src={line.image}
                  width={150}
                  height={150}
                  alt={line.name}
                />
                <div>
                  <h2>
                    <Link href={"/producto/" + line.slug}>{line.name}</Link>
                  </h2>
                  <p>{line.label} · Ejemplo</p>
                  <p>{formatCOP(line.unitPrice)} COP</p>
                  {(!line.available || line.quantity > line.stock) && (
                    <p role="alert">
                      Disponibilidad cambiada. Ajusta o elimina esta pieza.
                    </p>
                  )}
                  <div className="quantity">
                    <button
                      disabled={busy}
                      aria-label={"Reducir cantidad de " + line.name}
                      onClick={() =>
                        setQuantity(line.variantId, line.quantity - 1)
                      }
                    >
                      −
                    </button>
                    <span aria-label="Cantidad">{line.quantity}</span>
                    <button
                      disabled={
                        busy || line.quantity >= line.stock || !line.available
                      }
                      aria-label={"Aumentar cantidad de " + line.name}
                      onClick={() =>
                        setQuantity(line.variantId, line.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                  <button
                    disabled={busy}
                    className="text-button"
                    onClick={() => setQuantity(line.variantId, 0)}
                  >
                    Eliminar
                  </button>
                </div>
                <strong className="line-total">
                  {formatCOP(line.unitPrice * line.quantity)}
                </strong>
              </article>
            ))}
          </div>
          <aside className="order-summary">
            <p className="eyebrow">Resumen</p>
            <h2>Tu selección</h2>
            <div>
              <span>Subtotal</span>
              <strong>
                {formatCOP(
                  cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
                )}
              </strong>
            </div>
            <div>
              <span>Envío de ejemplo</span>
              <span>Elegir destino</span>
            </div>
            <p className="notice">
              Podrás crear una reserva de prueba de 15 minutos. No se realizan
              cobros ni envíos.
            </p>
            {!busy &&
              cart.every((l) => l.available && l.quantity <= l.stock) && (
                <Link href="/checkout" className="button">
                  Revisar pedido de prueba
                </Link>
              )}
            <Link href="/catalogo" className="button secondary">
              Seguir explorando
            </Link>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <h2>Tu bolsa espera algo especial.</h2>
          <p>Explora las piezas y elige tu variante.</p>
          <Link href="/catalogo" className="button">
            Descubrir la colección
          </Link>
        </div>
      )}
    </main>
  );
}
