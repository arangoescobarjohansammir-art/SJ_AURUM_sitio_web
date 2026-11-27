import Image from "next/image";

export default function Home() {
  return <main id="contenido" className="foundation">
    <Image src="/brand/sj-aurum.png" alt="SJ AURUM · El brillo que te distingue" width={1800} height={900} priority />
    <p className="eyebrow">SJ AURUM · Colombia</p>
    <h1>El brillo que te distingue.</h1>
    <p>Joyería y accesorios de oro laminado.</p>
    <p className="notice">Estamos preparando nuestra tienda. Las compras todavía no están habilitadas.</p>
  </main>;
}
