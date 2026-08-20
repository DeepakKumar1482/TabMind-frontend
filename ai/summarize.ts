import { getSummarizer } from "./pipelines";

const MIN_CONTENT_LENGTH = 200; // shorter pages aren't worth summarizing

export async function summarize(content: string): Promise<string | undefined> {
  const text = content.trim();
  if (text.length < MIN_CONTENT_LENGTH) return undefined;

  const summarizer = await getSummarizer();
  const [result] = await summarizer(text.slice(0, 4000), {
    max_new_tokens: 100,
    min_new_tokens: 20,
  });
  return (result as { summary_text: string }).summary_text.trim();
}
