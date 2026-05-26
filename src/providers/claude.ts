import { BaseProvider } from './shared/base';

export class Claude extends BaseProvider {
  name = 'Claude';
  
  selectors = {
    textarea: 'textarea[data-lpignore], textarea[placeholder*="Say"]',
    send: 'button[aria-label*="Send"], button[class*="send"]',
    container: '[data-testid="conversation"]',
  };
}