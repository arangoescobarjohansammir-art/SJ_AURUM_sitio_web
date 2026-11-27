"use client";
import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/modules/catalog/products";
import { formatCOP } from "@/lib/money";
import { useShop } from "./shop-provider";
import { Icon } from "./icon";
export function ProductDetail({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants[0].id),
    [photo, setPhoto] = useState(product.image);
  const variant = product.variants.find((v) => v.id === variantId)!;
  const { add, ready, busy, favorites, toggleFavorite } = useShop();
  return (
    <div className="detail-grid">
      <div>
        <div className="detail-photo">
          <Image
            src={photo}
            alt={`${product.name}, imagen de ejemplo`}
            fill
            priority
            sizes="(max-width: 760px) 100vw, 55vw"
          />
        </div>
        {product.gallery.length > 1 && (
          <div className="thumbnails">
            {product.gallery.map((url, i) => (
              <button
                key={url}
                aria-label={`Ver fotografía ${i + 1}`}
                aria-pressed={photo === url}
                onClick={() => setPhoto(url)}
              >
                <Image src={url} width={100} height={100} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="detail-copy">
        <p className="eyebrow">SJ AURUM · {product.category}</p>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <p className="detail-price">
          {formatCOP(variant.price)} <small>COP</small>
        </p>
        <p className="muted">
          Producto, precio, medidas y existencias de ejemplo.
        </p>
        <fieldset className="variants">
          <legend>Elige tu variante</legend>
          {product.variants.map((v) => (
            <button
              key={v.id}
              className={variantId === v.id ? "selected" : ""}
              aria-pressed={variantId === v.id}
              onClick={() => setVariantId(v.id)}
            >
              {v.label}
              {v.stock === 0 && <small>Agotada</small>}
            </button>
          ))}
        </fieldset>
        <p className="stock">
          {variant.stock > 0
            ? `${variant.stock} unidades de ejemplo disponibles`
            : "Esta variante está agotada"}
        </p>
        <div className="detail-actions">
          <button
            className="button"
            disabled={!ready || busy || variant.stock === 0}
            onClick={() => add(variant.id)}
          >
            Agregar a la bolsa
          </button>
          <button
            className="icon-button bordered"
            disabled={!ready}
            aria-pressed={favorites.includes(product.id)}
            aria-label="Guardar en favoritos"
            onClick={() => toggleFavorite(product.id)}
          >
            <Icon name="heart" />
          </button>
        </div>
        <div className="accordions">
          <details>
            <summary>Materiales y características</summary>
            <p>
              La ficha técnica comercial está pendiente. Esta imagen no
              certifica materiales, quilataje, espesor, composición ni
              resistencia. SJ AURUM comercializa oro laminado; no debe
              confundirse con oro macizo.
            </p>
          </details>
          <details>
            <summary>Cómo elegir tu medida</summary>
            <p>
              Usa una cinta flexible para comparar el largo con una pieza que ya
              tengas. Las medidas mostradas son ejemplos; la guía específica
              deberá validarse con el catálogo real.
            </p>
          </details>
          <details>
            <summary>Envíos y garantía</summary>
            <p>
              Las tarifas, cobertura, plazos y condiciones de garantía están por
              definir. No hay compras habilitadas ni promesas comerciales
              vigentes en esta versión.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
