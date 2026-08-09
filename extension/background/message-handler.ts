export type ExtensionMessage =
  | { type: "PANIC_CAPTURE" }
  | { type: "RESTORE_SESSION"; sessionId: number }
  | { type: "RESTORE_PAGES"; urls: string[] };

export interface PanicCaptureResult {
  sessionId: number;
  captured: number;
  skippedProtected: number;
}
