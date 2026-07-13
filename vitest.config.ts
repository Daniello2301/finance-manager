import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/lib/test-utils/**",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "src/components/ui/**",
        // Thin NextAuth wiring, validated end-to-end against the real dev
        // server + Atlas instead of unit tests (see .speckit/plans/authentication.md).
        "src/lib/auth.ts",
        "src/app/api/auth/\\[...nextauth\\]/route.ts",
      ],
    },
    projects: [
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "component",
          environment: "jsdom",
          setupFiles: ["./vitest-setup.ts"],
          include: ["src/**/*.test.tsx"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "node",
          environment: "node",
          // Every plain .test.ts file (never JSX) lands here — component
          // tests always end in .test.tsx and are picked up by the
          // "component" project above instead.
          include: ["src/**/*.test.ts"],
          testTimeout: 30000,
          hookTimeout: 45000,
          // Each file boots its own mongodb-memory-server (~9-10s on this
          // Windows machine). Running files in parallel launches several
          // mongod processes at once and starves them all past the launch
          // timeout, so they run one at a time here instead.
          fileParallelism: false,
        },
      },
    ],
  },
});
