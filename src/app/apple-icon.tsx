import { ImageResponse } from "next/og";

// iOS doesn't accept SVG for home-screen icons, and it does not round the
// corners for you at this size — hence a separate 180px PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const INK = "#171a19";
const JADE = "#3f8f74";

export default function AppleIcon() {
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
          fontFamily: "Georgia, serif",
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        $
      </div>
    ),
    size
  );
}
