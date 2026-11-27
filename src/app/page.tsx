import Image from "next/image";
import Link from "next/link";
import { products, categories } from "@/modules/catalog/products";
import { ProductCard } from "@/components/product-card";

export default function Home() {
  return (
    <main id="contenido">
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">SJ AURUM · Oro laminado</p>
          <h1>
            El brillo que
            <br />
            te distingue.
          </h1>
          <p>
            Pequeños detalles.
            <br />
            Una forma muy tuya de brillar.
          </p>
          <Link href="/catalogo" className="button">
            Explorar la colección
          </Link>
          <span className="hero-caption">
            Una selección de ejemplo para descubrir la experiencia AURUM.
          </span>
        </div>
        <div className="hero-photo">
          <Image
            src="/images/hero.jpg"
            alt="Fotografía editorial de referencia: joyería en tonos dorados"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 60vw"
          />
          <span className="photo-credit">Imagen de referencia · Stitch</span>
        </div>
      </section>
      <div className="brand-values container">
        <span>Diseños para expresar tu estilo</span>
        <span>Oro laminado · SJ AURUM</span>
        <span>Una colección por descubrir</span>
      </div>
      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Encuentra tu próxima pieza</p>
            <h2>Un detalle para cada estilo</h2>
          </div>
          <Link href="/catalogo" className="text-link">
            Ver colección
          </Link>
        </div>
        <div className="category-list">
          {categories.map((c) => (
            <Link key={c} href={`/catalogo?categoria=${encodeURIComponent(c)}`}>
              {c}
            </Link>
          ))}
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">La selección AURUM</p>
            <h2>Piezas que hablan de ti</h2>
          </div>
          <span className="muted">Catálogo de ejemplo</span>
        </div>
        <div className="product-grid">
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="editorial container">
        <div className="editorial-photo">
          <Image
            src="/images/product-4.jpg"
            alt="Candongas doradas sobre una tela marfil, imagen de ejemplo"
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </div>
        <div className="editorial-copy">
          <p className="eyebrow">La esencia de SJ AURUM</p>
          <h2>
            La elegancia está
            <br />
            en los detalles.
          </h2>
          <p>
            Joyas para acompañar tu expresión personal. Descubre formas,
            texturas y combinaciones que conectan contigo.
          </p>
          <Link href="/nosotros" className="button secondary">
            Conoce nuestra esencia
          </Link>
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Sigue explorando</p>
            <h2>Completa tu estilo</h2>
          </div>
          <Link href="/catalogo" className="text-link">
            Todas las piezas
          </Link>
        </div>
        <div className="product-grid">
          {products.slice(2).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </main>
  );
}
