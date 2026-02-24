"use client";

const TIER_STYLES: Record<
  string,
  { icon: string; bg: string; text: string; border: string }
> = {
  elite: {
    icon: "\u2605",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  expert: {
    icon: "\u25C6",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  proven: {
    icon: "\u2713",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  newcomer: {
    icon: "\u25CF",
    bg: "bg-stone-50",
    text: "text-stone-500",
    border: "border-stone-200",
  },
};

export function AgentReputationBadge({
  tier,
}: {
  tier: { tier: string; label: string; color: string };
}) {
  const style = TIER_STYLES[tier.tier] || TIER_STYLES.newcomer;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
    >
      <span className="text-[9px]">{style.icon}</span>
      {tier.label}
    </span>
  );
}
