import { TextDecoder } from "node:util";
import { unprocessable } from "../errors.js";
import { agentFilePath } from "./agent-file-store.js";

/** Read only requested regular blobs at one immutable commit. No repository
 * archive, shell, checkout mutation, or provider credential reaches a worker. */
export async function agentSourceGitHubSnapshot(
  input: { repositoryUrl: string; ref: string; paths: string[] },
  read: (path: string) => Promise<unknown>,
) {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(input.repositoryUrl);
  if (!match || !input.ref || input.ref.length > 200 || /[\x00-\x20]/.test(input.ref)) throw unprocessable("Configure an HTTPS GitHub repository and branch without credentials");
  if (!Array.isArray(input.paths) || !input.paths.length || input.paths.length > 31 || new Set(input.paths).size !== input.paths.length) throw unprocessable("Select 1–31 distinct source files");
  const paths = input.paths.map(agentFilePath);
  if (paths.some(p => p.split("/").length > 16)) throw unprocessable("Source paths are too deep");
  const base = `/repos/${match[1]}/${match[2]}`;
  const commit = await read(`${base}/commits/${encodeURIComponent(input.ref)}`) as { sha?: string; commit?: { tree?: { sha?: string } } };
  const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{40}$/i.test(value);
  if (!sha(commit.sha) || !sha(commit.commit?.tree?.sha)) throw unprocessable("GitHub returned an invalid commit");
  type Entry = { path: string; mode: string; type: string; sha: string; size?: number };
  const trees = new Map<string, Entry[]>();
  let total = 0;
  const files: { path: string; content: string }[] = [];
  for (const path of paths) {
    let tree = commit.commit.tree.sha;
    const parts = path.split("/");
    for (let i = 0; i < parts.length; i++) {
      if (!trees.has(tree)) {
        const response = await read(`${base}/git/trees/${tree}`) as { truncated?: boolean; tree?: Entry[] };
        if (response.truncated || !Array.isArray(response.tree)) throw unprocessable("GitHub tree is incomplete");
        trees.set(tree, response.tree);
      }
      const entry = trees.get(tree)!.find(e => e.path === parts[i]);
      if (!entry || !sha(entry.sha)) throw unprocessable(`Source file missing: ${path}`);
      if (i < parts.length - 1) {
        if (entry.type !== "tree" || entry.mode !== "040000") throw unprocessable("Source directory is not a regular Git tree");
        tree = entry.sha;
        continue;
      }
      if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode) || (entry.size ?? Infinity) > 1024 * 1024) throw unprocessable("Only regular text files up to 1 MiB can be synchronized");
      const blob = await read(`${base}/git/blobs/${entry.sha}`) as { encoding?: string; content?: string };
      if (blob.encoding !== "base64" || typeof blob.content !== "string" || blob.content.length > 1500000) throw unprocessable("Unsupported source blob");
      const bytes = Buffer.from(blob.content, "base64");
      total += bytes.length;
      if (bytes.length > 1024 * 1024 || total > 4 * 1024 * 1024 || bytes.includes(0)) throw unprocessable("Source exceeds text size limits");
      let content: string;
      try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw unprocessable("Source must be UTF-8 text"); }
      files.push({ path, content });
    }
  }
  return { commit: commit.sha, files };
}
