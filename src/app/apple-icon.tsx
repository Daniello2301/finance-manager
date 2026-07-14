import { renderAppIcon } from "@/lib/app-icon";

// iOS doesn't accept SVG for home-screen icons, and it does not round the
// corners for you at this size — hence a separate 180px PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon({ size: 180 });
}
