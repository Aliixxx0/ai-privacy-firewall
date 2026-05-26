import { BaseProvider } from "./shared/base";

export class ChatGPT extends BaseProvider {
  name = "ChatGPT";

  selectors = {
    input: [
      '#prompt-textarea[contenteditable="true"]',
      "div.ProseMirror[contenteditable]",
      '[data-testid="prompt-textarea"]',
      'textarea[data-testid="text-input"]',
      'textarea[placeholder*="Message"]',
    ].join(", "),
    send: [
      '[data-testid="send-button"]',
      'button[data-testid="composer-send-button"]',
      'button[aria-label*="Send"]',
    ].join(", "),
    container: "form, main",
  };

  detect(): boolean {
    const host = location.hostname;
    if (host.includes("chatgpt.com") || host.includes("openai.com")) {
      return true;
    }
    return super.detect();
  }
}
