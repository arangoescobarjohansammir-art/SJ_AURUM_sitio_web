"use client";
import Link from "next/link";
import { useShop } from "@/components/shop-provider";
import { ProductCard } from "@/components/product-card";
import { products } from "@/modules/catalog/products";
export default function Page() {
  const { favorites, ready } = useShop();
  const selected = products.filter((p) => favorites.includes(p.id));
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Tu selección personal</p>
      <h1>Tus favoritos</h1>
      {!ready ? (
        <p role="status">Cargando tus favoritos…</p>
      ) : selected.length ? (
        <div className="product-grid">
          {selected.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Guarda las piezas que te inspiran.</h2>
          <p>Toca el corazón de una joya para encontrarla aquí.</p>
          <Link className="button" href="/catalogo">
            Explorar la colección
          </Link>
        </div>
      )}
    </main>
  );
}
