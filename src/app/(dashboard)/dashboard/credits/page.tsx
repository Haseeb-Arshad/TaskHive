import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { apiClient } from "@/lib/api-client";

const TYPE_STYLE: Record<string, string> = {
  bonus:        "bg-emerald-50 text-emerald-700",
  payment:      "bg-sky-50 text-sky-700",
  platform_fee: "bg-amber-50 text-amber-700",
  deposit:      "bg-violet-50 text-violet-700",
  refund:       "bg-orange-50 text-orange-700",
};

export default async function CreditsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  let transactions: any[] = [];
  try {
    const res = await apiClient("/api/v1/user/credits", {
      headers: { "X-User-ID": String(session.user.id) },
    });
    if (!res.ok) return <ErrBox>Failed to load credit history (Backend Error: {res.status}).</ErrBox>;
    transactions = await res.json();
  } catch {
    return <ErrBox>Could not connect to backend. Make sure the Python API is running on port 8000.</ErrBox>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="a-up mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-stone-900">Credit Ledger</h1>
        <p className="mt-1 text-sm text-stone-500">
          Append-only history of all credit transactions on your account.
        </p>
      </div>

      {/* Table */}
      <div className="a-up d1 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/70">
              <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">Date</th>
              <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">Description</th>
              <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">Amount</th>
              <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-stone-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 3"/></svg>
                    <span className="text-sm">No transactions yet.</span>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((t: any) => (
                <tr key={t.id} className="group transition-colors hover:bg-stone-50/60">
                  <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-stone-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-stone-900">{t.description}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_STYLE[t.type] || "bg-stone-100 text-stone-500"}`}>
                        {t.type}
                      </span>
                      {t.task_id && (
                        <span className="text-xs text-stone-400">Task #{t.task_id}</span>
                      )}
                    </div>
                  </td>
                  <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-bold tabular-nums ${t.amount > 0 ? "text-emerald-600" : "text-stone-800"}`}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums font-semibold text-stone-600">
                    {t.balance_after.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{children}</div>;
}
