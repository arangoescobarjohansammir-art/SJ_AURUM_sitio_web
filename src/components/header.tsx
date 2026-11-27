"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShop } from "./shop-provider";
import { Icon } from "./icon";
export function Header() {
  const { cart } = useShop();
  const path = usePathname();
  const count = cart.reduce((n, l) => n + l.quantity, 0);
  return (
    <>
      <div className="demo-ribbon">
        Vista de ejemplo · Productos y precios ilustrativos · Compras no
        habilitadas
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="SJ AURUM, inicio">
            <Image
              src="/brand/sj-aurum.png"
              width={1774}
              height={887}
              alt="SJ AURUM · El brillo que te distingue"
              priority
            />
          </Link>
          <nav className="desktop-nav" aria-label="Navegación principal">
            <Link href="/" aria-current={path === "/" ? "page" : undefined}>
              Inicio
            </Link>
            <Link
              href="/catalogo"
              aria-current={path === "/catalogo" ? "page" : undefined}
            >
              Colección
            </Link>
            <Link href="/nosotros">La esencia AURUM</Link>
            <Link href="/cuenta">Mi cuenta</Link>
          </nav>
          <div className="header-actions">
            <Link
              href="/catalogo#buscar"
              className="icon-button"
              aria-label="Buscar joyas"
            >
              <Icon name="search" />
            </Link>
            <Link
              href="/favoritos"
              className="icon-button desktop-favorite"
              aria-label="Mis favoritos"
            >
              <Icon name="heart" />
            </Link>
            <Link
              href="/bolsa"
              className="icon-button bag-link"
              aria-label={`Bolsa, ${count} piezas`}
            >
              <Icon name="bag" />
              {count > 0 && <span className="count">{count}</span>}
            </Link>
          </div>
        </div>
      </header>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {(
          [
            { href: "/", icon: "home", label: "Inicio" },
            { href: "/catalogo", icon: "diamond", label: "Catálogo" },
            { href: "/favoritos", icon: "heart", label: "Favoritos" },
            { href: "/bolsa", icon: "bag", label: "Bolsa" },
            { href: "/cuenta", icon: "user", label: "Cuenta" },
          ] as const
        ).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={path === item.href ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
