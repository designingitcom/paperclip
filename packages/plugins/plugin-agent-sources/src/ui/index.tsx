import { useState } from "react";
import { diffLines } from "diff";
import { usePluginAction, useHostNavigation, type PluginSidebarProps } from "@paperclipai/plugin-sdk/ui";
import type { Plan, Receipt } from "../engine.js";
const errorMessage = (error: unknown, fallback: string) => error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : fallback;

export function SidebarLink(_props: PluginSidebarProps) {
  const navigation = useHostNavigation();
  return <a {...navigation.linkProps("/agent-sources")} className="flex items-center px-3 py-2 text-sm text-foreground">Agent Sources</a>;
}
export function AgentSourcesPage() {
  const check = usePluginAction("check"), sync = usePluginAction("sync");
  return <AgentSourcesView check={() => check() as Promise<Plan>} sync={(params) => sync(params) as Promise<Receipt>} />;
}
export function AgentSourcesView({ check, sync }: { check: () => Promise<Plan>; sync: (params: { planId: string; selected: string[]; reviewed: boolean }) => Promise<Receipt> }) {
  const [plan, setPlan] = useState<Plan | null>(null), [receipt, setReceipt] = useState<Receipt | null>(null);
  const [selected, setSelected] = useState<string[]>([]), [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
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
    <p className="text-sm text-muted-foreground">Pilot: configured canonical checkout and tracking ref. Git fetch/deployment remains a separate operator step. This does not update skills, adapters, models or run scripts.</p>
    {error && <div role="alert" className="border border-destructive rounded-md p-3 text-destructive">{error}</div>}
    {!plan && !receipt && !error && <p role="status">Check for updates to compare the configured agent with the deployed Git snapshot. Nothing is selected or changed automatically.</p>}
    {plan && <>
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
