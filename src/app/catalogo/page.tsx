import { getDb } from "@/lib/db";
import { Catalog } from "@/components/catalog";
export const metadata = { title: "Colección" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; coleccion?: string }>;
}) {
  const { categoria, coleccion } = await searchParams;
  const collections = await getDb().collection.findMany({
    where: { active: true },
    select: { id: true, name: true, slug: true, description: true },
    orderBy: { name: "asc" },
  });
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Encuentra tu forma de brillar</p>
      <h1>La colección AURUM</h1>
      <p className="page-intro">Formas que inspiran. Detalles que acompañan.</p>
      <Catalog
        key={(categoria ?? "all") + ":" + (coleccion ?? "all")}
        initialCategory={categoria}
        initialCollection={coleccion}
        collections={collections}
      />
    </main>
  );
}
