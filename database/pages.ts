import { db } from "./db";
import type { Page } from "../shared/types";

export async function addPage(page: Omit<Page, "id">): Promise<number> {
  return db.pages.add(page as Page);
}

export async function addPages(pages: Omit<Page, "id">[]): Promise<void> {
  await db.pages.bulkAdd(pages as Page[]);
}

export async function listPagesBySession(sessionId: number): Promise<Page[]> {
  return db.pages.where("sessionId").equals(sessionId).filter((p) => !p.deletedAt).toArray();
}

export async function findDuplicates(pages: Pick<Page, "url">[]): Promise<Set<string>> {
  const urls = pages.map((p) => p.url);
  const existing = await db.pages
    .where("url")
    .anyOf(urls)
    .filter((p) => !p.deletedAt)
    .toArray();
  return new Set(existing.map((p) => p.url));
}

export async function listAllPages(): Promise<Page[]> {
  return db.pages.filter((p) => !p.deletedAt).toArray();
}

export async function listUnprocessedPages(): Promise<Page[]> {
  return db.pages.filter((p) => p.embedding === undefined && !p.deletedAt).toArray();
}

export async function updatePage(id: number, changes: Partial<Omit<Page, "id">>): Promise<void> {
  await db.pages.update(id, changes);
}

// Soft delete — moves to Trash, recoverable via undeletePage(). Every list
// query above already excludes deletedAt pages.
export async function deletePage(id: number): Promise<void> {
  await db.pages.update(id, { deletedAt: Date.now() });
}

export async function undeletePage(id: number): Promise<void> {
  await db.pages.update(id, { deletedAt: undefined });
}

export async function purgePage(id: number): Promise<void> {
  await db.pages.delete(id);
}

export async function listTrashedPages(): Promise<Page[]> {
  return db.pages.filter((p) => !!p.deletedAt).toArray();
}

export async function purgeExpiredPages(olderThan: number): Promise<void> {
  const expired = await db.pages.filter((p) => !!p.deletedAt && p.deletedAt < olderThan).toArray();
  await db.pages.bulkDelete(expired.map((p) => p.id));
}
