import Link from "next/link";
import { authToken } from "@/lib/auth-http";
import { requireAdmin } from "@/modules/auth/service";
import { CommerceError } from "@/modules/commerce/service";
import { CatalogLibrary } from "@/components/admin/catalog-library";
export const metadata = { title: "Fotografías y colecciones" };
export default async function Page() {
  try {
    await requireAdmin(await authToken());
  } catch (e) {
    if (!(e instanceof CommerceError)) throw e;
    return (
      <main id="contenido" className="container page">
        <h1>Acceso restringido</h1>
        <p>Necesitas una cuenta administradora activa y verificada.</p>
        <Link className="button" href="/cuenta">
          Ir a mi cuenta
        </Link>
      </main>
    );
  }
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Gestión de SJ AURUM</p>
      <h1>Fotografías y colecciones</h1>
      <nav className="admin-toolbar" aria-label="Administración">
        <Link href="/admin">Catálogo e inventario</Link>
        <Link href="/admin/pedidos">Pedidos</Link>
        <Link href="/admin/biblioteca" aria-current="page">
          Fotografías y colecciones
        </Link>
      </nav>
      <p className="notice">
        Catálogo de ejemplo. Prepara aquí fotografías y colecciones; los pagos
        siguen deshabilitados.
      </p>
      <CatalogLibrary />
    </main>
  );
}
