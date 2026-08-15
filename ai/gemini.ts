const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

export interface GeminiResult {
  summary?: string;
  tags: string[];
}

// Summarization/auto-tags are proxied through the backend (POST /api/ai/process)
// so the Gemini API key stays server-side only — it must never end up in this
// extension's bundled JS, which anyone can unpack and read.
export async function processWithGemini(title: string, content: string): Promise<GeminiResult> {
  const res = await fetch(`${BACKEND_URL}/api/ai/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) {
    throw new Error(`Gemini proxy failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { summary: data.summary ?? undefined, tags: data.tags ?? [] };
}
