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
   merge automatically. Re-run native integration in staging. The user approved
   a separate narrow upstream contribution on Oct16 (see below).
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
- 134 focused tests pass; direct server TypeScript, SDK/plugin checks and token
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

## Upstream extraction (Oct16)

User authorized a public core contribution. Draft upstream PR
https://github.com/paperclipai/paperclip/pull/16562 contains only generic managed
instruction-file read/write capabilities, trusted action identity, native file
guards, tests and documentation. It is based on current upstream 43ffe8ce9 and
does not include this agency plugin, source mapping or GitHub snapshot method.
Related runtime-sync PR #16499 was reviewed for overlap; no lifecycle delivery
implementation was duplicated. Maintainer design agreement is not yet obtained.

The extracted branch passes 120 focused tests, SDK build, runner TypeScript
build, direct server TypeScript and map checks. Its first PostgreSQL test launch
failed because ignore-scripts omitted dylib aliases; direct initdb reproduced
that missing library, and the dependency's normal hydration repaired it. Full
upstream CI is pending, so the draft is not release-qualified.

The Linux full 36-package build passed with exit 0, including native runner,
server, UI and CLI. Archive builds now carry PAPERCLIP_BUILD_COMMIT provenance.
The first SSH session reset; the complete cached rerun supplied the final pass.
134 focused Linux tests passed before the subsequent review hardening below.

Upstream review identified two valid gaps: paused agents may still have a
stopping run, and oversized reads were rejected only after hashing. Both pilot
and upstream now reject queued/running runs and unacknowledged cancellation
requests, and cap plugin reads at 1 MiB plus one byte. Added real DB stop-state
and filesystem size regression checks. All 16 pilot Linux regression checks pass.
The hardened server rebuild was deliberately stopped (exit137) after the native
TypeScript compiler exceeded 4 GiB and available RAM fell below 1 GiB while live
tasks were running. TERM then KILL targeted only verified isolated compiler
PID10832; production was not restarted. Latest Node24 local server typecheck
passed. A resource-safe final Linux rebuild remains required.

Oct16 production preflight: existing commit d00789ea4 remains healthy, embedded
database is 127.0.0.1:54329/paperclip, and the check found no queued/running runs.
Verified automatic SQL backup paperclip-20261016-102224.sql.gz is retained with
full Git bundle, service configuration, private environment/config copies and
tracked dirty patch in /backups/paperclip-agent-sources-20261016 (342 MiB,
restricted permissions). Existing untracked runtime material stays untouched.
No schema/migration changes are introduced. The release-upgrade skill requires
current DigitalOcean snapshot confirmation before a live switch; that remains
pending. No production source edits, settings changes or restart have occurred.

Initial upstream CI has 49 passing checks and two unrelated broad test failures:
legacy-workspace-restore-recovery expected ephemeral but got retain_on_failure;
workspace-runtime-exposure encountered EADDRINUSE on port 42000. They are not
claimed resolved; the draft remains under CI/review. New safety commit restarts CI.
