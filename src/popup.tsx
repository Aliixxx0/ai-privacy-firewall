import React, { useState, useEffect } from "react";

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

  return (
    <div className="w-80 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-lg shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">🔒 Privacy Firewall</h1>
        <span
          className={`px-2 py-1 rounded text-xs font-bold ${enabled && connected ? "bg-green-500" : "bg-red-500"}`}
        >
          {connected ? (enabled ? "ACTIVE" : "OFF") : "NO TAB"}
        </span>
      </div>

      {!connected && (
        <div className="bg-amber-900/40 border border-amber-600 rounded-lg p-3 mb-4 text-xs text-amber-200">
          {statusNote}
        </div>
      )}

      <div className="bg-slate-700 rounded-lg p-4 mb-4">
        <div className="text-xs text-slate-400 uppercase tracking-wider">
          Protected Platform
        </div>
        <div className="text-lg font-bold text-blue-400">{provider}</div>
      </div>

      <div className="bg-slate-700 rounded-lg p-4 mb-6">
        <div className="text-xs text-slate-400 uppercase tracking-wider">
          Threats Detected
        </div>
        <div className="text-3xl font-bold text-red-400">{detections}</div>
        {detections > 0 && (
          <div className="text-xs text-red-300 mt-1">Redacted before send ✓</div>
        )}
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={!connected}
        className={`w-full py-2 px-4 rounded font-bold transition ${
          !connected
            ? "bg-slate-600 text-slate-300 cursor-not-allowed"
            : enabled
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
        }`}
      >
        {!connected
          ? "Open an AI chat tab"
          : enabled
            ? "✓ Protection Active"
            : "✗ Protection Disabled"}
      </button>

      <div className="text-xs text-slate-500 text-center mt-4">
        All processing local • No data sent
      </div>
    </div>
  );
};

export default Popup;
