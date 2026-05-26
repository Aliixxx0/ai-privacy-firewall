import {
  EmptyMessageError,
  isProtectionEnabled,
  notifyBlocked,
  sanitizePayload,
  shouldSanitizeRequest,
} from "~src/engine/sanitize-payload";

const originalFetch = window.fetch.bind(window);
const originalXhrSend = XMLHttpRequest.prototype.send;

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

async function redactBody(
  body: BodyInit | Document | XMLHttpRequestBodyInit | null | undefined,
  url: string,
): Promise<BodyInit | Document | XMLHttpRequestBodyInit | null | undefined> {
  if (body == null || !shouldSanitizeRequest(url)) {
    return body;
  }

  if (typeof body === "string") {
    try {
      const redacted = sanitizePayload(body);
      return redacted === body ? body : redacted;
    } catch (error) {
      if (error instanceof EmptyMessageError) {
        notifyBlocked(
          "Message is only sensitive data. Add non-secret text before sending.",
        );
        throw error;
      }
      return body;
    }
  }

  if (body instanceof Blob) {
    const text = await body.text();
    if (!text) {
      return body;
    }

    try {
      const redacted = sanitizePayload(text);
      return redacted === text
        ? body
        : new Blob([redacted], { type: body.type || "application/json" });
    } catch (error) {
      if (error instanceof EmptyMessageError) {
        notifyBlocked(
          "Message is only sensitive data. Add non-secret text before sending.",
        );
        throw error;
      }
      return body;
    }
  }

  return body;
}

window.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!isProtectionEnabled()) {
    return originalFetch(input, init);
  }

  const url = resolveUrl(input);

  try {
    if (init?.body != null) {
      const redacted = await redactBody(init.body, url);
      if (redacted !== init.body) {
        init = { ...init, body: redacted as BodyInit };
      }
    } else if (input instanceof Request) {
      if (!shouldSanitizeRequest(url)) {
        return originalFetch(input, init);
      }

      const text = await input.clone().text();
      if (text) {
        try {
          const redacted = sanitizePayload(text);
          if (redacted !== text) {
            input = new Request(input, { body: redacted });
          }
        } catch (error) {
          if (error instanceof EmptyMessageError) {
            notifyBlocked(
              "Message is only sensitive data. Add non-secret text before sending.",
            );
            return Promise.reject(error);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof EmptyMessageError) {
      return Promise.reject(error);
    }
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

  const url = xhrUrls.get(this);

  if (typeof body === "string" && body.length > 0 && url && shouldSanitizeRequest(url)) {
    try {
      body = sanitizePayload(body);
    } catch (error) {
      if (error instanceof EmptyMessageError) {
        notifyBlocked(
          "Message is only sensitive data. Add non-secret text before sending.",
        );
        return;
      }
    }
  }

  return originalXhrSend.call(this, body);
};

document.documentElement.dataset.privacyFirewall =
  document.documentElement.dataset.privacyFirewall || "on";
document.documentElement.dataset.privacyNetworkGuard = "active";

console.log("[Privacy Firewall] Network guard active");
