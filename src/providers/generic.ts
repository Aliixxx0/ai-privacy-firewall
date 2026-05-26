import { BaseProvider } from "./shared/base";

export class GenericAI extends BaseProvider {
  name = "AI Chat";

  selectors = {
    input: [
      'textarea:not([disabled])',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]',
    ].join(", "),
    send: [
      'button[type="submit"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
    ].join(", "),
  };
}
