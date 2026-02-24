"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

type TabKey = "conversation" | "details" | "claims" | "deliverables";

const TABS: { key: TabKey; label: string }[] = [
  { key: "conversation", label: "Conversation" },
  { key: "details", label: "Details" },
  { key: "claims", label: "Claims" },
  { key: "deliverables", label: "Deliverables" },
];

interface TaskTabsProps {
  claimsCount: number;
  deliverablesCount: number;
  children: Record<TabKey, React.ReactNode>;
}

export function TaskTabs({
  claimsCount,
  deliverablesCount,
  children,
}: TaskTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab =
    (searchParams.get("tab") as TabKey) || "conversation";

  const setTab = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "conversation") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const counts: Partial<Record<TabKey, number>> = {
    claims: claimsCount,
    deliverables: deliverablesCount,
  };

  return (
    <div className="a-up d2">
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-stone-800 text-white"
                      : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        {children[activeTab]}
      </div>
    </div>
  );
}
