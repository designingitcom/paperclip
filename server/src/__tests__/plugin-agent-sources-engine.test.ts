import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { applyPlan, validateConfig, type Plan } from "../../../packages/plugins/plugin-agent-sources/src/engine.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function fixture() {
  const content = new Map([["AGENTS.md", "old"], ["scripts/helper.py", "old helper"]]);
  const files = {
    read: vi.fn(async ({ path }: { path: string }) => ({ path, content: content.get(path) ?? null, contentHash: content.has(path) ? hash(content.get(path)!) : null })),
    write: vi.fn(async ({ path, content: next, baseHash }: { path: string; content: string; baseHash: string | null }) => {
      if ((content.has(path) ? hash(content.get(path)!) : null) !== baseHash) throw new Error("conflict");
      content.set(path, next); return { changed: true, contentHash: hash(next) };
    }),
  };
  const plan: Plan = { id: "review", companyId: "company", agentId: "agent", agentName: "Fixture", commit: "a".repeat(40), trackingRef: "refs/heads/main", expiresAt: new Date(Date.now() + 60000).toISOString(), files: [...content].map(([path, before]) => ({ path, sourcePath: path, before, after: `new ${before}`, baseHash: hash(before), targetHash: hash(`new ${before}`), changed: true })) };
  return { content, files, plan };
}
describe("Agent Sources reviewed sync", () => {
  it("writes only selected files and verifies readback", async () => {
    const f = fixture();
    expect(await applyPlan(f.plan, ["AGENTS.md"], f.files)).toMatchObject({ completed: ["AGENTS.md"], failed: null });
    expect(f.content.get("scripts/helper.py")).toBe("old helper");
  });
  it("preflights all files before writing any", async () => {
    const f = fixture(); f.content.set("scripts/helper.py", "newer live work");
    await expect(applyPlan(f.plan, ["AGENTS.md", "scripts/helper.py"], f.files)).rejects.toThrow("Live file changed");
    expect(f.files.write).not.toHaveBeenCalled();
  });
  it("reports partial failure without claiming rollback", async () => {
    const f = fixture(); f.files.write.mockImplementationOnce(async input => { f.content.set(input.path, input.content); return { changed: true, contentHash: hash(input.content) }; }).mockRejectedValueOnce(new Error("denied"));
    expect(await applyPlan(f.plan, ["AGENTS.md", "scripts/helper.py"], f.files)).toMatchObject({ completed: ["AGENTS.md"], failed: "scripts/helper.py" });
  });
  it("rejects expired review and arbitrary/duplicate selections", async () => {
    const f = fixture();
    for (const selected of [[], ["unknown"], ["AGENTS.md", "AGENTS.md"]]) await expect(applyPlan(f.plan, selected, f.files)).rejects.toThrow();
    f.plan.expiresAt = new Date(0).toISOString();
    await expect(applyPlan(f.plan, ["AGENTS.md"], f.files)).rejects.toThrow("expired");
    expect(f.files.write).not.toHaveBeenCalled();
  });
  it("rejects unsafe operator mappings", () => {
    expect(() => validateConfig({ repoPath: "/tmp/repo", companyId: "c", agentId: "a", agentName: "n", entrySource: "../secret", sourcePrefix: "agents/a", supportingFiles: [], trackingRef: "refs/heads/main" })).toThrow("Invalid mapped path");
  });
});
