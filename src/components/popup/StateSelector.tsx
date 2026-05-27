import { Check } from "lucide-react";

import type { PopupState } from "./tokens";

type Props = {
  currentState: PopupState;
  onStateChange: (state: PopupState) => void;
};

const options: Array<{ id: PopupState; label: string }> = [
  { id: "active-zero", label: "Active (0)" },
  { id: "active-threats", label: "Active (threats)" },
  { id: "disconnected", label: "Disconnected" },
  { id: "paused", label: "Paused" },
];

export function StateSelector({ currentState, onStateChange }: Props) {
  return (
    <div className="rounded-[14px] border border-[#475569]/50 bg-[#334155]/60 p-4">
      <div className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
        State
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {options.map((option) => {
          const selected = option.id === currentState;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onStateChange(option.id)}
              className={[
                "h-9 rounded-[12px] px-3",
                "flex items-center justify-between gap-2",
                "border transition-colors",
                selected
                  ? "border-[#10B981] bg-[#0F172A]/40 text-white"
                  : "border-[#475569]/50 bg-[#0F172A]/20 text-[#94A3B8] hover:text-white",
              ].join(" ")}
            >
              <span className="text-[12px] font-medium">{option.label}</span>
              {selected && <Check className="h-4 w-4 text-[#10B981]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

