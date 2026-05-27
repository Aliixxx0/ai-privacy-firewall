import { useEffect, useState } from "react";

import "~src/style.css";

import { ExtensionPopup } from "~src/components/popup/ExtensionPopup";
import type { Platform, PopupState } from "~src/components/popup/tokens";

type StatusResponse = {
  provider: string;
  detections: number;
  enabled: boolean;
};

function isSupportedTab(url?: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function sendToActiveTab<T>(message: object): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !isSupportedTab(tab.url)) {
        resolve(null);
        return;
      }

      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve((response as T) ?? null);
      });
    });
  });
}

export const Popup: React.FC = () => {
  const [provider, setProvider] = useState("Not connected");
  const [detections, setDetections] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [statusNote, setStatusNote] = useState(
    "Open ChatGPT or Claude, then refresh the page.",
  );

  useEffect(() => {
    sendToActiveTab<StatusResponse>({ type: "GET_STATUS" }).then((response) => {
      if (!response) {
        setConnected(false);
        return;
      }

      setConnected(true);
      setStatusNote("");
      setProvider(response.provider || "Unknown");
      setDetections(response.detections || 0);
      setEnabled(response.enabled !== false);
    });
  }, []);

  const handleToggle = async () => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);

    const response = await sendToActiveTab<{ enabled: boolean }>({
      type: "TOGGLE_PROTECTION",
    });

    if (!response) {
      setEnabled(!nextEnabled);
      setConnected(false);
      setStatusNote("Could not reach this tab. Refresh the page and try again.");
      return;
    }

    setConnected(true);
    setEnabled(response.enabled);
    setStatusNote("");
  };

  const normalized = provider.toLowerCase();
  const platform: Platform | null =
    normalized.includes("chatgpt") || normalized.includes("openai")
      ? "ChatGPT"
      : normalized.includes("claude")
        ? "Claude"
        : connected
          ? (null as Platform | null)
          : null;

  const state: PopupState = !connected
    ? "disconnected"
    : !enabled
      ? "paused"
      : detections > 0
        ? "active-threats"
        : "active-zero";

  return (
    <div className="w-[320px] min-h-[420px] overflow-hidden">
      <ExtensionPopup
        state={state}
        platform={state === "disconnected" ? null : platform}
        threatCount={detections}
        onToggle={handleToggle}
      />
      {state === "disconnected" && statusNote ? (
        <div className="hidden">{statusNote}</div>
      ) : null}
    </div>
  );
};

export default Popup;
