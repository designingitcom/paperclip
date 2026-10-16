import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { PluginAgentsClient } from "@paperclipai/plugin-sdk";
const exec = promisify(execFile);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const relative = (value: string) => {
  if (!value || value.length > 512 || value.includes("\\") || value.includes("\0") || isAbsolute(value) || value.split("/").some(p => !p || p === "." || p === ".." || p === ".paperclip-runtime")) throw new Error("Invalid mapped path");
  return value;
};
export interface SourceConfig { repoPath: string; repositoryUrl?: string; connectionId?: string; companyId: string; agentId: string; agentName: string; sourcePrefix: string; entrySource: string; supportingFiles: string[]; trackingRef: string }
export interface PlannedFile { path: string; sourcePath: string; before: string | null; after: string; baseHash: string | null; targetHash: string; changed: boolean }
export interface Plan { id: string; companyId: string; agentId: string; agentName: string; commit: string; trackingRef: string; sourceLabel?: string; expiresAt: string; files: PlannedFile[] }
export interface Receipt { commit: string; completed: string[]; failed: string | null; message: string; checkedAt: string }
export function validateConfig(raw: Record<string, unknown>): SourceConfig {
  for (const key of ["companyId", "agentId", "agentName", "sourcePrefix", "entrySource", "trackingRef"]) if (typeof raw[key] !== "string" || !raw[key]) throw new Error(`Operator configuration missing: ${key}`);
  if (!Array.isArray(raw.supportingFiles) || raw.supportingFiles.some(x => typeof x !== "string") || raw.supportingFiles.length > 30) throw new Error("Configure at most 30 supporting files");
  const c = raw as unknown as SourceConfig;
  if (c.repositoryUrl) {
    if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(c.repositoryUrl) || /[\x00-\x20]/.test(c.trackingRef)) throw new Error("Invalid GitHub repository or branch");
    if (c.connectionId !== undefined && typeof c.connectionId !== "string") throw new Error("Invalid GitHub connection");
  } else if (typeof c.repoPath !== "string" || !isAbsolute(c.repoPath) || !/^refs\/(heads|remotes)\/[A-Za-z0-9._/-]+$/.test(c.trackingRef)) throw new Error("Invalid repository or tracking ref");
  relative(c.sourcePrefix); relative(c.entrySource); c.supportingFiles.forEach(relative);
  if (new Set(c.supportingFiles).size !== c.supportingFiles.length || c.supportingFiles.includes("AGENTS.md")) throw new Error("Duplicate mapped file");
  return c;
}
export async function readCommittedSource(config: SourceConfig) {
  const cwd = await realpath(config.repoPath);
  const git = async (...args: string[]) => {
    try { return (await exec("git", ["-c", "core.fsmonitor=false", "-c", "core.pager=cat", ...args], { cwd, timeout: 15000, maxBuffer: 2 * 1024 * 1024, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" } })).stdout; }
    catch { throw new Error("Cannot read configured Git snapshot. An operator must fetch the canonical repository, then retry."); }
  };
  const commit = (await git("rev-parse", "--verify", `${config.trackingRef}^{commit}`)).trim();
  if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error("Git did not return an immutable commit");
  const mapping = [{ path: "AGENTS.md", sourcePath: config.entrySource }, ...config.supportingFiles.map(path => ({ path, sourcePath: `${config.sourcePrefix}/${path}` }))];
  const files = [];
  for (const item of mapping) {
    const entry = await git("ls-tree", commit, "--", item.sourcePath);
    if (!/^100(644|755) blob [a-f0-9]+\t/.test(entry)) throw new Error(`Missing or non-regular Git file: ${item.sourcePath}`);
    const content = await git("show", `${commit}:${item.sourcePath}`);
    if (Buffer.byteLength(content) > 1024 * 1024 || content.includes("\0") || content.includes("\uFFFD")) throw new Error(`Not supported UTF-8 text: ${item.sourcePath}`);
    files.push({ ...item, content });
  }
  return { commit, files };
}
export async function makePlan(config: SourceConfig, files: PluginAgentsClient["instructions"]): Promise<Plan> {
  // Authorize the target before reading any agency repository content.
  await files.read({ companyId: config.companyId, agentId: config.agentId, path: "AGENTS.md" });
  const source = config.repositoryUrl ? await (async () => {
    const mapping = [{ path: "AGENTS.md", sourcePath: config.entrySource }, ...config.supportingFiles.map(path => ({ path, sourcePath: `${config.sourcePrefix}/${path}` }))];
    const snapshot = await files.sourceSnapshot({ companyId: config.companyId, agentId: config.agentId, repositoryUrl: config.repositoryUrl!, ref: config.trackingRef, paths: mapping.map(f => f.sourcePath), connectionId: config.connectionId });
    return { commit: snapshot.commit, files: mapping.map(f => {
      const found = snapshot.files.find(s => s.path === f.sourcePath);
      if (!found) throw new Error("GitHub snapshot omitted a mapped file");
      return { ...f, content: found.content };
    }) };
  })() : await readCommittedSource(config);
  const planned: PlannedFile[] = [];
  let reviewBytes = 0;
  for (const file of source.files) {
    const live = await files.read({ companyId: config.companyId, agentId: config.agentId, path: file.path });
    const targetHash = hash(file.content);
    reviewBytes += Buffer.byteLength(file.content) + Buffer.byteLength(live.content ?? "");
    if (reviewBytes > 8 * 1024 * 1024) throw new Error("Review exceeds the 8 MiB pilot limit; reduce the mapped text files");
    planned.push({ path: file.path, sourcePath: file.sourcePath, before: live.content, after: file.content, baseHash: live.contentHash, targetHash, changed: live.contentHash !== targetHash });
  }
  return { id: randomUUID(), companyId: config.companyId, agentId: config.agentId, agentName: config.agentName, commit: source.commit, trackingRef: config.trackingRef, sourceLabel: config.repositoryUrl ?? "Configured local Git checkout", expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), files: planned };
}
export async function applyPlan(plan: Plan, selected: string[], files: Pick<PluginAgentsClient["instructions"], "read" | "write">): Promise<Receipt> {
  if (Date.now() > Date.parse(plan.expiresAt)) throw new Error("Review expired. Check for updates again.");
  if (!selected.length || new Set(selected).size !== selected.length || selected.some(path => !plan.files.some(f => f.path === path && f.changed))) throw new Error("Select changed files from the reviewed plan");
  const chosen = plan.files.filter(f => selected.includes(f.path));
  // Preflight every selected file before the first write. Each write also uses CAS.
  for (const file of chosen) {
    const live = await files.read({ companyId: plan.companyId, agentId: plan.agentId, path: file.path });
    if (live.contentHash !== file.baseHash) throw new Error(`Live file changed: ${file.path}. Nothing synced; check for updates and review again.`);
  }
  const receipt: Receipt = { commit: plan.commit, completed: [], failed: null, message: "Verified all selected files", checkedAt: new Date().toISOString() };
  for (const file of chosen) {
    try {
      await files.write({ companyId: plan.companyId, agentId: plan.agentId, path: file.path, content: file.after, baseHash: file.baseHash });
      const saved = await files.read({ companyId: plan.companyId, agentId: plan.agentId, path: file.path });
      if (saved.contentHash !== file.targetHash || saved.content !== file.after) throw new Error("Readback differs");
      receipt.completed.push(file.path);
    } catch {
      receipt.failed = file.path;
      receipt.message = "Sync stopped. This file may have changed; check updates before retrying. Verified files are listed below. No automatic rollback.";
      break;
    }
  }
  return receipt;
}
