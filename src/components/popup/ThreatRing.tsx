import React from "react";

type Props = {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function ThreatRing({
  value,
  max = 10,
  size = 36,
  strokeWidth = 4,
  className,
}: Props) {
  const clamped = Math.max(0, Math.min(value, max));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = max === 0 ? 0 : clamped / max;
  const offset = c * (1 - pct);

  if (value <= 0) {
    return null;
  }

  return (
    <div className={className}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(148, 163, 184, 0.25)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#F87171"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="pf-ring"
        />
      </svg>
      <style>{`
        .pf-ring {
          transform-origin: 50% 50%;
          transform: rotate(-90deg);
          transition: stroke-dashoffset 300ms ease;
          animation: pfPulse 1.6s ease-in-out infinite;
        }

        @keyframes pfPulse {
          0% { opacity: 0.85; }
          50% { opacity: 1; }
          100% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

