import "./globals.css";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import { CartProvider } from "@/components/cart/CartContext";
import CartToast from "@/components/cart/CartToast";
import { getSiteUrl } from "@/lib/siteUrl";

export const metadata: Metadata = {
  title: "Papelaria Felicio",
  description: "Papelaria bonita, pratica e feita com carinho.",
  metadataBase: new URL(getSiteUrl()),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Papelaria Felicio",
    description: "Papelaria bonita, pratica e feita com carinho.",
    url: getSiteUrl(),
    siteName: "Papelaria Felicio",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="site-shell min-h-screen">
        <div className="vinheta-lateral" />

        <div className="min-h-screen">
          <CartProvider>
            <CartToast />
            <Header />
            <WhatsAppFloat />
            <main className="relative z-10 py-10">{children}</main>
            <Footer />
          </CartProvider>
        </div>
      </body>
    </html>
  );
}
