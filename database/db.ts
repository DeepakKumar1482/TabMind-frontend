import Dexie, { type EntityTable } from "dexie";
import type { Workspace, Session, Page } from "../shared/types";

export class TabMindDB extends Dexie {
  workspaces!: EntityTable<Workspace, "id">;
  sessions!: EntityTable<Session, "id">;
  pages!: EntityTable<Page, "id">;

  constructor() {
    super("tabmind");
    this.version(1).stores({
      workspaces: "++id, name, createdAt",
      sessions: "++id, workspaceId, createdAt",
      pages: "++id, sessionId, workspaceId, url, readStatus, capturedAt, *tags",
    });
  }
}

export const db = new TabMindDB();
