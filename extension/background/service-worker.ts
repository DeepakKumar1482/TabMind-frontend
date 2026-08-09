import { panicCapture, restorePages } from "./tab-manager";
import { getSession } from "../../database/sessions";
import { listPagesBySession } from "../../database/pages";
import type { ExtensionMessage } from "./message-handler";

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
    case "PANIC_CAPTURE":
      panicCapture().then(sendResponse);
      return true;

    case "RESTORE_SESSION":
      (async () => {
        const session = await getSession(message.sessionId);
        if (!session) return sendResponse({ ok: false });
        const pages = await listPagesBySession(message.sessionId);
        await restorePages(pages.map((p) => p.url));
        sendResponse({ ok: true });
      })();
      return true;

    case "RESTORE_PAGES":
      restorePages(message.urls).then(() => sendResponse({ ok: true }));
      return true;

    default:
      return false;
  }
});
