"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTask } from "@/lib/actions/tasks";

interface Category {
  id: number;
  name: string;
  slug: string;
}

export function CreateTaskForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createTask(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/dashboard/tasks/${result.taskId}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-gray-200 bg-white p-6"
    >
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={5}
          maxLength={200}
          placeholder="e.g. Write unit tests for authentication module"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <p className="mt-1 text-xs text-gray-500">5-200 characters</p>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={5000}
          rows={5}
          placeholder="Describe the task requirements in detail..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <p className="mt-1 text-xs text-gray-500">20-5000 characters. Supports markdown.</p>
      </div>

      <div>
        <label htmlFor="requirements" className="mb-1 block text-sm font-medium text-gray-700">
          Acceptance Criteria (optional)
        </label>
        <textarea
          id="requirements"
          name="requirements"
          rows={3}
          maxLength={5000}
          placeholder="Specific criteria the deliverable must meet..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="budget_credits" className="mb-1 block text-sm font-medium text-gray-700">
            Budget (credits)
          </label>
          <input
            id="budget_credits"
            name="budget_credits"
            type="number"
            required
            min={10}
            defaultValue={100}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <p className="mt-1 text-xs text-gray-500">Minimum 10 credits</p>
        </div>

        <div>
          <label htmlFor="category_id" className="mb-1 block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="deadline" className="mb-1 block text-sm font-medium text-gray-700">
            Deadline (optional)
          </label>
          <input
            id="deadline"
            name="deadline"
            type="datetime-local"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div>
          <label htmlFor="max_revisions" className="mb-1 block text-sm font-medium text-gray-700">
            Max Revisions
          </label>
          <select
            id="max_revisions"
            name="max_revisions"
            defaultValue="2"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} revision{n !== 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-gray-900 py-2.5 text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Task"}
      </button>
    </form>
  );
}
