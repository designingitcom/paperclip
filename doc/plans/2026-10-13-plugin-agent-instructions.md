# User-bound plugin agent instruction files

Approved owned-fork extension for Agent Sources. Expose only managed UTF-8 text
read and conditional write through `ctx.agents.instructions`. No generic REST
proxy, credential delegation, settings mutation, delete, or script execution.

The host retains the authenticated user on the active `performAction` invocation.
Workers echo only the opaque invocation ID; supplied actor parameters confer no
authority. A declared capability, matching company scope, bound human action,
and current native target permission are all required. Native file-store locks,
path/link checks, base hashes and audit records remain authoritative.

Verification: SDK typecheck, worker invocation tests, native permission and file
integration tests, then isolated plugin browser QA. Production is not changed
by this branch; deployment requires a core/SDK build and a guarded restart.
Disabling the plugin removes its UI but does not roll back synchronized files.

## Completed verification (2026-10-13)

- 122 tests across host factory, invocation scope, plugin file service, real
  PostgreSQL/native file-store integration, and source plan engine passed.
- SDK and plugin typechecks, plugin build, direct server TypeScript and token
  gates passed. The full server wrapper hit an existing local Xcode/Rust linker
  failure; it is not claimed to pass. No production build was attempted.
- Real browser QA on a disposable native instance: selected two-file publish,
  verified readback, fresh no-op comparison, newer-live conflict without writes,
  cancel/review, keyboard Check action, mobile 390x844 review/sync. Console error
  check was empty. No production content or WordPress operation was touched.
- Screenshots and HTML evidence are retained locally in the task handoff. The
  screenshots show the native application, not a standalone mock page.

## Release sequence (not performed)

1. Review this owned-fork patch against the currently deployed revision. Do not
   send upstream or merge automatically. Re-run native integration in staging.
2. Build matching core, shared package, SDK and plugin. Resolve the operator's
   build environment; the developer's Rust wrapper failure is not a waiver.
3. Confirm snapshot and no active runs. Obtain the deployment window before a
   service restart. No database schema migration is added by this patch.
4. Install the local plugin through native plugin installation and capability
   review. Only instance operators configure the trusted canonical checkout.
5. Validate that the mapped pilot uses managed AGENTS.md as its actual entry.
   This pilot does not convert legacy prompt or custom-entry agents. Confirm
   current manifest paths and deployed Git commit. No extra source repository.
6. Configure one company/agent. First Check must be read-only/no-op. Review any
   unexpected diff with its owner before writing. Do not execute helper scripts.
7. For an approved change, select files, review, sync and verify receipt plus
   native audit. Check again for a no-op. Stop if content or permission differs.

The original pilot read an already deployed local tracking ref. The Oct16
follow-up adds a configured GitHub repository/branch mode: Check resolves the
branch and reads only mapped regular blobs at an immutable SHA through native
GitHub user grants. No archive, extra repository checkout, publisher token,
filesystem ownership change, or worker credential is needed. Local mode stays
explicitly separate. Repository picker, multi-agent UI, automatic merge-triggered
publish and receipt history UI remain deferred. Latest receipt is persisted.
Writes are per-file CAS, not an atomic bundle: a late failure can leave partial
completion, clearly reported. Never blindly roll back over newer live work.

## Oct16 resumption

- Verified deployed revision remains d00789ea4; service active. Dirty production
  files untouched. Root-owned /s1mos is not made writable to the plugin.
- Added bounded GitHub source method, native acting-user grant reuse, immutable
  tree/blob reads, regular-file/UTF-8/size guards and a 25-second fetch deadline.
- 132 focused tests pass; direct server TypeScript, SDK/plugin checks and token
  gates pass. Browser fetched a real public upstream commit, reviewed/synced
  only GOAL.md, reloaded to confirm GOAL.md in sync and AGENTS.md unchanged,
  refused private repository access without a grant, and checked mobile/cancel.
- Private authorized production GitHub connection proof remains a release gate;
  local QA deliberately does not copy production credentials.
- Canonical WordPress manifest now has nine supporting files. Pilot sample was
  reconciled; live target identity and later live changes still require review.
- Linux build is staged in /tmp/paperclip-agent-sources-release.bSgaOY, not the
  production checkout. Serial low-priority build uses the existing service-user
  Node24/Rust toolchain. Initial missing cargo PATH was corrected without install.
