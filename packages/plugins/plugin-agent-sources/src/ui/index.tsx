import { useEffect, useState } from "react";
import { diffLines } from "diff";
import { GitPullRequest } from "lucide-react";
import { usePluginAction, useHostContext, useHostNavigation, useHostLocation, type PluginSidebarProps } from "@paperclipai/plugin-sdk/ui";
import type { Plan, Receipt } from "../engine.js";
const errorMessage = (error: unknown, fallback: string) => error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : fallback;

export function SidebarLink(_props: PluginSidebarProps) {
  const navigation = useHostNavigation();
  const location = useHostLocation();
  const active = location.pathname === navigation.resolveHref("/agent-sources");
  // Match the host SidebarNavItem; the SDK does not expose that component.
  return <a {...navigation.linkProps("/agent-sources")} aria-current={active ? "page" : undefined} className={`flex items-center gap-2.5 mx-2 rounded-lg px-2 py-1.5 pointer-coarse:py-1 text-(length:--text-compact) font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}><span data-slot="sidebar-nav-icon" className="relative shrink-0"><GitPullRequest className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate">Agent Sources</span></a>;
}
export function AgentSourcesPage() {
  const { companyId } = useHostContext();
  return <AgentSourcesSelector key={companyId ?? "no-company"} />;
}
function AgentSourcesSelector() {
  const list = usePluginAction("sources"), check = usePluginAction("check"), sync = usePluginAction("sync");
  const [sources, setSources] = useState<Array<{ agentId: string; agentName: string }> | null>(null);
  const [agentId, setAgentId] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setError(null); setSources(null);
    void list().then(value => {
      if (!current) return;
      const next = value as Array<{ agentId: string; agentName: string }>;
      setSources(next); setAgentId(next[0]?.agentId ?? "");
    }).catch(e => { if (current) setError(errorMessage(e, "Could not load configured agents. Retry or ask an administrator to configure Agent Sources.")); });
    return () => { current = false; };
  }, [list, attempt]);
  if (error) return <section className="p-6 space-y-3"><h1 className="text-xl font-semibold">Agent Sources</h1><p role="alert">{error}</p><button className="rounded-md border border-border px-3 py-2" onClick={() => setAttempt(value => value + 1)}>Retry</button></section>;
  if (!sources) return <p className="p-6" role="status">Loading configured agents…</p>;
  if (!sources.length) return <p className="p-6" role="status">No Git-managed agents are configured. Ask an administrator to add a mapping in Agent Sources settings.</p>;
  return <div className="max-w-4xl text-sm">
    <div className="px-6 pt-6"><label className="flex flex-wrap items-center gap-3 text-sm">Git-managed agent<select aria-label="Git-managed agent" disabled={working} className="rounded-md border border-border bg-background text-foreground px-3 py-2 max-w-full focus-visible:outline focus-visible:outline-ring disabled:opacity-50" value={agentId} onChange={event => setAgentId(event.target.value)}>{sources.map(source => <option key={source.agentId} value={source.agentId}>{source.agentName}</option>)}</select></label><p className="text-xs text-muted-foreground mt-2">Changing agents clears the current review. Each agent is checked and synced separately.</p></div>
    <AgentSourcesView key={agentId} onBusyChange={setWorking} check={() => check({ agentId }) as Promise<Plan>} sync={(params) => sync(params) as Promise<Receipt>} />
  </div>;
}
export function AgentSourcesView({ check, sync, onBusyChange }: { check: () => Promise<Plan>; sync: (params: { planId: string; selected: string[]; reviewed: boolean }) => Promise<Receipt>; onBusyChange?: (busy: boolean) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null), [receipt, setReceipt] = useState<Receipt | null>(null);
  const [selected, setSelected] = useState<string[]>([]), [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const button = "rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-ring";
  async function checkUpdates() {
    setBusy(true); setError(null); setPlan(null); setSelected([]); setReviewed(false); setReceipt(null);
    try { setPlan(await check()); } catch (e) { setError(errorMessage(e, "Check failed. Try again.")); } finally { setBusy(false); }
  }
  async function publish() {
    if (!plan || !reviewed) return;
    setBusy(true); setError(null);
    try { setReceipt(await sync({ planId: plan.id, selected, reviewed })); setPlan(null); setSelected([]); setReviewed(false); }
    catch (e) { setError(errorMessage(e, "Sync failed. Check updates before retrying.")); setPlan(null); }
    finally { setBusy(false); }
  }
  return <section className="p-6 space-y-6 text-foreground" aria-busy={busy}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold">Agent Sources</h1><p className="text-sm text-muted-foreground">Review Git changes before updating installed agent files.</p></div>
      <button className={button} disabled={busy} onClick={() => void checkUpdates()}>{busy ? "Working…" : "Check for updates"}</button>
    </header>
    <p className="text-sm text-muted-foreground">Compare Git with this agent’s installed files. Review changes before syncing. Skills, adapters and models stay unchanged; scripts are not executed.</p>
    {error && <div role="alert" className="border border-destructive rounded-md p-3 text-destructive">{error}</div>}
    {!plan && !receipt && !error && <p role="status" className="text-sm text-muted-foreground">No changes selected. Choose Check for updates to begin.</p>}
    {plan && <>
      <p className="text-sm break-all">Source: {plan.sourceLabel ?? "Configured Git source"}</p>
      <div className="space-y-1"><h2 className="font-semibold">{plan.agentName}</h2><p className="text-sm break-all">Company <code>{plan.companyId}</code> · Agent <code>{plan.agentId}</code></p><p className="text-sm break-all"><code>{plan.trackingRef}</code> · Commit <code>{plan.commit}</code></p><p className="text-sm text-muted-foreground">Review expires {new Date(plan.expiresAt).toLocaleTimeString()}. Only checked files will be synced.</p></div>
      {!plan.files.some(f => f.changed) && <p role="status">All mapped files are in sync.</p>}
      <div className="divide-y divide-border border-y border-border">{plan.files.map(file => <article key={file.path} className="py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 flex-1 min-w-0"><input type="checkbox" aria-label={`Sync ${file.path}`} disabled={!file.changed || busy} checked={selected.includes(file.path)} onChange={e => { setSelected(e.target.checked ? [...selected, file.path] : selected.filter(p => p !== file.path)); setReviewed(false); }} /><code className="break-all text-sm">{file.path}</code></label><span className="text-sm text-muted-foreground">{file.changed ? file.before === null ? "New file" : "Changed" : "In sync"}</span></div>
        {file.changed && <details><summary className="cursor-pointer text-sm">Show diff: {file.path}</summary><p className="text-xs text-muted-foreground break-all">Source: {file.sourcePath}</p><pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-auto bg-muted rounded-md p-3" aria-label={`Diff ${file.path}`}>{diffLines(file.before ?? "", file.after).map((part, i) => <span key={i} className={part.added ? "text-foreground font-semibold" : part.removed ? "text-destructive" : "text-muted-foreground"}>{part.value.split(/(?<=\n)/).map(line => `${part.added ? "+" : part.removed ? "−" : " "} ${line}`).join("")}</span>)}</pre></details>}
      </article>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={!selected.length || busy} onChange={e => setReviewed(e.target.checked)} />I reviewed the selected changes for this agent.</label>
      <footer className="flex flex-wrap justify-between items-center gap-3"><button className={button} disabled={busy} onClick={() => { setPlan(null); setSelected([]); setReviewed(false); }}>Cancel review</button><button className={`${button} bg-primary text-primary-foreground`} disabled={!reviewed || !selected.length || busy} onClick={() => void publish()}>Sync {selected.length} selected {selected.length === 1 ? "file" : "files"}</button></footer>
    </>}
    {receipt && <div role="status" className="space-y-2 border border-border rounded-md p-4"><h2 className="font-semibold">{receipt.failed ? "Sync needs attention" : "Sync verified"}</h2><p>{receipt.message}</p><p className="text-sm break-all">Source commit <code>{receipt.commit}</code></p><ul>{receipt.completed.map(path => <li key={path}><code>{path}</code> — readback verified</li>)}</ul>{receipt.failed && <p>Unverified: <code>{receipt.failed}</code></p>}<p className="text-sm text-muted-foreground">{receipt.checkedAt}</p></div>}
  </section>;
}
