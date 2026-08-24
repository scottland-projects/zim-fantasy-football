import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Africa Fantasy",
  description: "The premier fantasy football platform for football fans across Zimbabwe",
  openGraph: {
    title: "Africa Fantasy",
    description: "The premier fantasy football platform for football fans across Zimbabwe",
    // TODO: add a real og-image.png (1200x630) to public/ before launch —
    // intentionally omitted rather than pointing at a placeholder asset.
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
