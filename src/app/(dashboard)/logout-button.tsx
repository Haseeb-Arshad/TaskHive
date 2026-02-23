"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-stone-500 transition-colors hover:bg-white/[0.06] hover:text-stone-300"
    >
      Sign out
    </button>
  );
}
