import { Catalog } from "@/components/catalog";
export const metadata = { title: "Colección" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Encuentra tu forma de brillar</p>
      <h1>La colección AURUM</h1>
      <p className="page-intro">Formas que inspiran. Detalles que acompañan.</p>
      <Catalog key={categoria ?? "all"} initialCategory={categoria} />
    </main>
  );
}
