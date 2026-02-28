"use client";

interface DeliverableRendererProps {
  content: string;
}

function extractGithubUrl(content: string): string | null {
  for (const line of content.split("\n")) {
    if (line.toLowerCase().includes("github")) {
      const m = line.match(/https?:\/\/github\.com\/[^\s\n]+/);
      if (m) return m[0].trim().replace(/[)>\]".,]+$/, "");
    }
  }
  const m = content.match(/https?:\/\/github\.com\/[\w.\-]+\/[\w.\-]+/);
  return m ? m[0].trim() : null;
}

function extractVercelUrl(content: string): string | null {
  for (const line of content.split("\n")) {
    if (line.toLowerCase().includes("deployment") || line.toLowerCase().includes("vercel")) {
      const m = line.match(/https?:\/\/[\w\-]+\.vercel\.app[^\s]*/);
      if (m) return m[0].trim().replace(/[)>\]".,]+$/, "");
    }
  }
  const m = content.match(/https?:\/\/[\w\-]+\.vercel\.app[^\s]*/);
  return m ? m[0].trim() : null;
}

function getSmokeStatus(content: string): boolean | null {
  const lower = content.toLowerCase();
  const idx = lower.indexOf("smoke test");
  if (idx === -1) return null;
  const snippet = lower.slice(idx, idx + 120);
  if (snippet.includes("passed") || snippet.includes("live")) return true;
  if (snippet.includes("failed") || snippet.includes("warning")) return false;
  return null;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} className="font-semibold text-stone-800">{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return <code key={i} className="rounded bg-stone-100 px-1 py-0.5 text-[11px] font-mono text-stone-700">{p.slice(1, -1)}</code>;
        if (p.startsWith("http"))
          return <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-sky-600 underline underline-offset-2 hover:text-sky-800">{p}</a>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function renderLine(line: string, key: number) {
  if (line.startsWith("## ")) return <h3 key={key} className="mt-5 mb-2 text-sm font-bold text-stone-800 first:mt-0">{line.slice(3)}</h3>;
  if (line.startsWith("### ")) return <h4 key={key} className="mt-4 mb-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">{line.slice(4)}</h4>;
  if (line.startsWith("- ") || line.startsWith("* "))
    return <li key={key} className="ml-4 list-disc text-sm leading-relaxed text-stone-600">{renderInline(line.slice(2))}</li>;
  if (!line.trim()) return <div key={key} className="h-2" />;
  return <p key={key} className="text-sm leading-relaxed text-stone-700">{renderInline(line)}</p>;
}

function renderBlocks(content: string) {
  const fenceRe = /(```[\s\S]*?```)/g;
  const blocks: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(content)) !== null) {
    blocks.push(content.slice(last, m.index));
    blocks.push(m[0]);
    last = m.index + m[0].length;
  }
  blocks.push(content.slice(last));
  return blocks.map((block, bi) => {
    if (block.startsWith("```")) {
      const inner = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
      return (
        <pre key={bi} className="mt-3 mb-3 overflow-x-auto rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-[11px] font-mono leading-relaxed text-stone-700">
          <code>{inner.trimEnd()}</code>
        </pre>
      );
    }
    return <div key={bi}>{block.split("\n").map((line, li) => renderLine(line, li))}</div>;
  });
}

function stripBannerLines(content: string, github: string | null, vercel: string | null): string {
  let lines = content.split("\n");
  if (github) lines = lines.filter(l => !l.includes(github));
  if (vercel) lines = lines.filter(l => !l.includes(vercel));
  lines = lines.filter(l => {
    const lower = l.toLowerCase();
    return !lower.includes("**github") &&
           !lower.includes("**live deployment") &&
           !lower.includes("**smoke test");
  });
  return lines.join("\n")
    .replace(/^## Delivery Complete\s*$/im, "")
    .trim();
}

export function DeliverableRenderer({ content }: DeliverableRendererProps) {
  if (!content) return <div className="px-6 py-8 text-center text-sm text-stone-400">No content provided.</div>;

  const github = extractGithubUrl(content);
  const vercel = extractVercelUrl(content);
  const smokePass = getSmokeStatus(content);
  const hasLinks = !!(github || vercel);
  const body = hasLinks ? stripBannerLines(content, github, vercel) : content;

  return (
    <div className="px-6 py-5 space-y-4">
      {hasLinks && (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span className="text-sm font-semibold text-emerald-900">Delivery Complete</span>
            {smokePass === true && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
            {smokePass === false && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Deploy warning
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {github && (
              <a href={github} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
                View Repository
              </a>
            )}
            {vercel && !vercel.includes("Not available") && (
              <a href={vercel} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sky-500 active:scale-[0.97]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Visit Live Site
              </a>
            )}
          </div>
        </div>
      )}
      {body && <div className="space-y-1">{renderBlocks(body)}</div>}
      {!body && !hasLinks && (
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700 font-sans">{content}</pre>
      )}
    </div>
  );
}
