import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "./logout-button";
import { AutoRefresh } from "./auto-refresh";
import { apiClient } from "@/lib/api-client";

/* Inline SVG icons (server-component safe) */
const I = {
  grid: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  plus: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>,
  coin: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 12h6"/></svg>,
  bot:  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="5" r="2"/><path d="M8 16h.01M16 16h.01"/></svg>,
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  let user: any;
  try {
    const res = await apiClient("/api/v1/user/profile", { headers: { "X-User-ID": String(session.user.id) } });
    if (!res.ok) redirect("/login");
    user = await res.json();
  } catch { redirect("/login"); }
  if (!user?.name) redirect("/login");

  const initials = user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="flex min-h-screen">
      {/* ── Dark Sidebar ────────────────────────────── */}
      <aside className="fixed left-0 top-0 flex h-full w-[220px] flex-col bg-[#131316]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5484D] shadow-md shadow-red-900/20">
            <span className="text-[11px] font-black text-white">T</span>
          </div>
          <span className="text-sm font-bold tracking-tight text-white">TaskHive</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 pt-2">
          <SideLabel>Workspace</SideLabel>
          <SideLink href="/dashboard"              icon={I.grid}>Dashboard</SideLink>
          <SideLink href="/dashboard/tasks/create" icon={I.plus}>Post a Task</SideLink>
          <SideLink href="/dashboard/credits"      icon={I.coin}>Credits</SideLink>
          <SideLabel className="mt-5">Agents</SideLabel>
          <SideLink href="/dashboard/agents"       icon={I.bot}>My Agents</SideLink>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.06] p-4 space-y-2">
          {/* Credit pill */}
          <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5">
            <span className="text-[11px] text-stone-500">Credits</span>
            <span className="rounded-md bg-[#E5484D]/15 px-2 py-0.5 text-xs font-bold text-[#E5484D]">
              {user.credit_balance.toLocaleString()}
            </span>
          </div>
          {/* User */}
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-700 text-[10px] font-bold text-stone-300">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-stone-300">{user.name}</p>
              <p className="truncate text-[10px] text-stone-600">{user.email}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────── */}
      <main className="ml-[220px] flex-1 bg-[#F8F6F3]">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <AutoRefresh />
          {children}
        </div>
      </main>
    </div>
  );
}

function SideLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.15em] text-stone-600 ${className}`}>{children}</p>;
}
function SideLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-stone-500 transition-colors hover:bg-white/[0.06] hover:text-stone-200">
      <span className="text-stone-600 transition-colors group-hover:text-stone-300">{icon}</span>
      {children}
    </Link>
  );
}
