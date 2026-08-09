import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./extension/manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  root: "extension",
  build: {
    outDir: "../dist-extension",
    emptyOutDir: true,
  },
});
