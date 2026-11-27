"use client";
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/modules/catalog/products";
import { formatCOP } from "@/lib/money";
import { useShop } from "./shop-provider";
import { Icon } from "./icon";
export function ProductCard({ product }: { product: Product }) {
  const { favorites, toggleFavorite, ready } = useShop();
  const saved = favorites.includes(product.id);
  return (
    <article className="product-card">
      <div className="product-image">
        <Link
          href={`/producto/${product.slug}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <Image
            src={product.image}
            alt=""
            fill
            sizes="(max-width: 600px) 46vw, (max-width: 1000px) 30vw, 300px"
          />
        </Link>
        <button
          className={`favorite-button ${saved ? "is-saved" : ""}`}
          aria-label={`${saved ? "Quitar" : "Guardar"} ${product.name} en favoritos`}
          aria-pressed={saved}
          disabled={!ready}
          onClick={() => toggleFavorite(product.id)}
        >
          <Icon name="heart" size={20} />
        </button>
        <span className="image-label">Ejemplo</span>
      </div>
      <div className="product-copy">
        <p className="eyebrow">{product.category}</p>
        <h3>
          <Link href={`/producto/${product.slug}`}>{product.name}</Link>
        </h3>
        <div className="product-price">
          <span>
            {formatCOP(product.variants[0].price)} <small>COP</small>
          </span>
          <Link
            href={`/producto/${product.slug}`}
            className="icon-button"
            aria-label={`Elegir variante de ${product.name}`}
          >
            <Icon name="bag" size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}
