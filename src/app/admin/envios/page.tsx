import Link from "next/link";
import { authToken } from "@/lib/auth-http";
import { requireAdmin } from "@/modules/auth/service";
import { CommerceError } from "@/modules/commerce/service";
import { ShippingWorkspace } from "@/components/admin/shipping-workspace";
export const metadata = { title: "Administración de envíos" };
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
      <h1>Envíos</h1>
      <nav className="admin-toolbar" aria-label="Administración">
        <Link href="/admin/envios">Envíos y cobertura</Link>
        <Link href="/admin">Catálogo e inventario</Link>
        <Link href="/admin/pedidos">Pedidos</Link>
        <Link href="/admin/biblioteca">Fotografías y colecciones</Link>
      </nav>
      <p className="notice">
        Cobertura, transportadora, tarifas y plazos de ejemplo. No hay contrato
        ni conexión automática con una transportadora. Los plazos cuentan desde
        el despacho.
      </p>
      <ShippingWorkspace />
    </main>
  );
}
