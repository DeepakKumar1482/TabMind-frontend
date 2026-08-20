import type { Page } from "../shared/types";
import { embed } from "./embeddings";
import { summarize } from "./summarize";
import { autoTag } from "./autotag";

export interface ProcessedPageFields {
  summary?: string;
  embedding: number[];
  tags: string[];
}

// Runs all three local models against one page's extracted text. Called
// lazily by the dashboard for pages that haven't been processed yet —
// never in the extension's background service worker (models need a full
// window/WASM-friendly context and are too heavy to run on every capture).
export async function processPage(page: Page): Promise<ProcessedPageFields> {
  const text = `${page.title}\n\n${page.content}`;
  const [summary, embedding, tags] = await Promise.all([
    summarize(page.content),
    embed(text),
    autoTag(text),
  ]);
  return { summary, embedding, tags };
}
