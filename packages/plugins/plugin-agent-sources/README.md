# Agent Sources (owned-fork pilot)

This is a custom plugin on a small native SDK extension, not upstream Paperclip
GitHub skill sync. Requires this branch's `agents.instructions.read/write` host
capabilities. Never configure a shared publisher token.

An operator configures one company, one agent, repository and branch. **Check
for updates resolves the current GitHub branch and reads only mapped blobs at
that immutable commit.** It reuses Paperclip's native GitHub connection grants
for the acting user. No new token, repository archive, local checkout write or
SSH credential is required. Private repositories need the user's existing
authorized GitHub connection. A denied/failed fetch never falls back to stale
local content. Only regular UTF-8 files are read; symlinks and submodules are
rejected. Scripts are installed as text, never executed.

An optional legacy/local mode remains when `repositoryUrl` is omitted: set
`repoPath` and a full local `trackingRef`. That mode does not fetch remotely.

The logged-in user's current native permissions authorize every read/write.
Plans are user/company-bound, expire after ten minutes, are single-use, and are
lost on plugin restart. Changes start unchecked. Sync preflights selected live
hashes, conditionally writes each file, then verifies actual readback. A failure
can leave partial writes; the receipt distinguishes verified files from the
unverified one. Refresh and review before retrying; no blind rollback.

Pilot operator configuration (review before using):

The pilot target must already use managed `AGENTS.md` as its actual instruction
entry. Validate this before configuring it. This plugin does not convert legacy
inline prompts, external instruction files, or custom entry-file agents.

```json
{
  "repositoryUrl": "https://github.com/designingitcom/agentic-os",
  "companyId": "9dbbcdb3-7a5f-4882-af7a-a5eca20423ac",
  "agentId": "94657e2f-c90a-4d29-8499-0e5a6264535e",
  "agentName": "WordPress Agent Copy",
  "trackingRef": "main",
  "entrySource": "paperclip/prompts/support/agents/wordpress-update-agent.AGENTS.md",
  "sourcePrefix": "paperclip/prompts/support/agents/wordpress-update-agent",
  "supportingFiles": ["scripts/find_findings.py", "scripts/parse_findings.py", "scripts/run_updates.py", "scripts/gitlab_mr.py", "scripts/health_check.sh", "scripts/README.md"]
}
```

Build with `pnpm --filter @designingit/plugin-agent-sources build`. Install via
Paperclip's native local plugin installer after the matching core/SDK build is
deployed. No database migration. Do not restart production with active runs.
Rollback: disable/uninstall the plugin; core methods are additive. Installed
agent content is not automatically reverted.

Not yet provided: arbitrary GitHub repository picker, automatic merge-triggered publish,
multi-agent mapping editor, receipt history UI, binary files, delete,
dependency installation or settings/adapter/model changes. The local checkout
must be trusted in local mode and only instance operators may configure mappings.

The latest content-free receipt per mapped agent is persisted in plugin company
state, including the source commit, verified paths and acting user. Native file
audit events remain the authoritative per-write audit trail.
