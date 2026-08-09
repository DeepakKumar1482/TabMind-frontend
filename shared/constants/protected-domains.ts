export const DEFAULT_PROTECTED_PATTERNS: string[] = [
  "mail.google.com",
  "*.bankofamerica.com",
  "accounts.google.com",
  "*.paypal.com",
  "*.chase.com",
];

export function isProtectedUrl(url: string, patterns: string[]): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return true;
  }
  return patterns.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return hostname.endsWith(suffix);
    }
    return hostname === pattern;
  });
}
