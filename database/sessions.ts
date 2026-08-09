import { db } from "./db";
import type { Session } from "../shared/types";

export async function createSession(session: Omit<Session, "id">): Promise<number> {
  return db.sessions.add(session as Session);
}

export async function listSessions(): Promise<Session[]> {
  return db.sessions.orderBy("createdAt").reverse().toArray();
}

export async function getSession(id: number): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function deleteSession(id: number): Promise<void> {
  await db.pages.where("sessionId").equals(id).delete();
  await db.sessions.delete(id);
}
