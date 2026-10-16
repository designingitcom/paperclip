import { describe, expect, it, vi } from "vitest";
import { agentSourceGitHubSnapshot } from "../services/agent-source-github-snapshot.js";
const commit = "a".repeat(40), tree = "b".repeat(40), blob = "c".repeat(40);
const input = { repositoryUrl: "https://github.com/example/repo", ref: "main", paths: ["AGENTS.md"] };
function reader(mode = "100644", bytes = Buffer.from("hello")) {
  return vi.fn(async (path: string) => {
    if (path.includes("/commits/")) return { sha: commit, commit: { tree: { sha: tree } } };
    if (path.includes("/trees/")) return { tree: [{ path: "AGENTS.md", mode, type: "blob", sha: blob, size: bytes.length }] };
    return { encoding: "base64", content: bytes.toString("base64") };
  });
}
describe("bounded GitHub agent source snapshot", () => {
  it("resolves branch once then reads immutable regular blobs", async () => {
    const read = reader();
    expect(await agentSourceGitHubSnapshot(input, read)).toEqual({ commit, files: [{ path: "AGENTS.md", content: "hello" }] });
    expect(read.mock.calls.map(c => c[0])).toEqual(["/repos/example/repo/commits/main", `/repos/example/repo/git/trees/${tree}`, `/repos/example/repo/git/blobs/${blob}`]);
  });
  it.each(["120000", "160000"])("rejects symlinks and submodules %s", async mode => {
    await expect(agentSourceGitHubSnapshot(input, reader(mode))).rejects.toThrow("regular text");
  });
  it.each([Buffer.from([0]), Buffer.from([255]), Buffer.alloc(1024 * 1024 + 1)])("rejects binary, invalid UTF8 or oversized files", async bytes => {
    await expect(agentSourceGitHubSnapshot(input, reader("100644", bytes))).rejects.toThrow();
  });
  it("rejects unsafe repositories and traversal before networking", async () => {
    const read = reader();
    for (const repositoryUrl of ["https://secret@github.com/example/repo", "http://github.com/example/repo", "https://evil.test/example/repo"]) await expect(agentSourceGitHubSnapshot({ ...input, repositoryUrl }, read)).rejects.toThrow();
    await expect(agentSourceGitHubSnapshot({ ...input, paths: ["../secret"] }, read)).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it("does not fall back to stale content when provider rejects access", async () => {
    await expect(agentSourceGitHubSnapshot(input, async () => { throw new Error("denied"); })).rejects.toThrow("denied");
  });
});
