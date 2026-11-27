"use client";
import Image from "next/image";
import Link from "next/link";
import { useShop } from "@/components/shop-provider";
import { findVariant } from "@/modules/catalog/products";
import { cartSubtotal } from "@/modules/cart/cart";
import { formatCOP } from "@/lib/money";
export default function Page() {
  const { cart, ready, setQuantity } = useShop();
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Tus piezas elegidas</p>
      <h1>Tu bolsa</h1>
      {!ready ? (
        <p role="status">Cargando tu bolsa…</p>
      ) : cart.length ? (
        <div className="bag-grid">
          <div>
            {cart.map((line) => {
              const found = findVariant(line.variantId);
              if (!found) return null;
              const { product, variant } = found;
              return (
                <article key={line.variantId} className="bag-item">
                  <Image
                    src={product.image}
                    width={150}
                    height={150}
                    alt={product.name}
                  />
                  <div>
                    <h2>
                      <Link href={`/producto/${product.slug}`}>
                        {product.name}
                      </Link>
                    </h2>
                    <p>{variant.label} · Ejemplo</p>
                    <p>{formatCOP(variant.price)} COP</p>
                    <div className="quantity">
                      <button
                        aria-label={`Reducir cantidad de ${product.name} ${variant.label}`}
                        onClick={() =>
                          setQuantity(variant.id, line.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <span aria-label="Cantidad">{line.quantity}</span>
                      <button
                        aria-label={`Aumentar cantidad de ${product.name} ${variant.label}`}
                        disabled={line.quantity >= variant.stock}
                        onClick={() =>
                          setQuantity(variant.id, line.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setQuantity(variant.id, 0)}
                    >
                      Eliminar
                    </button>
                  </div>
                  <strong className="line-total">
                    {formatCOP(variant.price * line.quantity)}
                  </strong>
                </article>
              );
            })}
          </div>
          <aside className="order-summary">
            <p className="eyebrow">Resumen</p>
            <h2>Tu selección</h2>
            <div>
              <span>Subtotal</span>
              <strong>{formatCOP(cartSubtotal(cart))}</strong>
            </div>
            <div>
              <span>Envío</span>
              <span>Por definir</span>
            </div>
            <div>
              <span>Total final</span>
              <span>Pendiente</span>
            </div>
            <p className="notice">
              Esta bolsa es de ejemplo. Todavía no genera pedidos, reservas de
              inventario ni cobros.
            </p>
            <Link href="/catalogo" className="button secondary">
              Seguir explorando
            </Link>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <h2>Tu bolsa espera algo especial.</h2>
          <p>Explora las piezas y elige la variante que prefieras.</p>
          <Link href="/catalogo" className="button">
            Descubrir la colección
          </Link>
        </div>
      )}
    </main>
  );
}
