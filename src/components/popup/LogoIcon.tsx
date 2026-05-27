import React from "react";

type Props = {
  className?: string;
  title?: string;
};

export function LogoIcon({ className, title = "AI Privacy Firewall" }: Props) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <path
        d="M8 0.9C9.7 2.0 11.6 2.7 13.7 3.1V8.4C13.7 11.6 11.5 14.1 8 15.1C4.5 14.1 2.3 11.6 2.3 8.4V3.1C4.4 2.7 6.3 2.0 8 0.9Z"
        fill="#10B981"
      />
      <path
        d="M4.7 6.1H11.3V7.3H4.7V6.1Z"
        fill="#0F172A"
        fillOpacity="0.75"
      />
      <path
        d="M4.7 8.7H11.3V9.9H4.7V8.7Z"
        fill="#0F172A"
        fillOpacity="0.75"
      />
    </svg>
  );
}

