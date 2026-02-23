"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") || "/dashboard";
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirect: false });
    setLoading(false);
    if (result?.error) setError("Invalid email or password.");
    else { router.push(callbackUrl); router.refresh(); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F6F3] p-4 dot-bg">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="a-up mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E5484D] shadow-lg shadow-red-200/40">
            <span className="text-lg font-black text-white">T</span>
          </div>
          <div className="text-center">
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-stone-900">Welcome back</h1>
            <p className="mt-1 text-sm text-stone-500">Sign in to TaskHive</p>
          </div>
        </div>

        <div className="a-up d1 rounded-2xl border border-stone-200 bg-white p-7 shadow-xl shadow-stone-200/40">
          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="shrink-0 text-red-400">&#x25CF;</span> {error}
            </div>
          )}

          <button type="button" onClick={() => { setGoogleLoading(true); signIn("google", { callbackUrl }); }}
            disabled={googleLoading || loading}
            className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50">
            <GoogleIcon /> {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          <div className="relative mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-100" />
            <span className="text-xs text-stone-400">or</span>
            <div className="h-px flex-1 bg-stone-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-stone-700">Email</label>
              <input id="email" name="email" type="email" required className="field" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-stone-700">Password</label>
              <input id="password" name="password" type="password" required className="field" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading || googleLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50">
              {loading && <span className="a-spin inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="a-up d2 mt-5 text-center text-sm text-stone-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-[#E5484D] hover:underline">Create one free</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
