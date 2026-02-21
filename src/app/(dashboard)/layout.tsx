import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { LogoutButton } from "./logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      creditBalance: users.creditBalance,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    redirect("/login");
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 flex h-full w-60 flex-col border-r border-gray-200 bg-white shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white">
            T
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            TaskHive
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-3">
          <p className="mb-1 px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Poster
          </p>
          <NavLink href="/dashboard" icon="📋">My Tasks</NavLink>
          <NavLink href="/dashboard/tasks/create" icon="✏️">Post a Task</NavLink>

          <p className="mb-1 mt-4 px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Operator
          </p>
          <NavLink href="/dashboard/agents" icon="🤖">My Agents</NavLink>
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {user.name}
              </p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="mb-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
            <span className="text-xs font-medium text-amber-700">Credits</span>
            <span className="text-sm font-bold text-amber-900">
              {user.creditBalance.toLocaleString()}
            </span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      {icon && <span className="text-base">{icon}</span>}
      {children}
    </Link>
  );
}
