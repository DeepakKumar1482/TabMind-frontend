import { db } from "./db";
import type { Session } from "../shared/types";

export async function createSession(session: Omit<Session, "id">): Promise<number> {
  return db.sessions.add(session as Session);
}

export async function listSessions(): Promise<Session[]> {
  return db.sessions
    .orderBy("createdAt")
    .reverse()
    .filter((s) => !s.deletedAt)
    .toArray();
}

export async function getSession(id: number): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function updateSession(id: number, changes: Partial<Omit<Session, "id">>): Promise<void> {
  await db.sessions.update(id, changes);
}

// Soft delete — session and its pages move to Trash together, recoverable
// as a unit via undeleteSession(). Every list query in pages.ts/sessions.ts
// already excludes deletedAt records.
export async function deleteSession(id: number): Promise<void> {
  const deletedAt = Date.now();
  await db.sessions.update(id, { deletedAt });
  const pages = await db.pages.where("sessionId").equals(id).toArray();
  await db.pages.bulkUpdate(pages.map((p) => ({ key: p.id, changes: { deletedAt } })));
}

export async function undeleteSession(id: number): Promise<void> {
  await db.sessions.update(id, { deletedAt: undefined });
  const pages = await db.pages
    .where("sessionId")
    .equals(id)
    .filter((p) => !!p.deletedAt)
    .toArray();
  await db.pages.bulkUpdate(pages.map((p) => ({ key: p.id, changes: { deletedAt: undefined } })));
}

export async function purgeSession(id: number): Promise<void> {
  await db.pages.where("sessionId").equals(id).delete();
  await db.sessions.delete(id);
}

export async function listTrashedSessions(): Promise<Session[]> {
  return db.sessions.filter((s) => !!s.deletedAt).toArray();
}

export async function purgeExpiredSessions(olderThan: number): Promise<void> {
  const expired = await db.sessions.filter((s) => !!s.deletedAt && s.deletedAt < olderThan).toArray();
  for (const session of expired) await purgeSession(session.id);
}
