import { ImageResponse } from "next/og";

/**
 * The app's icon, rendered rather than committed as a binary: it's a wordmark
 * glyph, cheaper to describe than to store, and it stays in step with the
 * palette. Hex, not the oklch custom properties from `globals.css` — this
 * renders outside the document, so there are no CSS variables to resolve.
 *
 * Single source for every size the app serves: the browser tab (`icon.tsx`),
 * the iOS home screen (`apple-icon.tsx`) and the three the web manifest points
 * at (`icon-192.png/`, `icon-512.png/`, `icon-maskable-512.png/`).
 */
export const INK = "#171a19";
export const JADE = "#3f8f74";

interface AppIconOptions {
  size: number;
  /**
   * Android applies its own mask (circle, squircle, teardrop…) and only the
   * inner 80% of the image is guaranteed to survive it. A maskable icon must
   * therefore bleed its background to all four edges — no rounded corners of
   * its own — and keep the glyph well inside that safe zone. Rendering the
   * normal icon as maskable would get its corners shaved off.
   */
  maskable?: boolean;
}

export function renderAppIcon({ size, maskable = false }: AppIconOptions): ImageResponse {
  // The glyph fills ~69% of a plain icon, but only ~45% of a maskable one so it
  // stays inside the 80% safe zone with room to spare.
  const fontSize = Math.round(size * (maskable ? 0.45 : 0.69));

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
          color: JADE,
          // Serif, echoing the Fraunces used for headlines and monetary figures.
          fontFamily: "Georgia, serif",
          fontSize,
          fontWeight: 700,
          // Only the small favicon gets rounded corners of its own; at home-screen
          // sizes both iOS and Android round (or mask) the icon themselves.
          borderRadius: size <= 32 ? Math.round(size * 0.22) : 0,
        }}
      >
        $
      </div>
    ),
    { width: size, height: size }
  );
}
