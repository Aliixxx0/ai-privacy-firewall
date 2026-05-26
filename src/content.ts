import { detectSecrets, sanitize } from "~src/engine/patterns";
import { ChatGPT } from "~src/providers/chatgpt";
import { Claude } from "~src/providers/claude";
import { GenericAI } from "~src/providers/generic";
import type { BaseProvider, InputElement } from "~src/providers/shared/base";

const BADGE_ID = "privacy-firewall-badge";
const SCAN_DEBOUNCE_MS = 120;
const BADGE_THROTTLE_MS = 100;

class PrivacyGateway {
  private provider: BaseProvider | null = null;
  private inputElement: InputElement | null = null;
  private sendButton: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private enabled = true;
  private detectionCount = 0;
  private sendGuard = false;
  private inputBound = false;
  private initialized = false;
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private badgeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBadgePosition = "";

  constructor() {
    this.setupMessageListener();
    this.setupSendInterceptor();
    this.startWatching();
  }

  startWatching() {
    if (this.observer) {
      return;
    }

    this.tryInit();
    this.observer = new MutationObserver(() => {
      if (this.initialized) {
        return;
      }
      this.scheduleTryInit();
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  scheduleTryInit() {
    if (this.initTimer) {
      clearTimeout(this.initTimer);
    }
    this.initTimer = setTimeout(() => this.tryInit(), SCAN_DEBOUNCE_MS);
  }

  tryInit() {
    if (this.initialized) {
      return;
    }

    if (!this.provider) {
      this.detectProvider();
    }

    if (!this.provider || !this.enabled) {
      return;
    }

    const input = this.provider.getInput();
    if (!input) {
      return;
    }

    if (input !== this.inputElement) {
      this.inputElement = input;
      this.inputBound = false;
      this.sendButton = null;
    }

    this.sendButton = this.provider.getSendButton();
    this.attachIndicator();
    this.bindInput();

    if (this.inputBound) {
      this.initialized = true;
      this.observer?.disconnect();
      this.observer = null;
    }
  }

  detectProvider() {
    const providers: BaseProvider[] = [
      new ChatGPT(),
      new Claude(),
      new GenericAI(),
    ];

    for (const provider of providers) {
      if (provider.detect()) {
        this.provider = provider;
        console.log(`[Privacy Firewall] Detected: ${provider.name}`);
        return;
      }
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_STATUS") {
        sendResponse({
          provider: this.provider?.name ?? "Unknown",
          detections: this.detectionCount,
          enabled: this.enabled,
        });
        return true;
      }

      if (message.type === "TOGGLE_PROTECTION") {
        this.enabled = !this.enabled;
        if (this.enabled) {
          this.initialized = false;
          this.startWatching();
        } else {
          this.removeIndicator();
          this.observer?.disconnect();
          this.observer = null;
        }
        sendResponse({ enabled: this.enabled });
        return true;
      }

      return false;
    });
  }

  attachIndicator() {
    if (!this.inputElement) {
      return;
    }

    let badge = document.getElementById(BADGE_ID);
    if (!badge) {
      badge = document.createElement("div");
      badge.id = BADGE_ID;
      badge.style.cssText = [
        "position: fixed",
        "z-index: 2147483647",
        "padding: 4px 10px",
        "border-radius: 999px",
        "font: 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "font-weight: 600",
        "color: #fff",
        "background: #10b981",
        "box-shadow: 0 2px 8px rgba(0,0,0,0.25)",
        "pointer-events: none",
      ].join(";");
      document.body.appendChild(badge);
    }

    this.updateIndicator();
    this.positionBadge();
  }

  positionBadge() {
    const badge = document.getElementById(BADGE_ID);
    if (!badge || !this.inputElement) {
      return;
    }

    const rect = this.inputElement.getBoundingClientRect();
    const next = `${Math.max(8, rect.top - 28)}|${Math.max(8, rect.left)}`;
    if (next === this.lastBadgePosition) {
      return;
    }
    this.lastBadgePosition = next;

    const [top, left] = next.split("|");
    badge.style.top = `${top}px`;
    badge.style.left = `${left}px`;
  }

  scheduleBadgePosition() {
    if (this.badgeTimer) {
      return;
    }
    this.badgeTimer = setTimeout(() => {
      this.badgeTimer = null;
      this.positionBadge();
    }, BADGE_THROTTLE_MS);
  }

  updateIndicator() {
    if (!this.inputElement) {
      return;
    }

    const badge = document.getElementById(BADGE_ID);
    const color = this.detectionCount > 0 ? "#ef4444" : "#10b981";

    this.inputElement.style.outline = `2px solid ${color}`;
    this.inputElement.style.outlineOffset = "2px";

    if (badge) {
      badge.textContent = `🔒 Threats: ${this.detectionCount}`;
      badge.style.background = color;
    }
  }

  bindInput() {
    if (!this.inputElement || this.inputBound) {
      return;
    }

    const onChange = () => this.scheduleScan();
    this.inputElement.addEventListener("input", onChange);
    this.inputElement.addEventListener("paste", () => {
      setTimeout(onChange, 0);
    });

    window.addEventListener("scroll", () => this.scheduleBadgePosition(), true);
    window.addEventListener("resize", () => this.scheduleBadgePosition());

    this.inputBound = true;
    this.scheduleScan();
  }

  scheduleScan() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
    }
    this.scanTimer = setTimeout(() => this.handleInput(), SCAN_DEBOUNCE_MS);
  }

  handleInput() {
    if (!this.provider || !this.inputElement || !this.enabled) {
      return;
    }

    const text = this.provider.getText(this.inputElement);
    const count = detectSecrets(text).length;
    if (count === this.detectionCount) {
      return;
    }

    this.detectionCount = count;
    this.updateIndicator();
    this.scheduleBadgePosition();
  }

  setupSendInterceptor() {
    document.addEventListener(
      "click",
      (event) => {
        if (!this.enabled || !this.provider || !this.inputElement || this.sendGuard) {
          return;
        }

        const target = event.target as Element;
        const sendButton = this.sendButton ?? this.provider.getSendButton();
        if (!sendButton || (!sendButton.contains(target) && sendButton !== target)) {
          return;
        }

        const text = this.provider.getText(this.inputElement);
        const redacted = sanitize(text, "mask");
        if (redacted === text) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        this.provider.setText(this.inputElement, redacted);
        this.detectionCount = 0;
        this.updateIndicator();

        this.sendGuard = true;
        setTimeout(() => {
          sendButton.click();
          this.sendGuard = false;
        }, 50);
      },
      true,
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (!this.enabled || !this.provider || !this.inputElement || this.sendGuard) {
          return;
        }

        if (event.key !== "Enter" || event.shiftKey) {
          return;
        }

        const text = this.provider.getText(this.inputElement);
        const redacted = sanitize(text, "mask");
        if (redacted === text) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        this.provider.setText(this.inputElement, redacted);
        this.detectionCount = 0;
        this.updateIndicator();

        this.sendGuard = true;
        setTimeout(() => {
          this.inputElement?.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              bubbles: true,
              cancelable: true,
            }),
          );
          this.sendGuard = false;
        }, 50);
      },
      true,
    );
  }

  removeIndicator() {
    document.getElementById(BADGE_ID)?.remove();
    if (this.inputElement) {
      this.inputElement.style.outline = "";
      this.inputElement.style.outlineOffset = "";
    }
    this.detectionCount = 0;
    this.initialized = false;
    this.inputBound = false;
    this.lastBadgePosition = "";
  }
}

function init() {
  new PrivacyGateway();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
