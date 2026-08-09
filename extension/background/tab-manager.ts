import { createSession } from "../../database/sessions";
import { addPages, findDuplicates } from "../../database/pages";
import { getOrCreateDefaultWorkspace } from "../../database/workspaces";
import { DEFAULT_PROTECTED_PATTERNS, isProtectedUrl } from "../../shared/constants/protected-domains";
import { extractPageContent } from "../content/extractor";
import type { Page } from "../../shared/types";
import type { PanicCaptureResult } from "./message-handler";

async function getProtectedPatterns(): Promise<string[]> {
  const stored = await chrome.storage.local.get("protectedPatterns");
  const custom = (stored.protectedPatterns as string[] | undefined) ?? [];
  return [...DEFAULT_PROTECTED_PATTERNS, ...custom];
}

async function extractTabContent(tabId: number): Promise<string> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageContent,
    });
    return (result?.result as string) ?? "";
  } catch {
    return "";
  }
}

export async function panicCapture(): Promise<PanicCaptureResult> {
  const patterns = await getProtectedPatterns();
  const tabs = await chrome.tabs.query({ currentWindow: true });

  const capturable = tabs.filter(
    (tab): tab is chrome.tabs.Tab & { id: number; url: string } =>
      typeof tab.id === "number" &&
      typeof tab.url === "string" &&
      /^https?:\/\//.test(tab.url) &&
      !isProtectedUrl(tab.url, patterns)
  );
  const skippedProtected = tabs.length - capturable.length;

  const existingUrls = await findDuplicates(capturable.map((t) => ({ url: t.url })));

  const workspaceId = await getOrCreateDefaultWorkspace();
  const sessionId = await createSession({
    workspaceId,
    name: `Session ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    tabCount: capturable.length,
  });

  const pages: Omit<Page, "id">[] = [];
  for (const tab of capturable) {
    if (existingUrls.has(tab.url)) continue;
    const content = await extractTabContent(tab.id);
    pages.push({
      sessionId,
      workspaceId,
      url: tab.url,
      title: tab.title ?? tab.url,
      content,
      tags: [],
      readStatus: "unread",
      capturedAt: Date.now(),
    });
  }
  await addPages(pages);

  const tabIdsToClose = capturable.map((t) => t.id);
  if (tabIdsToClose.length) {
    await chrome.tabs.remove(tabIdsToClose);
  }

  const dashboardUrl = chrome.runtime.getURL("dashboard/index.html");
  await chrome.tabs.create({ url: dashboardUrl });

  return { sessionId, captured: pages.length, skippedProtected };
}

export async function restorePages(urls: string[]): Promise<void> {
  for (const url of urls) {
    await chrome.tabs.create({ url, active: false });
  }
}
