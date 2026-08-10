import { db } from "./db";
import type { Page } from "../shared/types";

export async function addPage(page: Omit<Page, "id">): Promise<number> {
  return db.pages.add(page as Page);
}

export async function addPages(pages: Omit<Page, "id">[]): Promise<void> {
  await db.pages.bulkAdd(pages as Page[]);
}

export async function listPagesBySession(sessionId: number): Promise<Page[]> {
  return db.pages.where("sessionId").equals(sessionId).toArray();
}

export async function findDuplicates(pages: Pick<Page, "url">[]): Promise<Set<string>> {
  const urls = pages.map((p) => p.url);
  const existing = await db.pages.where("url").anyOf(urls).toArray();
  return new Set(existing.map((p) => p.url));
}

export async function listAllPages(): Promise<Page[]> {
  return db.pages.toArray();
}

export async function listUnprocessedPages(): Promise<Page[]> {
  return db.pages.filter((p) => p.embedding === undefined).toArray();
}

export async function updatePage(id: number, changes: Partial<Omit<Page, "id">>): Promise<void> {
  await db.pages.update(id, changes);
}
