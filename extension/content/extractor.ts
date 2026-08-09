export function extractPageContent(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, style, noscript, svg, nav, footer").forEach((el) => el.remove());
  const text = clone.innerText || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 20000);
}
