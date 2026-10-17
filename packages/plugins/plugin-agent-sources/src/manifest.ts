import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
export default {
  id: "designingit.agent-sources", apiVersion: 1, version: "0.2.1",
  displayName: "Agent Sources", description: "Review and sync Git-owned agent instruction files.",
  author: "DesigningIT", categories: ["connector"],
  capabilities: ["agents.instructions.read", "agents.instructions.write", "plugin.state.write", "ui.sidebar.register", "ui.page.register"],
  entrypoints: { worker: "./dist/worker.js", ui: "./dist/ui" },
  instanceConfigSchema: {
    type: "object", additionalProperties: false,
    properties: {
      repoPath: { type: "string", title: "Canonical Git checkout (server path)" },
      repositoryUrl: { type: "string", title: "GitHub repository URL (fetch current branch on Check)" },
      connectionId: { type: "string", title: "Optional authorized GitHub connection ID" },
      companyId: { type: "string", title: "Authorized company ID" },
      agentId: { type: "string", title: "Mapped agent ID" },
      agentName: { type: "string", title: "Agent display name" },
      sourcePrefix: { type: "string", title: "Git source directory" },
      entrySource: { type: "string", title: "Git AGENTS.md source path" },
      supportingFiles: { type: "array", items: { type: "string" }, title: "Supporting relative paths" },
      trackingRef: { type: "string", title: "GitHub branch (e.g. main), or local tracking ref" },
      additionalAgents: { type: "array", title: "Additional Git-managed agents (same company and repository)", maxItems: 19, items: {
        type: "object", additionalProperties: false,
        properties: {
          agentId: { type: "string", title: "Mapped agent ID" },
          agentName: { type: "string", title: "Agent display name" },
          sourcePrefix: { type: "string", title: "Git source directory" },
          entrySource: { type: "string", title: "Git AGENTS.md source path" },
          supportingFiles: { type: "array", title: "Supporting relative paths", items: { type: "string" } },
        },
        required: ["agentId", "agentName", "sourcePrefix", "entrySource", "supportingFiles"],
      } },
    },
    required: ["companyId", "agentId", "agentName", "sourcePrefix", "entrySource", "supportingFiles", "trackingRef"],
  },
  ui: { slots: [
    { type: "sidebar", id: "agent-sources-link", displayName: "Agent Sources", exportName: "SidebarLink", order: 40 },
    { type: "page", id: "agent-sources", displayName: "Agent Sources", exportName: "AgentSourcesPage", routePath: "agent-sources" },
  ] },
} satisfies PaperclipPluginManifestV1;
