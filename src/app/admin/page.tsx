import Link from "next/link";
import { authToken } from "@/lib/auth-http";
import { requireAdmin } from "@/modules/auth/service";
import { CommerceError } from "@/modules/commerce/service";
import { AdminWorkspace } from "@/components/admin/workspace";
export const metadata = { title: "Administración" };
export default async function Page() {
  try {
    await requireAdmin(await authToken());
  } catch (error) {
    if (!(error instanceof CommerceError)) throw error;
    return (
      <main id="contenido" className="container page">
        <p className="eyebrow">Acceso restringido</p>
        <h1>Administración</h1>
        <p className="notice">
          Necesitas una cuenta administradora activa con correo verificado. El
          registro normal crea cuentas de cliente.
        </p>
        <Link className="button" href="/cuenta">
          Ir a mi cuenta
        </Link>
      </main>
    );
  }
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Gestión de SJ AURUM</p>
      <h1>Catálogo e inventario</h1>
      <nav className="admin-toolbar" aria-label="Administración">
        <Link href="/admin/envios">Envíos y cobertura</Link>
        <Link href="/admin" aria-current="page">
          Catálogo e inventario
        </Link>
        <Link href="/admin/pedidos">Pedidos</Link>
        <Link href="/admin/biblioteca">Fotografías y colecciones</Link>
      </nav>
      <p className="notice">
        Entorno de desarrollo. Los cambios afectan al catálogo de ejemplo. Cada
        modificación conserva autor, motivo y valores anteriores. No hay ventas
        reales habilitadas.
      </p>
      <AdminWorkspace />
    </main>
  );
}
