import { db } from "./db";
import type { Workspace } from "../shared/types";

export async function createWorkspace(workspace: Omit<Workspace, "id">): Promise<number> {
  return db.workspaces.add(workspace as Workspace);
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return db.workspaces.orderBy("createdAt").toArray();
}

export async function getOrCreateDefaultWorkspace(): Promise<number> {
  const existing = await db.workspaces.toCollection().first();
  if (existing?.id) return existing.id;
  return createWorkspace({ name: "Unsorted", icon: "\u{1F5C2}️", createdAt: Date.now() });
}

export async function updateWorkspace(id: number, changes: Partial<Omit<Workspace, "id">>): Promise<void> {
  await db.workspaces.update(id, changes);
}
