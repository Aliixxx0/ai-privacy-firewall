import { BaseProvider } from "./shared/base";

export class Claude extends BaseProvider {
  name = "Claude";

  selectors = {
    input: [
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"][enterkeyhint]',
      'textarea[placeholder*="Reply"]',
      'textarea[placeholder*="Message"]',
    ].join(", "),
    send: [
      'button[aria-label*="Send"]',
      'button[data-testid="send-button"]',
      'button[class*="send"]',
    ].join(", "),
    container: '[data-testid="conversation"]',
  };

  detect(): boolean {
    if (location.hostname.includes("claude.ai")) {
      return true;
    }
    return super.detect();
  }
}
