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
  lastOpenedAt?: number;
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
