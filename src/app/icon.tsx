import { ImageResponse } from "next/og";

// Generated rather than committed as a binary: the icon is a wordmark glyph, so
// it's cheaper to describe than to store, and it stays in step with the app's
// palette. Hex, not the oklch custom properties from globals.css — this renders
// outside the document, so there are no CSS variables to resolve.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const INK = "#171a19";
const JADE = "#3f8f74";

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
          background: INK,
          borderRadius: 7,
          color: JADE,
          // Serif, echoing the Fraunces used for headlines and monetary figures.
          fontFamily: "Georgia, serif",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        $
      </div>
    ),
    size
  );
}
