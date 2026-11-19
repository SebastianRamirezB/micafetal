import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Cafetal",
  description:
    "Riesgo de roya y broca en su finca esta semana, el clima y sus reportes, también sin señal.",
};

export const viewport: Viewport = {
  themeColor: "#2f6b3a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
