import { useState } from "react";
import type { PanicCaptureResult } from "../background/message-handler";

export default function Popup() {
  const [status, setStatus] = useState<"idle" | "capturing" | "done">("idle");
  const [result, setResult] = useState<PanicCaptureResult | null>(null);

  async function handlePanic() {
    setStatus("capturing");
    const response = (await chrome.runtime.sendMessage({ type: "PANIC_CAPTURE" })) as PanicCaptureResult;
    setResult(response);
    setStatus("done");
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 16, margin: "0 0 12px" }}>🧠 TabMind</h1>
      <button
        onClick={handlePanic}
        disabled={status === "capturing"}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "none",
          background: "#dc2626",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {status === "capturing" ? "Capturing..." : "🚨 Collapse Tabs"}
      </button>
      {status === "done" && result && (
        <p style={{ fontSize: 13, marginTop: 12, color: "#94a3b8" }}>
          Captured {result.captured} tabs
          {result.skippedProtected > 0 ? `, skipped ${result.skippedProtected} protected` : ""}.
        </p>
      )}
    </div>
  );
}
