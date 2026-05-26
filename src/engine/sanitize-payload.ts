import { sanitize } from "./patterns";

const MESSAGE_KEYS = new Set([
  "message_content",
  "prompt",
  "text",
  "content",
  "input",
  "message",
  "query",
  "user_message",
  "completion",
  "instructions",
]);

const SKIP_KEYS = new Set([
  "token",
  "tokens",
  "context_token",
  "access_token",
  "refresh_token",
  "session_id",
  "conversation_id",
  "organization_id",
  "uuid",
  "id",
  "model",
  "anthropic_version",
  "authorization",
  "cookie",
  "trace_id",
  "request_id",
  "client_id",
  "parent_message_uuid",
  "message_uuid",
  "attachment",
  "attachments",
  "file_id",
  "sync_source",
  "locale",
  "timezone",
  "user_agent",
]);

export class EmptyMessageError extends Error {
  constructor() {
    super("Privacy Firewall blocked send: message empty after redaction");
    this.name = "EmptyMessageError";
  }
}

function shouldSanitizeKey(key: string): boolean {
  const lower = key.toLowerCase();

  if (SKIP_KEYS.has(lower)) {
    return false;
  }

  if (lower.endsWith("_id") || lower.endsWith("_token") || lower.includes("uuid")) {
    return false;
  }

  if (MESSAGE_KEYS.has(lower)) {
    return true;
  }

  return false;
}

export function isEmptyAfterRedaction(text: string): boolean {
  return text.replace(/\*+/g, "").trim().length === 0;
}

export function sanitizeDeep(value: unknown, parentKey?: string): unknown {
  if (typeof value === "string") {
    if (parentKey && shouldSanitizeKey(parentKey)) {
      return sanitize(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item, parentKey));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = sanitizeDeep(nested, key);
    }
    return result;
  }

  return value;
}

function findEmptyMessageField(value: unknown, parentKey?: string): string | null {
  if (typeof value === "string") {
    if (parentKey && shouldSanitizeKey(parentKey) && isEmptyAfterRedaction(value)) {
      return parentKey;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEmptyMessageField(item, parentKey);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const found = findEmptyMessageField(nested, key);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function sanitizePayload(body: string): string {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return sanitize(body);
  }

  try {
    const parsed = JSON.parse(body);
    const sanitized = sanitizeDeep(parsed);
    const emptyField = findEmptyMessageField(sanitized);

    if (emptyField) {
      throw new EmptyMessageError();
    }

    return JSON.stringify(sanitized);
  } catch (error) {
    if (error instanceof EmptyMessageError) {
      throw error;
    }
    return sanitize(body);
  }
}

export function isProtectionEnabled(): boolean {
  return document.documentElement.dataset.privacyFirewall !== "off";
}

export function shouldSanitizeRequest(url: string): boolean {
  try {
    const parsed = new URL(url, location.origin);
    const path = parsed.pathname.toLowerCase();

    if (location.hostname.includes("claude.ai")) {
      return (
        path.includes("/api/") ||
        path.includes("/chat") ||
        path.includes("/completion") ||
        path.includes("/messages")
      );
    }

    if (
      location.hostname.includes("chatgpt.com") ||
      location.hostname.includes("openai.com")
    ) {
      return path.includes("/backend-api/") || path.includes("/conversation");
    }

    return path.includes("/api/") || path.includes("/chat");
  } catch {
    return false;
  }
}

export function notifyBlocked(reason: string) {
  document.dispatchEvent(
    new CustomEvent("privacy-firewall-blocked", { detail: { reason } }),
  );
}
