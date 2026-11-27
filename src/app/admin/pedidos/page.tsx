import Link from "next/link";
import { authToken } from "@/lib/auth-http";
import { requireAdmin } from "@/modules/auth/service";
import { CommerceError } from "@/modules/commerce/service";
import { OrdersWorkspace } from "@/components/admin/orders-workspace";
export const metadata = { title: "Administración de pedidos" };
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
      <h1>Pedidos</h1>
      <nav className="admin-toolbar" aria-label="Administración">
        <Link href="/admin">Catálogo e inventario</Link>
        <Link href="/admin/pedidos" aria-current="page">
          Pedidos
        </Link>
        <Link href="/admin/biblioteca">Fotografías y colecciones</Link>
      </nav>
      <p className="notice">
        Pedidos de ejemplo, sin pagos ni despachos. El seguimiento es interno y
        no envía avisos al cliente. Las reservas vencen a los 15 minutos.
      </p>
      <OrdersWorkspace />
    </main>
  );
}
