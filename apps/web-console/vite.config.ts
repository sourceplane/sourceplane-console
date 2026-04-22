import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@sourceplane/ui": fileURLToPath(new URL("../../packages/ui/src/index.tsx", import.meta.url))
    }
  },
  server: {
    host: "127.0.0.1",
    port: 4173
  }
});
