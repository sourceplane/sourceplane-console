import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const workspaceAliases = {
  "@sourceplane/ui": fileURLToPath(new URL("../../packages/ui/src/index.tsx", import.meta.url)),
  "@sourceplane/sdk": fileURLToPath(new URL("../../packages/sdk/src/index.ts", import.meta.url)),
  "@sourceplane/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)),
  "@sourceplane/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: workspaceAliases
  },
  server: {
    host: "127.0.0.1",
    port: 4173
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"]
  }
});

