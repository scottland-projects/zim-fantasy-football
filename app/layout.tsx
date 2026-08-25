import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Africa Fantasy",
  description: "The home for football, cricket and rugby predictions and fantasy gaming across Zimbabwe",
  openGraph: {
    title: "Africa Fantasy",
    description: "The home for football, cricket and rugby predictions and fantasy gaming across Zimbabwe",
    // TODO: add a real og-image.png (1200x630) to public/ before launch —
    // intentionally omitted rather than pointing at a placeholder asset.
  },
  // iOS ignores app/manifest.ts for home-screen behaviour — it needs its
  // own apple-mobile-web-app-* meta tags to launch standalone (no Safari
  // chrome) instead of just opening a bookmark in the browser.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Africa Fantasy",
  },
};

export const viewport: Viewport = {
  themeColor: "#15803D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
