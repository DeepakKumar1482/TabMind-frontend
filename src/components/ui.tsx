import { useState } from "react";

export function Favicon({ url, size = 16 }: { url: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const src =
    typeof chrome !== "undefined" && chrome.runtime?.id
      ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size * 2}`
      : undefined;

  if (!src || errored) {
    return (
      <span className="shrink-0 rounded-sm bg-zinc-800 mt-0.5" style={{ width: size, height: size }} aria-hidden />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-sm mt-0.5" onError={() => setErrored(true)} />
  );
}

export function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy URL"
      className={`text-xs px-1.5 shrink-0 transition-colors ${copied ? "text-violet-400" : "text-zinc-700 hover:text-violet-300"}`}
    >
      {copied ? "✓" : "⧉"}
    </button>
  );
}

export function PageTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex gap-1.5 mt-1.5 flex-wrap">
      {tags.map((tag) => (
        <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
          {tag}
        </span>
      ))}
    </div>
  );
}

// Small "..." action menu — click outside or Escape closes it. Used for
// per-row actions (rename/move/delete) instead of always-visible buttons.
export function ActionMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-label="More actions"
        className="text-zinc-500 hover:text-zinc-200 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/40 py-1 z-10">
          {items.map((item) => (
            <button
              key={item.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={`w-full text-left text-xs px-3 py-2 hover:bg-zinc-800 transition-colors ${
                item.danger ? "text-rose-400" : "text-zinc-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
