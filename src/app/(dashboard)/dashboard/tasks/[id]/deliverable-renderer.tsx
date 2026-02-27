"use client";

/**
 * Renders a deliverable content string as rich HTML.
 * Detects GitHub repos, Vercel URLs, and formats markdown-ish content
 * without requiring an external library.
 */

interface DeliverableRendererProps {
  content: string;
}

function extractUrls(content: string) {
  const github = content.match(/https:\/\/github\.com\/[^\s)>\]"]+/)?.[0] ?? null;
  const vercel = content.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app[^\s)>\]"]*/)?.[0] ?? null;
  const smokePass = /smoke test.*passed|✅ passed/i.test(content);
  const smokeFail = /smoke test.*failed|warning.*smoke/i.test(content);
  return { github, vercel, smokePass, smokeFail };
}

function renderLine(line: string, idx: number) {
  // Bold **text**
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  const rendered = parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );

  // Heading
  if (line.startsWith("### ")) return <h3 key={idx} className="mt-4 mb-1 text-sm font-bold text-stone-800">{rendered}</h3>;
  if (line.startsWith("## "))  return <h2 key={idx} className="mt-5 mb-1 text-base font-bold text-stone-900">{rendered}</h2>;
  if (line.startsWith("# "))   return <h1 key={idx} className="mt-5 mb-2 text-lg font-bold text-stone-900">{rendered}</h1>;

  // Bullet
  if (line.startsWith("- ") || line.startsWith("* ")) {
    return (
      <li key={idx} className="ml-4 list-disc text-sm text-stone-700 leading-relaxed">
        {rendered.slice(1) /* drop the "- " prefix text node */}
        {/* Actually re-render without the prefix char */}
        {renderInline(line.slice(2))}
      </li>
    );
  }

  // Blank line
  if (!line.trim()) return <div key={idx} className="h-2" />;

  // Emoji line (delivery summary line)
  return (
    <p key={idx} className="text-sm text-stone-700 leading-relaxed">
      {renderInline(line)}
    </p>
  );
}

function renderInline(text: string) {
  // Split on **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))  return <code key={i} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs text-stone-800">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

export function DeliverableRenderer({ content }: DeliverableRendererProps) {
  const { github, vercel, smokePass, smokeFail } = extractUrls(content);

  // Strip known URL lines so they don't appear twice
  const bodyLines = content
    .split("\n")
    .filter((l) => {
      if (github && l.includes(github)) return false;
      if (vercel && l.includes(vercel)) return false;
      return true;
    });

  return (
    <div className="px-6 py-5 space-y-1">
      {/* ── Site delivery banner ─────────────────────────────────── */}
      {(github || vercel) && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-600">
            Delivery Links
          </p>
          <div className="flex flex-wrap gap-3">
            {github && (
              <a
                href={github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:bg-stone-50"
              >
                {/* GitHub icon */}
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                View Repository
              </a>
            )}
            {vercel && (
              <a
                href={vercel}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700"
              >
                {/* Vercel triangle */}
                <svg viewBox="0 0 76 65" className="h-3.5 w-3.5 fill-current">
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
                Visit Live Site
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 opacity-70">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
          </div>
          {/* Smoke test badge */}
          {vercel && (smokePass || smokeFail) && (
            <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              smokePass
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {smokePass ? "✓ Smoke test passed — site is live" : "⚠ Smoke test warning — check the site"}
            </div>
          )}
        </div>
      )}

      {/* ── Rendered body ─────────────────────────────────────────── */}
      <div className="space-y-0.5">
        {bodyLines.map((line, i) => renderLine(line, i))}
      </div>
    </div>
  );
}
