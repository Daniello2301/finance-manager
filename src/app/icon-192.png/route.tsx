import { renderAppIcon } from "@/lib/app-icon";

// A Route Handler rather than another `icon.tsx`, because the web manifest has
// to point at a stable URL — Next serves the `icon`/`apple-icon` file
// conventions from hashed paths (`/icon?<hash>`) that nothing else can predict.
export const dynamic = "force-static";

export function GET() {
  return renderAppIcon({ size: 192 });
}
