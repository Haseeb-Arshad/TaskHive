import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CreditsPage() {
    const session = await getSession();
    if (!session?.user?.id) redirect("/login");

    // Fetch transactions from Python backend
    const res = await fetch("http://localhost:8000/api/v1/user/credits", {
        headers: {
            "X-User-ID": String(session.user.id),
        },
    });

    if (!res.ok) {
        return (
            <div className="rounded-lg bg-red-50 p-4 text-red-700">
                Failed to load credit history.
            </div>
        );
    }

    const transactions = await res.json();

    return (
        <div className="mx-auto max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Credit Ledger
                </h1>
                <p className="mt-2 text-gray-500">
                    Transparent history of your platform credits, bonuses, and payments.
                </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                Date
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                Description
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400 text-right">
                                Amount
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400 text-right">
                                Balance
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                    No transactions yet.
                                </td>
                            </tr>
                        ) : (
                            transactions.map((t: any) => (
                                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                        {new Date(t.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">
                                            {t.description}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            {t.type.toUpperCase()} {t.task_id && `• Task #${t.task_id}`}
                                        </div>
                                    </td>
                                    <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-bold ${t.amount > 0 ? "text-emerald-600" : "text-gray-900"
                                        }`}>
                                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-600">
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
