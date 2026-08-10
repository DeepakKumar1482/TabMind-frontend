import type { Page } from "../shared/types";
import { embed, cosineSimilarity } from "./embeddings";

export interface SearchResult {
  page: Page;
  score: number;
}

const MIN_SCORE = 0.2;

export async function semanticSearch(query: string, pages: Page[]): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const queryEmbedding = await embed(q);
  return pages
    .filter((p): p is Page & { embedding: number[] } => Array.isArray(p.embedding))
    .map((page) => ({ page, score: cosineSimilarity(queryEmbedding, page.embedding) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
}
