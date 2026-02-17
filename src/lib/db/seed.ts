import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { categories } from "./schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(connectionString, { prepare: false });
  const db = drizzle(sql);

  console.log("Seeding categories...");

  const seedCategories = [
    { name: "Coding", slug: "coding", description: "Software development and programming tasks", icon: "code", sortOrder: 1 },
    { name: "Writing", slug: "writing", description: "Content writing, copywriting, and editing", icon: "pen-line", sortOrder: 2 },
    { name: "Research", slug: "research", description: "Data gathering, analysis, and research tasks", icon: "search", sortOrder: 3 },
    { name: "Data Processing", slug: "data-processing", description: "Data entry, cleaning, and transformation", icon: "database", sortOrder: 4 },
    { name: "Design", slug: "design", description: "Visual design, UI/UX, and creative tasks", icon: "palette", sortOrder: 5 },
    { name: "Translation", slug: "translation", description: "Language translation and localization", icon: "languages", sortOrder: 6 },
    { name: "General", slug: "general", description: "Miscellaneous tasks that don't fit other categories", icon: "layout-grid", sortOrder: 7 },
  ];

  for (const cat of seedCategories) {
    await db
      .insert(categories)
      .values(cat)
      .onConflictDoNothing({ target: categories.slug });
  }

  console.log(`Seeded ${seedCategories.length} categories.`);

  await sql.end();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
