"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Pencil, RefreshCw, Save, Sparkles, X } from "lucide-react";
import {
  generateReleaseNotes,
  saveReleaseNotes,
  type Release,
} from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";

// --- Minimal Markdown renderer ----------------------------------------------
// Only the subset the AI is asked for: headings, bullet/ordered lists, fenced
// code, bold/italic/inline code/links. Built as React elements (no
// innerHTML) so stored notes can't inject markup.

function renderInline(text: string, keyBase: string): ReactNode[] {
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-medium text-foreground">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      const href = lm && /^https?:\/\//i.test(lm[2]) ? lm[2] : null;
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2 transition-colors hover:text-primary"
          >
            {lm![1]}
          </a>
        ) : (
          lm?.[1] ?? tok
        ),
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code block.
    if (line.trimStart().startsWith("```")) {
      i += 1;
      const buf: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or EOF)
      out.push(
        <pre
          key={key++}
          className="mt-4 overflow-x-auto rounded-lg border border-border bg-secondary p-4 font-mono text-xs leading-relaxed text-foreground first:mt-0"
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading.
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const deep = h[1].length > 2;
      out.push(
        deep ? (
          <p
            key={key++}
            className="mt-4 text-sm font-medium text-foreground first:mt-0"
          >
            {renderInline(h[2], `h${key}`)}
          </p>
        ) : (
          <h3
            key={key++}
            className="mt-5 font-mono text-xs uppercase tracking-wide text-muted-foreground first:mt-0"
          >
            {renderInline(h[2], `h${key}`)}
          </h3>
        ),
      );
      i += 1;
      continue;
    }

    // Bullet list.
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      out.push(
        <ul
          key={key++}
          className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border"
        >
          {items.map((item, n) => (
            <li key={n}>{renderInline(item, `li${key}-${n}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list.
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      out.push(
        <ol
          key={key++}
          className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border"
        >
          {items.map((item, n) => (
            <li key={n}>{renderInline(item, `ol${key}-${n}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph — swallow consecutive plain lines.
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```")
    ) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(
      <p key={key++} className="mt-3 text-sm leading-relaxed text-muted-foreground first:mt-0">
        {renderInline(para.join(" "), `p${key}`)}
      </p>,
    );
  }

  return out;
}

// --- Release notes card ------------------------------------------------------

type Props = {
  release: Release;
  // Called with the updated release row after a generate or save so the
  // page's state stays in sync.
  onChange: (release: Release) => void;
};

const ghostBtn =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:pointer-events-none disabled:opacity-60";

export function ReleaseNotesCard({ release, onChange }: Props) {
  const { getToken } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const notes = release.release_notes;

  async function handleGenerate(force: boolean) {
    if (generating) return;
    setError(null);
    setNotice(null);
    try {
      setGenerating(true);
      const token = await getToken();
      const res = await generateReleaseNotes(token, release.id, { force });
      onChange(res.release);
      setNotice(
        res.cached
          ? "Branch tip hasn't changed — kept the existing notes."
          : `Generated from ${res.commitCount} commit${
              res.commitCount === 1 ? "" : "s"
            } on ${release.target_branch}.`,
      );
    } catch {
      setError("Couldn't generate release notes. Check the repo and branch, then try again.");
    } finally {
      setGenerating(false);
    }
  }

  function startEdit() {
    setError(null);
    setNotice(null);
    setDraft(notes ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (saving) return;
    if (!draft.trim()) {
      setError("Notes can't be empty — write something or cancel.");
      return;
    }
    setError(null);
    try {
      setSaving(true);
      const token = await getToken();
      const rel = await saveReleaseNotes(token, release.id, draft);
      onChange(rel);
      setEditing(false);
    } catch {
      setError("Couldn't save your edits. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="text-sm font-medium text-card-foreground">
            Release notes
          </h2>
          {notes && !editing && (
            <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {release.notes_edited ? "Hand-edited" : "AI-generated"}
            </span>
          )}
        </div>

        {editing ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className={ghostBtn}
            >
              <X className="size-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-mono text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save
                </>
              )}
            </button>
          </div>
        ) : (
          notes && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void handleGenerate(true)}
                disabled={generating}
                className={ghostBtn}
              >
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {generating ? "Writing…" : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={startEdit}
                disabled={generating}
                className={ghostBtn}
              >
                <Pencil className="size-3.5" />
                Edit
              </button>
            </div>
          )
        )}
      </div>

      {editing ? (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            Markdown — headings, lists, bold, code. Saved straight to this
            release.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            spellCheck={false}
            className="mt-3 w-full resize-y rounded-lg border border-border bg-background/50 p-4 font-mono text-xs leading-relaxed text-foreground transition-colors focus-visible:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
          />
        </>
      ) : notes ? (
        <div className="mt-4">{renderMarkdown(notes)}</div>
      ) : (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            No release notes yet. Generated from the commits on{" "}
            <span className="font-mono text-foreground">
              {release.target_branch}
            </span>{" "}
            — nothing is written until you ask.
          </p>
        </div>
      )}

      {!editing && !notes && (
        <button
          type="button"
          onClick={() => void handleGenerate(false)}
          disabled={generating}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Writing notes…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate with AI
            </>
          )}
        </button>
      )}

      {!editing && notes && release.notes_generated_at && (
        <p
          className={cn(
            "mt-5 border-t border-border pt-3 font-mono text-xs text-muted-foreground",
            notice && "hidden",
          )}
        >
          {release.notes_edited
            ? "Edited by hand"
            : `Generated ${timeAgo(release.notes_generated_at)}`}{" "}
          · from {release.target_branch}
        </p>
      )}

      {notice && !editing && (
        <p className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  );
}
