import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  metadataBase: new URL("https://africa-fantasy-club.vercel.app"),
  title: "Africa Fantasy",
  description: "The home for football, cricket and rugby predictions and fantasy gaming across Africa",
  openGraph: {
    title: "Africa Fantasy",
    description: "The home for football, cricket and rugby predictions and fantasy gaming across Africa",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
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
