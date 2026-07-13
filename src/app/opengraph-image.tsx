import { ImageResponse } from "next/og";

// What people see when the app's link is shared. Without it, a shared link
// renders as a bare title with no image.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Finanzas Personales — tu dinero, con claridad total.";

const INK = "#171a19";
const MIST = "#f4f5f3";
const JADE = "#3f8f74";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: INK,
          padding: 80,
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", color: JADE, fontSize: 96 }}>$</div>
        <div
          style={{
            display: "flex",
            color: MIST,
            fontSize: 72,
            marginTop: 24,
          }}
        >
          Tu dinero, con claridad total.
        </div>
        <div
          style={{
            display: "flex",
            color: JADE,
            fontSize: 32,
            marginTop: 24,
          }}
        >
          Finanzas Personales
        </div>
      </div>
    ),
    size
  );
}
