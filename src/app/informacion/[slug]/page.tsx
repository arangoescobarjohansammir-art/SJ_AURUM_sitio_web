import { notFound } from "next/navigation";
const pages: Record<string, { title: string; paragraphs: string[] }> = {
  envios: {
    title: "Envíos",
    paragraphs: [
      "Borrador de ejemplo. La cobertura, tarifas, transportadoras, tiempos estimados y procedimiento de novedades deben ser definidos por SJ AURUM antes de habilitar compras.",
      "La versión actual no calcula un envío real ni solicita recolecciones. No se ofrece envío gratuito o asegurado sin condiciones comerciales verificadas.",
    ],
  },
  garantias: {
    title: "Garantías y cuidados",
    paragraphs: [
      "Borrador de ejemplo. Las condiciones, duración, productos cubiertos y procedimiento de reclamación están pendientes de definición y revisión.",
      "No se certifica resistencia al agua, ausencia de alérgenos, quilataje ni espesor a partir de las imágenes. Los cuidados deben corresponder a las fichas del proveedor de cada pieza.",
    ],
  },
  privacidad: {
    title: "Privacidad",
    paragraphs: [
      "Borrador de ejemplo, pendiente de revisión. Deben definirse el responsable del tratamiento, datos de contacto, finalidades, derechos, conservación y canales de solicitudes antes de recopilar datos de clientes.",
      "Esta versión guarda únicamente identificadores de productos, favoritos y cantidades en el almacenamiento local del navegador para conservar tu selección. No tiene registro de clientes, formularios de entrega ni analítica comercial.",
    ],
  },
  terminos: {
    title: "Términos de compra",
    paragraphs: [
      "Borrador de ejemplo. Esta versión no constituye una tienda habilitada para ventas: los productos, precios, medidas y existencias son ilustrativos.",
      "Antes del lanzamiento deben publicarse los datos empresariales y condiciones aprobadas sobre impuestos, compra, entrega, cambios, devoluciones, retracto y atención al consumidor. Estas notas no sustituyen una revisión jurídica.",
    ],
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: pages[slug]?.title ?? "Información" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = pages[slug];
  if (!content) notFound();
  return (
    <main id="contenido" className="container prose page">
      <p className="eyebrow">Información SJ AURUM</p>
      <h1>{content.title}</h1>
      <p className="notice">
        Pendiente de aprobación comercial. No es una política vigente.
      </p>
      {content.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </main>
  );
}
