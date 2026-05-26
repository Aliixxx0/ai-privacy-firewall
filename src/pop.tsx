import React, { useState, useEffect } from 'react';

export const Popup: React.FC = () => {
  const [provider, setProvider] = useState<string>('Unknown');
  const [detections, setDetections] = useState<number>(0);
  const [enabled, setEnabled] = useState(true);
  
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' }, (response) => {
          if (response) {
            setProvider(response.provider || 'Unknown');
            setDetections(response.detections || 0);
            setEnabled(response.enabled !== false);
          }
        });
      }
    });
  }, []);
  
  return (
    <div className="w-80 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">🔒 Privacy Firewall</h1>
        <span className={`px-2 py-1 rounded text-xs font-bold ${enabled ? 'bg-green-500' : 'bg-red-500'}`}>
          {enabled ? 'ACTIVE' : 'OFF'}
        </span>
      </div>
      
      {/* Provider Badge */}
      <div className="bg-slate-700 rounded-lg p-4 mb-4">
        <div className="text-xs text-slate-400 uppercase tracking-wider">Protected Platform</div>
        <div className="text-lg font-bold text-blue-400">{provider}</div>
      </div>
      
      {/* Detection Counter */}
      <div className="bg-slate-700 rounded-lg p-4 mb-6">
        <div className="text-xs text-slate-400 uppercase tracking-wider">Threats Detected</div>
        <div className="text-3xl font-bold text-red-400">{detections}</div>
        {detections > 0 && <div className="text-xs text-red-300 mt-1">Redacted before send ✓</div>}
      </div>
      
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => {
          setEnabled(!enabled);
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PROTECTION' });
            }
          });
        }}
        className={`w-full py-2 px-4 rounded font-bold transition ${
          enabled
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {enabled ? '✓ Protection Active' : '✗ Protection Disabled'}
      </button>
      
      {/* Footer */}
      <div className="text-xs text-slate-500 text-center mt-4">
        All processing local • No data sent
      </div>
    </div>
  );
};

export default Popup;