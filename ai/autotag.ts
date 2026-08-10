import { getClassifier } from "./pipelines";

const CANDIDATE_LABELS = [
  "documentation",
  "news",
  "shopping",
  "social media",
  "video",
  "research paper",
  "code / developer tool",
  "finance",
  "travel",
  "entertainment",
  "email / productivity",
  "tutorial",
];

const SCORE_THRESHOLD = 0.3;
const MAX_TAGS = 3;

export async function autoTag(text: string): Promise<string[]> {
  if (!text.trim()) return [];
  const classifier = await getClassifier();
  const output = await classifier(text.slice(0, 1000), CANDIDATE_LABELS, { multi_label: true });
  const { labels, scores } = output as { labels: string[]; scores: number[] };
  return labels.filter((_, i) => scores[i] >= SCORE_THRESHOLD).slice(0, MAX_TAGS);
}
