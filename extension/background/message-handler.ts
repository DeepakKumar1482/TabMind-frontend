export type ExtensionMessage =
  | { type: "PANIC_CAPTURE" }
  | { type: "SAVE_SESSION" }
  | { type: "RESTORE_SESSION"; sessionId: number }
  | { type: "RESTORE_PAGES"; urls: string[] };

export interface PanicCaptureResult {
  sessionId: number;
  captured: number;
  skippedProtected: number;
}

export interface SaveSessionResult {
  sessionId: number;
  captured: number;
  skippedProtected: number;
}
