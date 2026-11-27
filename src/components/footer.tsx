import Link from "next/link";
import Image from "next/image";
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Image
            src="/brand/sj-aurum.png"
            alt="SJ AURUM"
            width={1774}
            height={887}
            className="footer-logo"
          />
          <p>El brillo que te distingue.</p>
          <p className="muted">
            Joyería y accesorios de oro laminado.
            <br />
            Colombia.
          </p>
        </div>
        <div>
          <h3>Explora</h3>
          <Link href="/catalogo">Todas las piezas</Link>
          <Link href="/favoritos">Tus favoritos</Link>
          <Link href="/pedidos">Pedidos de prueba</Link>
          <Link href="/cuenta">Mi cuenta</Link>
          <Link href="/nosotros">La esencia AURUM</Link>
        </div>
        <div>
          <h3>Información</h3>
          <Link href="/informacion/envios">Envíos</Link>
          <Link href="/informacion/garantias">Garantías y cuidados</Link>
          <Link href="/informacion/privacidad">Privacidad</Link>
          <Link href="/informacion/terminos">Términos de compra</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        © {new Date().getFullYear()} SJ AURUM. Versión de ejemplo, sin ventas
        habilitadas.
      </div>
    </footer>
  );
}
