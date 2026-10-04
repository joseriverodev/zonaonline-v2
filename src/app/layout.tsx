import type { Metadata, Viewport } from "next";
import { Poppins, Playfair_Display, Great_Vibes } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const script = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "ZonaOnlineVzla - Tu tienda de variedades",
  description: "Tu tienda online de confianza. Descubre nuestra amplia selección de productos de calidad a precios increíbles. Entregas personales en Caracas, delivery y envíos a nivel nacional.",
  keywords: ["ZonaOnline", "tienda online", "compras", "variedades", "delivery", "productos"],
  authors: [{ name: "ZonaOnlineVzla" }],
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    title: "ZonaOnlineVzla - Tu tienda de variedades",
    description: "Todo lo que necesitas, directo a ti. Entregas personales en Caracas, delivery y envíos a nivel nacional.",
    type: "website",
    locale: "es_VE",
  },
};

export const viewport: Viewport = {
  themeColor: "#0284C7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${playfair.variable} ${script.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}