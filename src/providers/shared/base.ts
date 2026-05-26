export type InputElement = HTMLTextAreaElement | HTMLElement;

export abstract class BaseProvider {
  abstract name: string;
  abstract selectors: {
    input: string;
    send: string;
    container?: string;
  };

  detect(): boolean {
    return !!this.getInput();
  }

  getInput(): InputElement | null {
    for (const sel of this.selectors.input.split(",").map((s) => s.trim())) {
      const el = document.querySelector(sel);
      if (el && this.isVisible(el)) {
        return el as InputElement;
      }
    }

    return this.findVisibleContentEditable();
  }

  findVisibleContentEditable(): HTMLElement | null {
    for (const el of document.querySelectorAll('[contenteditable="true"]')) {
      if (this.isVisible(el)) {
        return el as HTMLElement;
      }
    }
    return null;
  }

  isVisible(el: Element): boolean {
    const node = el as HTMLElement;
    if (node.offsetParent === null && getComputedStyle(node).position !== "fixed") {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 20;
  }

  getSendButton(): HTMLElement | null {
    for (const sel of this.selectors.send.split(",").map((s) => s.trim())) {
      const el = document.querySelector(sel);
      if (el && this.isVisible(el)) {
        return el as HTMLElement;
      }
    }
    return null;
  }

  getText(el: InputElement): string {
    if (el instanceof HTMLTextAreaElement) {
      return el.value;
    }
    return el.innerText || el.textContent || "";
  }

  setText(el: InputElement, text: string): void {
    if (el instanceof HTMLTextAreaElement) {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const inserted = document.execCommand("insertText", false, text);
    if (!inserted) {
      el.textContent = text;
    }

    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText" }),
    );
  }
}
