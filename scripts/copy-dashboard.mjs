import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const src = new URL("../out", import.meta.url);
const dest = new URL("../dist-extension/dashboard", import.meta.url);

if (!existsSync(src)) {
  console.error("Missing out/ — run `next build` first.");
  process.exit(1);
}

await rm(dest, { recursive: true, force: true });
await cp(src, dest, { recursive: true });
console.log("Copied Next.js static export into dist-extension/dashboard");
