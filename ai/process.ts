import type { Page } from "../shared/types";
import { embed } from "./embeddings";

export interface ProcessedPageFields {
  embedding: number[];
}

// Only embedding is generated locally now — summarization/auto-tags were
// dropped (not worth the model weight/latency for what they added). Called
// lazily by the dashboard for pages that haven't been processed yet — never
// in the extension's background service worker (needs a full window/WASM
// context, too heavy to run on every capture).
export async function processPage(page: Page): Promise<ProcessedPageFields> {
  const text = `${page.title}\n\n${page.content}`;
  const embedding = await embed(text);
  return { embedding };
}
