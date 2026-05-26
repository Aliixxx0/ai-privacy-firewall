import { BaseProvider } from './shared/base';

export class ChatGPT extends BaseProvider {
  name = 'ChatGPT';
  
  selectors = {
    textarea: 'textarea[data-testid="text-input"], textarea[placeholder*="Say"]',
    send: 'button[data-testid="send-button"], button[aria-label*="Send"]',
    container: 'form, [role="main"]',
  };
}