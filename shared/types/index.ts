export type ReadStatus = "unread" | "reading" | "completed";

export interface Workspace {
  id: number;
  name: string;
  icon: string;
  createdAt: number;
}

export interface Session {
  id: number;
  workspaceId?: number;
  name: string;
  createdAt: number;
  tabCount: number;
  windowCount?: number;
  lastOpenedAt?: number;
  deletedAt?: number;
}

export interface Page {
  id: number;
  sessionId: number;
  workspaceId?: number;
  url: string;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  group?: string;
  pinned?: boolean;
  deletedAt?: number;
  windowIndex?: number;
  embedding?: number[];
  readStatus: ReadStatus;
  note?: string;
  capturedAt: number;
}

export interface CapturedTab {
  url: string;
  title: string;
  content: string;
  favIconUrl?: string;
}
