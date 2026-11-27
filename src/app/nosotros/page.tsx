import Link from "next/link";
export const metadata = { title: "La esencia AURUM" };
export default function Page() {
  return (
    <main id="contenido" className="container prose page">
      <p className="eyebrow">SJ AURUM · Colombia</p>
      <h1>El brillo que te distingue.</h1>
      <p className="page-intro">
        Una marca de joyería y accesorios de oro laminado, con una mirada
        elegante, moderna y cercana.
      </p>
      <p>
        Creemos en los detalles que expresan tu personalidad. En las piezas que
        eliges por cómo te hacen sentir y en las combinaciones que se vuelven
        parte de tu estilo.
      </p>
      <p>
        Estamos construyendo nuestra tienda. La selección que ves es
        ilustrativa; el catálogo comercial y sus fichas se publicarán cuando
        estén verificados.
      </p>
      <Link href="/catalogo" className="button">
        Explorar la selección
      </Link>
    </main>
  );
}
