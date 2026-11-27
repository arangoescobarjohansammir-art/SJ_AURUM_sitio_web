import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/modules/commerce/service";
import { ProductDetail } from "@/components/product-detail";
import { ProductCard } from "@/components/product-card";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await catalog();
  return {
    title: products.find((p) => p.slug === slug)?.name ?? "Pieza no encontrada",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await catalog();
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();
  return (
    <main id="contenido" className="container page">
      <nav className="breadcrumb" aria-label="Ubicación">
        <Link href="/catalogo">Colección</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <ProductDetail product={product} />
      <section className="section">
        <p className="eyebrow">Un estilo que se complementa</p>
        <h2>También puedes descubrir</h2>
        <div className="product-grid">
          {products
            .filter((p) => p.id !== product.id)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
    </main>
  );
}
