export abstract class BaseProvider {
  abstract name: string;
  abstract selectors: Record<string, string>;
  
  detect(): boolean {
    return this.selectors.textarea ? !!document.querySelector(this.selectors.textarea) : false;
  }
  
  getTextarea(): HTMLTextAreaElement | null {
    const sel = this.selectors.textarea;
    return document.querySelector(sel) as HTMLTextAreaElement;
  }
  
  getSendButton(): HTMLElement | null {
    const sel = this.selectors.send;
    return document.querySelector(sel);
  }
  
  setText(text: string): void {
    const textarea = this.getTextarea();
    if (textarea) {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}