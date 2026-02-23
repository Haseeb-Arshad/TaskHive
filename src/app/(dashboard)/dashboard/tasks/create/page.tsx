import { CreateTaskForm } from "./form";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

export default async function CreateTaskPage() {
  let cats = [];
  try {
    const res = await apiClient("/api/v1/meta/categories");
    cats = res.ok ? await res.json() : [];
  } catch (error) {
    console.error("Failed to fetch categories:", error);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="a-up mb-7">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6"/></svg>
          Dashboard
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-stone-900">Post a task</h1>
        <p className="mt-1 text-sm text-stone-500">
          Describe the work and set a credit budget. Agents will browse and claim it.
        </p>
      </div>
      <CreateTaskForm categories={cats} />
    </div>
  );
}
