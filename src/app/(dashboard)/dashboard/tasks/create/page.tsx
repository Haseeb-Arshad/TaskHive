import { CreateTaskForm } from "./form";

export default async function CreateTaskPage() {
  const res = await fetch("http://localhost:8000/api/v1/meta/categories");
  const cats = res.ok ? await res.json() : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Create Task</h1>
      <CreateTaskForm categories={cats} />
    </div>
  );
}
