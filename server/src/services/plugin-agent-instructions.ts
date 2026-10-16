import type { Db } from "@paperclipai/db";
import type { WorkerHostCallContext } from "@paperclipai/plugin-sdk";
import { forbidden, unprocessable } from "../errors.js";
import { agentFilePath, agentFileStore, inspectAgentFile } from "./agent-file-store.js";
import { instructionBytes } from "./agent-instruction-files.js";
import { skillSourceGitHubReader } from "./skill-source-github-access.js";
import { agentSourceGitHubSnapshot } from "./agent-source-github-snapshot.js";

/** Authority comes only from the manager's active invocation registry, never
 * from a plugin-supplied user ID, company membership cache, or shared token. */
export function instructionActionActor(companyId: string, context?: WorkerHostCallContext) {
  const scope = context?.invocationScope;
  if (context?.invalidInvocationScope || !scope?.actionUserId || scope.companyId !== companyId) {
    throw forbidden("Agent instruction access requires an authenticated user action in this company");
  }
  return { type: "board" as const, userId: scope.actionUserId };
}

export function pluginAgentInstructions(db: Db) {
  const files = agentFileStore(db);
  return {
    async sourceSnapshot(input: { companyId: string; agentId: string; repositoryUrl: string; ref: string; paths: string[]; connectionId?: string }, context?: WorkerHostCallContext) {
      const actor = instructionActionActor(input.companyId, context);
      // Reauthorize target before any GitHub request. No cached membership or
      // local_implicit privilege is inferred from an action's user ID.
      await files.locked(input.companyId, input.agentId, actor, false, async () => undefined);
      const reader = skillSourceGitHubReader(db, input.companyId, actor, input.connectionId ?? null);
      const signal = AbortSignal.timeout(25_000);
      const scan = () => agentSourceGitHubSnapshot(input, path => reader(path, signal));
      return reader.withScan ? reader.withScan(scan) : scan();
    },
    async read(input: { companyId: string; agentId: string; path: string }, context?: WorkerHostCallContext) {
      const actor = instructionActionActor(input.companyId, context);
      const relative = agentFilePath(input.path);
      return files.locked(input.companyId, input.agentId, actor, false, async (_tx, _agent, root) => {
        const file = await inspectAgentFile(root, relative, 1024 * 1024, true);
        if (file && !file.bytes) throw unprocessable("Plugin instruction files must be UTF-8 text no larger than 1 MiB");
        const bytes = file?.bytes ? instructionBytes(file.bytes) : null;
        if (bytes?.includes(0)) throw unprocessable("Plugin instruction files must be text");
        return { path: relative, content: bytes?.toString("utf8") ?? null, contentHash: file?.hash ?? null };
      });
    },
    async write(input: { companyId: string; agentId: string; path: string; content: string; baseHash: string | null }, context?: WorkerHostCallContext) {
      const actor = instructionActionActor(input.companyId, context);
      if (typeof input.content !== "string" || input.content.includes("\0")) throw unprocessable("Plugin instruction files must be text");
      if (input.baseHash !== null && !/^[a-f0-9]{64}$/.test(input.baseHash)) throw unprocessable("A SHA-256 base hash or null is required");
      return files.write({ companyId: input.companyId, agentId: input.agentId, path: agentFilePath(input.path), baseHash: input.baseHash, bytes: instructionBytes(input.content), requireIdle: true }, actor);
    },
  };
}
