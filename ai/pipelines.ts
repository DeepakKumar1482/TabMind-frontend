import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

// Dashboard-only module (runs in the extension's dashboard tab, not the
// service worker) — model is fetched from the HF CDN on first use and
// cached by the browser, then runs fully on-device via WASM/WebGPU.
// Only the embedder stays local (semantic search); summarization/tags are
// proxied through the backend to Gemini — see gemini.ts.
env.allowLocalModels = false;

let embedder: FeatureExtractionPipeline | null = null;

export async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}
