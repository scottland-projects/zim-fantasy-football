import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Africa Fantasy",
    short_name: "Africa Fantasy",
    description: "Predict match results or build a fantasy squad across football, cricket, and rugby. Compete with fans nationwide.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#15803D",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
