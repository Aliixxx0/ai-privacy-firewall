import { colors, dimensions, spacing, typography } from "./tokens";

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-[4px] border border-[#475569]/50"
      style={{ background: color }}
    />
  );
}

export function DesignSpecs() {
  const colorRows: Array<{ name: string; value: string; note: string }> = [
    { name: "Background start", value: colors.background.start, note: "Gradient" },
    { name: "Background end", value: colors.background.end, note: "Gradient" },
    { name: "Card bg", value: colors.card, note: "60% opacity" },
    { name: "Border", value: colors.border, note: "50% opacity" },
    { name: "Emerald", value: colors.emerald, note: "Active/success" },
    { name: "Blue", value: colors.blue, note: "Platform accent" },
    { name: "Red", value: colors.red, note: "Threats" },
    { name: "Amber", value: colors.amber, note: "Warnings" },
    { name: "Slate", value: colors.slate, note: "Muted labels" },
    { name: "Muted", value: colors.muted, note: "Footer microcopy" },
  ];

  return (
    <div className="rounded-[14px] border border-[#475569]/50 bg-[#334155]/60 p-4">
      <div className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
        Design specs
      </div>

      <div className="mt-4 space-y-4">
        <section>
          <div className="text-[11px] font-semibold text-white">Color system</div>
          <div className="mt-2 space-y-2">
            {colorRows.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Swatch color={row.value} />
                  <span className="text-[#94A3B8] truncate">{row.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[#94A3B8]">{row.value}</div>
                  <div className="text-[10px] text-[#64748B]">{row.note}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold text-white">Spacing</div>
          <div className="mt-2 text-[11px] text-[#94A3B8]">
            <div>Grid: {spacing.grid}px</div>
            <div>Padding: {spacing.padding}px</div>
            <div>Gaps: {spacing.gap}px</div>
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold text-white">Typography</div>
          <div className="mt-2 text-[11px] text-[#94A3B8] space-y-1">
            <div>Hero: {typography.hero}px</div>
            <div>Platform: {typography.platform}px</div>
            <div>Header: {typography.header}px</div>
            <div>Labels: {typography.label}px</div>
            <div>Footer: {typography.footer}px</div>
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold text-white">Button states</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="h-9 rounded-[12px] bg-[#10B981] text-slate-950 flex items-center justify-center text-[11px] font-semibold">
              Active
            </div>
            <div className="h-9 rounded-[12px] bg-[#F87171] text-slate-950 flex items-center justify-center text-[11px] font-semibold">
              Paused
            </div>
            <div className="h-9 rounded-[12px] bg-[#334155] text-[#94A3B8] border border-[#475569]/50 flex items-center justify-center text-[11px] font-semibold col-span-2">
              Disconnected (disabled)
            </div>
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold text-white">Dimensions</div>
          <div className="mt-2 text-[11px] text-[#94A3B8]">
            Popup: {dimensions.width}×{dimensions.height}px
          </div>
        </section>
      </div>
    </div>
  );
}

