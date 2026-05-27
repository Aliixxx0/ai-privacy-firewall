import { useState } from "react";
import { LayoutGrid } from "lucide-react";

import { ExtensionPopup } from "./ExtensionPopup";
import { DesignSpecs } from "./DesignSpecs";
import { StateSelector } from "./StateSelector";
import type { Platform, PopupState } from "./tokens";

const platforms: Platform[] = ["ChatGPT", "Claude"];

export function App() {
  const [platform, setPlatform] = useState<Platform>("ChatGPT");
  const [state, setState] = useState<PopupState>("active-zero");

  const primaryProps =
    state === "disconnected"
      ? { state, platform: null as Platform | null, threatCount: 0 }
      : state === "active-threats"
        ? { state, platform, threatCount: 3 }
        : { state, platform, threatCount: 0 };

  const allStates: PopupState[] = [
    "active-zero",
    "active-threats",
    "disconnected",
    "paused",
  ];

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <div className="mx-auto max-w-[1240px] px-6 py-6">
        <div className="flex items-start gap-6">
          <aside className="w-[320px] shrink-0 space-y-4">
            <div className="rounded-[14px] border border-[#475569]/50 bg-[#334155]/60 p-4">
              <div className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                Platform
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {platforms.map((p) => {
                  const selected = p === platform;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      className={[
                        "h-9 rounded-[12px] px-3",
                        "border transition-colors",
                        selected
                          ? "border-[#3B82F6] bg-[#0F172A]/40 text-white"
                          : "border-[#475569]/50 bg-[#0F172A]/20 text-[#94A3B8] hover:text-white",
                      ].join(" ")}
                    >
                      <span className="text-[12px] font-medium">{p}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <StateSelector currentState={state} onStateChange={setState} />
            <DesignSpecs />
          </aside>

          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[14px] font-semibold tracking-tight">
                  Popup preview
                </div>
                <div className="text-[11px] text-[#94A3B8]">
                  320×420 · Tailwind · Lucide · Switch states
                </div>
              </div>
              <div className="flex items-center gap-2 text-[#94A3B8] text-[11px]">
                <LayoutGrid className="h-4 w-4" />
                <span>All states</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 items-start">
              <div className="rounded-[16px] border border-[#475569]/50 bg-[#0F172A]/50 p-4">
                <ExtensionPopup {...primaryProps} preview />
              </div>

              <div className="flex-1 min-w-[520px]">
                <div className="grid grid-cols-2 gap-6">
                  {allStates.map((s) => {
                    const props =
                      s === "disconnected"
                        ? { state: s, platform: null as Platform | null, threatCount: 0 }
                        : s === "active-threats"
                          ? { state: s, platform, threatCount: 3 }
                          : { state: s, platform, threatCount: 0 };

                    return (
                      <div
                        key={s}
                        className="rounded-[16px] border border-[#475569]/50 bg-[#0F172A]/50 p-4"
                      >
                        <div className="origin-top-left scale-[0.7] pointer-events-none">
                          <ExtensionPopup {...props} preview />
                        </div>
                        <div className="mt-2 text-[11px] text-[#94A3B8] capitalize">
                          {s.replace("-", " ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

