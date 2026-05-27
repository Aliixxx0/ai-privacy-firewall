import {
  EmptyMessageError,
  bodyToText,
  isProtectionEnabled,
  notifyBlocked,
  sanitizePayload,
  shouldSanitizeRequest,
  textToBody,
} from "~src/engine/sanitize-payload";

const originalFetch = window.fetch.bind(window);
const originalXhrSend = XMLHttpRequest.prototype.send;
const originalSendBeacon = navigator.sendBeacon.bind(navigator);

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function trySanitizeBody(
  body: string,
  url: string,
): { redacted: string; changed: boolean } | "block" {
  if (!shouldSanitizeRequest(url, body)) {
    return { redacted: body, changed: false };
  }

  try {
    const redacted = sanitizePayload(body);
    return { redacted, changed: redacted !== body };
  } catch (error) {
    if (error instanceof EmptyMessageError) {
      notifyBlocked(
        "Message is only sensitive data. Add non-secret text before sending.",
      );
      return "block";
    }
    return { redacted: body, changed: false };
  }
}

function trySanitizeInitBody(
  body: BodyInit | Document | XMLHttpRequestBodyInit | null | undefined,
  url: string,
): BodyInit | Document | XMLHttpRequestBodyInit | null | undefined | "block" {
  if (body == null) {
    return body;
  }

  const text = bodyToText(body);
  if (text != null) {
    const result = trySanitizeBody(text, url);
    if (result === "block") {
      return "block";
    }
    return result.changed ? textToBody(result.redacted, body as BodyInit) : body;
  }

  if (body instanceof Blob) {
    return body;
  }

  return body;
}

window.fetch = function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!isProtectionEnabled()) {
    return originalFetch(input, init);
  }

  const url = resolveUrl(input);

  if (init?.body != null) {
    const text = bodyToText(init.body);
    if (text != null) {
      const result = trySanitizeBody(text, url);
      if (result === "block") {
        return Promise.reject(new EmptyMessageError());
      }
      if (result.changed) {
        init = { ...init, body: textToBody(result.redacted, init.body) };
      }
    } else if (init.body instanceof Blob) {
      return init.body.text().then((blobText) => {
        const result = trySanitizeBody(blobText, url);
        if (result === "block") {
          return Promise.reject(new EmptyMessageError());
        }
        const nextInit =
          result.changed
            ? {
                ...init,
                body: new Blob([result.redacted], {
                  type: init.body instanceof Blob ? init.body.type || "application/json" : "application/json",
                }),
              }
            : init;
        return originalFetch(input, nextInit);
      });
    }
  } else if (input instanceof Request) {
    return input
      .clone()
      .text()
      .then((text) => {
        if (!text) {
          return originalFetch(input, init);
        }

        const result = trySanitizeBody(text, url);
        if (result === "block") {
          return Promise.reject(new EmptyMessageError());
        }

        if (result.changed) {
          input = new Request(input, { body: result.redacted });
        }

        return originalFetch(input, init);
      });
  }

  return originalFetch(input, init);
};

const originalXhrOpen = XMLHttpRequest.prototype.open;
const xhrUrls = new WeakMap<XMLHttpRequest, string>();

XMLHttpRequest.prototype.open = function patchedOpen(
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null,
) {
  xhrUrls.set(this, typeof url === "string" ? url : url.toString());
  return originalXhrOpen.call(this, method, url, async ?? true, username, password);
};

XMLHttpRequest.prototype.send = function patchedSend(
  body?: Document | XMLHttpRequestBodyInit | null,
) {
  if (!isProtectionEnabled()) {
    return originalXhrSend.call(this, body);
  }

  const url = xhrUrls.get(this) ?? "";
  const sanitized = trySanitizeInitBody(body ?? null, url);

  if (sanitized === "block") {
    return;
  }

  return originalXhrSend.call(this, sanitized);
};

navigator.sendBeacon = function patchedSendBeacon(
  url: string | URL,
  data?: BodyInit | null,
): boolean {
  if (!isProtectionEnabled() || data == null) {
    return originalSendBeacon(url, data);
  }

  const resolvedUrl = typeof url === "string" ? url : url.toString();
  const text = bodyToText(data);

  if (text != null) {
    const result = trySanitizeBody(text, resolvedUrl);
    if (result === "block") {
      return false;
    }
    if (result.changed) {
      return originalSendBeacon(url, textToBody(result.redacted, data));
    }
  }

  return originalSendBeacon(url, data);
};

document.documentElement.dataset.privacyFirewall =
  document.documentElement.dataset.privacyFirewall || "on";
document.documentElement.dataset.privacyNetworkGuard = "active";

console.log("[Privacy Firewall] Network guard active");
