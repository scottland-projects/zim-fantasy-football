import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Original mark for Zim Fantasy Football — generated at build time so no
// binary asset (and no risk of a copied crest) ships in the repo.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15803D",
          borderRadius: "50%",
          border: "3px solid #CA8A04",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Impact, sans-serif",
            fontSize: 26,
            letterSpacing: 1,
            color: "#FFFFFF",
          }}
        >
          ZFF
        </div>
      </div>
    ),
    { ...size }
  );
}
