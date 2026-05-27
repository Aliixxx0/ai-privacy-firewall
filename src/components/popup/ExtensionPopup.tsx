import { Lock, Shield, ShieldCheck, ShieldOff } from "lucide-react";

import { LogoIcon } from "./LogoIcon";
import { ThreatRing } from "./ThreatRing";
import type { Platform, PopupState } from "./tokens";

export interface ExtensionPopupProps {
  state: PopupState;
  platform: Platform | null;
  threatCount?: number;
  onToggle?: () => void;
  preview?: boolean;
}

function getStateConfig(state: PopupState) {
  const base = {
    statusText: "ACTIVE",
    statusClass: "bg-[#10B981] text-slate-950",
    ctaText: "Protection Active",
    ctaIcon: ShieldCheck,
    ctaClass: "bg-[#10B981] text-slate-950 hover:brightness-95 active:brightness-90",
    ctaDisabled: false,
    showWarning: false,
    showPlatform: true,
    threatsMuted: false,
  } as const;

  if (state === "active-zero") {
    return {
      ...base,
    };
  }

  if (state === "active-threats") {
    return {
      ...base,
    };
  }

  if (state === "paused") {
    return {
      ...base,
      statusText: "OFF",
      statusClass: "bg-[#F87171] text-slate-950",
      ctaText: "Protection Paused",
      ctaIcon: ShieldOff,
      ctaClass: "bg-[#F87171] text-slate-950 hover:brightness-95 active:brightness-90",
      threatsMuted: true,
    };
  }

  return {
    ...base,
    statusText: "NO TAB",
    statusClass: "bg-[#FBBF24] text-slate-950",
    ctaText: "Open an AI chat tab",
    ctaIcon: Shield,
    ctaClass: "bg-slate-700 text-slate-300",
    ctaDisabled: true,
    showWarning: true,
    showPlatform: false,
    threatsMuted: true,
  };
}

export function ExtensionPopup({
  state,
  platform,
  threatCount,
  onToggle,
  preview,
}: ExtensionPopupProps) {
  const config = getStateConfig(state);
  const count =
    typeof threatCount === "number"
      ? threatCount
      : state === "active-threats"
        ? 3
        : 0;

  const threatsAccent =
    state === "active-threats"
      ? "text-[#F87171]"
      : state === "active-zero"
        ? "text-[#10B981]"
        : "text-[#94A3B8]";

  const subtext =
    state === "active-threats" && count > 0
      ? "Redacted before send ✓"
      : "No threats yet";

  const CtaIcon = config.ctaIcon;

  return (
    <div
      className={[
        "w-[320px] min-h-[420px] overflow-hidden",
        "bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white",
        "p-4 flex flex-col gap-4",
        "transition-all duration-200",
      ].join(" ")}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <LogoIcon className="h-4 w-4 shrink-0" />
          <div className="text-[14px] font-semibold tracking-tight truncate">
            AI Privacy Firewall
          </div>
        </div>

        <div
          className={[
            "px-2 py-1 rounded-full text-[10px] font-bold tracking-wider",
            "border border-[#475569]/50",
            config.statusClass,
          ].join(" ")}
        >
          {config.statusText}
        </div>
      </header>

      {config.showWarning && (
        <div className="rounded-[14px] border border-[#FBBF24]/50 bg-[#334155]/60 p-4">
          <div className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
            Warning
          </div>
          <div className="mt-1 text-[12px] text-[#FBBF24] leading-snug">
            Open ChatGPT or Claude, then refresh the page
          </div>
        </div>
      )}

      {config.showPlatform && (
        <div className="rounded-[14px] border border-[#475569]/50 bg-[#334155]/60 p-4">
          <div className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
            Protected Platform
          </div>
          <div className="mt-1 text-[24px] font-bold text-[#3B82F6]">
            {platform ?? "Unknown"}
          </div>
        </div>
      )}

      <div className="relative rounded-[14px] border border-[#475569]/50 bg-[#334155]/60 p-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
              Threats Detected
            </div>
            <div
              className={[
                "mt-2 font-extrabold leading-none",
                "text-[60px]",
                threatsAccent,
                config.threatsMuted ? "opacity-80" : "",
              ].join(" ")}
            >
              {state === "disconnected" ? "—" : count}
            </div>
            <div className="mt-2 text-[11px] text-[#94A3B8]">{subtext}</div>
          </div>

          {state === "active-threats" && count > 0 && (
            <ThreatRing value={count} max={10} className="mt-1 shrink-0" />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={preview || config.ctaDisabled ? undefined : onToggle}
        disabled={config.ctaDisabled}
        className={[
          "h-10 w-full rounded-[14px] font-semibold",
          "flex items-center justify-center gap-2",
          "transition-colors",
          config.ctaDisabled ? "cursor-not-allowed" : "",
          config.ctaClass,
        ].join(" ")}
      >
        <CtaIcon className="h-4 w-4" />
        <span className="text-[14px]">{config.ctaText}</span>
      </button>

      <footer className="flex items-center justify-center gap-2 text-[#64748B] text-[11px]">
        <Lock className="h-3.5 w-3.5" />
        <span>All processing local • No data sent</span>
      </footer>
    </div>
  );
}

