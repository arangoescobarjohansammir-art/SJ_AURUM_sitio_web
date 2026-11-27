import Link from "next/link";
export default function NotFound() {
  return (
    <main id="contenido" className="container empty-state">
      <p className="eyebrow">SJ AURUM</p>
      <h1>No encontramos esta página.</h1>
      <Link href="/catalogo" className="button">
        Volver a la colección
      </Link>
    </main>
  );
}
