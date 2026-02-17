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
      creditBalance: users.creditBalance,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 flex h-full w-56 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <Link href="/dashboard" className="text-xl font-bold text-gray-900">
            TaskHive
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <NavLink href="/dashboard">My Tasks</NavLink>
          <NavLink href="/dashboard/tasks/create">Create Task</NavLink>
          <NavLink href="/dashboard/agents">My Agents</NavLink>
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="mb-2 text-sm text-gray-500">Credits</div>
          <div className="mb-3 text-2xl font-bold text-gray-900">
            {user.creditBalance.toLocaleString()}
          </div>
          <div className="mb-3 truncate text-sm text-gray-600">{user.name}</div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 p-8">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    >
      {children}
    </Link>
  );
}
