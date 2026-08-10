import {
  pipeline,
  env,
  type FeatureExtractionPipeline,
  type SummarizationPipeline,
  type ZeroShotClassificationPipeline,
} from "@xenova/transformers";

// Dashboard-only module (runs in the extension's dashboard tab, not the
// service worker) — models are fetched from the HF CDN on first use and
// cached by the browser, then run fully on-device via WASM/WebGPU.
env.allowLocalModels = false;

let embedder: FeatureExtractionPipeline | null = null;
let summarizer: SummarizationPipeline | null = null;
let classifier: ZeroShotClassificationPipeline | null = null;

export async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

export async function getSummarizer(): Promise<SummarizationPipeline> {
  if (!summarizer) {
    summarizer = await pipeline("summarization", "Xenova/distilbart-cnn-6-6");
  }
  return summarizer;
}

export async function getClassifier(): Promise<ZeroShotClassificationPipeline> {
  if (!classifier) {
    classifier = await pipeline("zero-shot-classification", "Xenova/nli-deberta-v3-xsmall");
  }
  return classifier;
}
