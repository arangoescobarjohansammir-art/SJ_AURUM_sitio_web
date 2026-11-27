import type { Metadata } from "next";
import "@fontsource/playfair-display/latin-500.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SJ AURUM · El brillo que te distingue", template: "%s | SJ AURUM" },
  description: "SJ AURUM. Joyería y accesorios de oro laminado en Colombia.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CO"><body><a className="skip-link" href="#contenido">Saltar al contenido</a>{children}</body></html>;
}
