"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Check, GitBranch, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createRelease, fetchBranches, fetchRepos, type Repo } from "@/lib/api";

type Step = "name" | "repo" | "branch" | "saving";

const STEP_ORDER: Step[] = ["name", "repo", "branch"];

function repoShort(fullName: string): string {
  const i = fullName.indexOf("/");
  return i === -1 ? fullName : fullName.slice(i + 1);
}

export function NewReleaseSlideOver({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { getToken } = useAuth();

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [repo, setRepo] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);

  // Real data from GitHub. null = still loading.
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [branches, setBranches] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset and load the user's repos every time the panel opens.
  useEffect(() => {
    if (!open) return;
    setStep("name");
    setName("");
    setRepo(null);
    setBranch(null);
    setRepos(null);
    setBranches(null);
    setError(null);

    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const list = await fetchRepos(token);
        if (active) setRepos(list);
      } catch {
        if (active) {
          setRepos([]);
          setError("Couldn't load your repos.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [open, getToken]);

  // Close on Escape (except mid-save).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "saving") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, onClose]);

  const stepIndex = STEP_ORDER.indexOf(step); // -1 while saving
  const saving = step === "saving";

  // Pick a repo, then load its branches.
  function selectRepo(fullName: string) {
    setRepo(fullName);
    setBranch(null);
    setBranches(null);
    (async () => {
      try {
        const token = await getToken();
        const bs = await fetchBranches(token, fullName);
        setBranches(bs);
      } catch {
        setBranches([]);
        setError("Couldn't load branches for that repo.");
      }
    })();
  }

  function goNext() {
    if (step === "name" && name.trim()) setStep("repo");
    else if (step === "repo" && repo) setStep("branch");
  }

  function goBack() {
    if (step === "repo") setStep("name");
    else if (step === "branch") setStep("repo");
  }

  async function submit() {
    if (!repo || !branch || !name.trim()) return;
    setStep("saving");
    setError(null);
    try {
      const token = await getToken();
      const created = await createRelease(token, {
        name: name.trim(),
        repoFullName: repo,
        targetBranch: branch,
      });
      onClose();
      router.push(`/releases/${created.id}`);
    } catch {
      setError("Couldn't create the release. Try again.");
      setStep("branch");
    }
  }

  return (
    <div
      className={cn("fixed inset-0 z-50", open ? "" : "pointer-events-none")}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={() => !saving && onClose()}
        className={cn(
          "absolute inset-0 cursor-default bg-black/40 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New release"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl shadow-black/50 transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            {!saving && step !== "name" && (
              <button
                type="button"
                onClick={goBack}
                aria-label="Back"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <h2 className="text-sm font-medium">New Release</h2>
          </div>
          {!saving && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Stepper */}
        {!saving && (
          <div className="flex items-center gap-1.5 px-5 pt-4">
            {STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-foreground" : "bg-border",
                )}
              />
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && !saving && (
            <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {error}
            </p>
          )}

          {step === "name" && (
            <div>
              <label htmlFor="release-name" className="text-sm font-medium">
                Release name
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                A human name for this release, e.g. &ldquo;Q3 Launch&rdquo;.
              </p>
              <input
                id="release-name"
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goNext()}
                placeholder="Release name"
                className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          )}

          {step === "repo" && (
            <div>
              <p className="text-sm font-medium">Repository</p>
              <p className="mt-1 text-xs text-muted-foreground">
                From your connected GitHub account.
              </p>
              {repos === null ? (
                <p className="mt-3 text-xs text-muted-foreground">Loading your repos…</p>
              ) : repos.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">No repos found.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {repos.map((r) => {
                    const active = repo === r.fullName;
                    return (
                      <li key={r.fullName}>
                        <button
                          type="button"
                          onClick={() => selectRepo(r.fullName)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                            active
                              ? "border-foreground/30 bg-secondary"
                              : "border-border hover:bg-secondary",
                          )}
                        >
                          <span className="truncate font-mono text-sm">{r.fullName}</span>
                          {active && <Check className="size-4 shrink-0 text-success" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {step === "branch" && repo && (
            <div>
              <p className="text-sm font-medium">Target branch</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitBranch className="size-3.5" />
                <span className="font-mono">{repo}</span>
              </p>
              {branches === null ? (
                <p className="mt-3 text-xs text-muted-foreground">Loading branches…</p>
              ) : branches.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">No branches found.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {branches.map((b) => {
                    const active = branch === b;
                    return (
                      <li key={b}>
                        <button
                          type="button"
                          onClick={() => setBranch(b)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                            active
                              ? "border-foreground/30 bg-secondary"
                              : "border-border hover:bg-secondary",
                          )}
                        >
                          <span className="truncate font-mono text-sm">{b}</span>
                          {active && <Check className="size-4 shrink-0 text-success" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {saving && (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm font-medium">Creating release…</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {repoShort(repo ?? "")} / {branch}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!saving && (
          <div className="border-t border-border px-5 py-4">
            {step === "branch" ? (
              <button
                type="button"
                onClick={submit}
                disabled={!branch}
                className="w-full rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
              >
                Create release
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={step === "name" ? !name.trim() : !repo}
                className="w-full rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
              >
                Continue
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
