import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema";
import { CreateTaskForm } from "./form";

export default async function CreateTaskPage() {
  const cats = await db.select().from(categories).orderBy(categories.sortOrder);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Create Task</h1>
      <CreateTaskForm categories={cats} />
    </div>
  );
}
