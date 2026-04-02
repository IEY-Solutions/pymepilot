# PymePilot Codex Operating Manual

This file applies only to the PymePilot repository.
It defines the active operating standard for work in this repo.
`C:\Users\Admin\.codex\AGENTS.md` remains the global base layer; this file adds stricter project-specific rules.
`CLAUDE.md` is historical context only and must not be treated as the active source of truth.

## Session start

Read these sources of truth at the start of any session that touches their area:

- `docs/PROJECT_STATE.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/ONBOARDING.md`
- `docs/reconstruction/README.md`
- `docs/reconstruction/legacy-repo.toml`
- `docs/reconstruction/file-index.md`
- `docs/reconstruction/legacy-map.md`
- `docs/reconstruction/packets/backend.md`
- `docs/modules/`
- `docs/products/`

Rules:

- Read `docs/PROJECT_STATE.md` at the start of a session and update it when a change materially affects project or operating state.
- Use the reconstruction pack for migration, refactor, rebuild, or "how should we rebuild this cleanly?" work.
- Reuse existing docs, modules, prompts, and skills before inventing new structure.
- Prefer repo documentation and current code over historical memory.

## Product invariants

- PymePilot is multi-tenant. `tenant_id` plus RLS is the primary isolation model.
- Do not introduce schema-per-tenant designs unless the user explicitly decides to change the architecture.
- The backend orchestrates, the frontend presents, and PostgreSQL persists state.
- ERP connectors are read-only. Do not design or implement writes to a client ERP.
- Secrets, credentials, and external access must stay isolated per tenant.
- The reconstruction priority remains backend, DB/RLS, operations, frontend, then validation.
- IEY is the active validation tenant, not the template for global product rules.
- Preserve references to `Anthropic Claude API` when they refer to the product runtime, not editor tooling.

## Working posture

- Work as a senior pedagogical engineer: explain what you are doing, why it matters, and the relevant concept when that helps the user learn. Keep it concise and useful.
- Rigor beats speed when the two conflict.
- Do not skip a required workflow because the task appears small or obvious.
- When there are meaningful tradeoffs, present 2-3 options with a recommendation instead of anchoring on the first path.
- Declare uncertainty explicitly when compatibility, behavior, or verification is not confirmed.

## Anti-overfitting del producto

- PymePilot must stay ready for hundreds of tenants. Shared code, prompts, schemas, metrics, dashboards, and workflows must be tenant-agnostic by default.
- IEY is evidence, not doctrine. A pattern observed in IEY becomes product behavior only when it is justified by broader segment logic, explicit user direction, or a reusable configuration model.
- Never hardcode tenant names or IDs, IEY-specific catalogs, SKUs, commercial rules, sales windows, CRM stages, wording, dashboard assumptions, onboarding steps, or ERP mappings into shared platform logic.
- If a need exists only for one customer, isolate it behind tenant configuration, mapping tables, prompt or template overrides, feature flags, onboarding data, or connector adapters, and document that scope explicitly.
- Reject shared code paths like `if tenant == IEY` or equivalent heuristics unless the work is a narrowly scoped migration, emergency remediation, or backfill explicitly approved and documented.
- Before implementing, answer three questions: is this platform-wide or tenant-specific, where will tenant-specific variation live, and would the second or hundredth tenant be able to use the same path without rewriting code?
- Review prompts, sync rules, ranking logic, dashboards, filters, thresholds, labels, and operator workflows for hidden IEY assumptions before closing the task.
- When something was learned from IEY but should remain general, express it as a reusable business rule, segment capability, or configuration contract rather than as an IEY-specific behavior.

## Required workflows

- Use brainstorming before implementing new features, improvements, UX changes, workflow changes, architecture decisions, or other creative or ambiguous work.
- Verify current official or primary-source documentation before coding against external libraries, APIs, or platforms such as Next.js, shadcn/ui, Supabase, psycopg3, Anthropic SDK, or Vercel.
- Prefer an isolated worktree for risky refactors, multi-file cross-module work, experimental changes, migrations, infra changes, or parallel efforts.
- Before touching auth, RLS, DB, ERP integrations, or other sensitive data flows, think through what can leak, which contract is supposed to prevent it, and where logs, errors, or artifacts could still expose it.
- Before proposing or implementing a change, evaluate its impact on dependent code, docs, data, auth, RLS, prompts, operations, monitoring, and tenant workflows.
- When the task touches product logic, prompts, CRM flows, dashboards, ranking, or ERP mappings, run an explicit anti-overfitting check: separate platform behavior from per-tenant configuration before implementing.
- After fixing a local issue, re-scan the broader system for inconsistencies introduced by that fix.

## Linear MCP first

- Default Linear team for this repo: `PymePilot`.
- Linear is the active system for backlog, execution tracking, follow-up, and project coordination in this repo.
- If the user references a `PYM-*` issue, a known Linear project, or a milestone, fetch and read it before planning or implementation.
- If the user does not reference a Linear artifact, search `PymePilot` in Linear first before creating a new issue or project.
- Prefer attaching work to an existing project before creating a new one.
- Create a new project only when the work is a sustained line with multiple issues, milestones, or phases.
- Do not ask for permission to create or update Linear artifacts unless routing remains ambiguous after inspection or the user explicitly declines Linear tracking.
- When active work starts on an issue, use `In Progress`; use `In Review` when the implementation is ready but still awaits validation, merge, or acceptance; use `Done` only when no meaningful gate remains.
- Use `Backlog` or `Todo` for captured work not yet being executed, and `Canceled` or `Duplicate` only when that outcome is explicit.
- For projects, do not invent state names; prefer project documents and status updates unless the existing project-state flow is already clear.
- Leave issue comments for meaningful execution events: start, blocker, handoff, and close.
- Use project status updates when a project begins a phase, hits a material blocker, or changes state in a meaningful way.

## Linear bundles

- For each non-trivial issue created or materially updated, ensure these Linear documents exist: `Contexto`, `Impacto y dependencias`, `Criterios de validacion`.
- For each project created or materially updated, ensure these Linear documents exist: `Protocolo operativo`, `Seguridad y honestidad`, `Plantilla operacional`.
- Keep the issue or project description concise; deeper operating detail belongs in the documents.
- If an artifact already has useful documentation, create only the missing required docs instead of duplicating what already exists.
- Comments are for execution updates, not for replacing the document bundle.
- This rule applies to new or touched artifacts; do not try to retrofit the entire historical workspace in one pass.
- Notion may remain a source of raw input, but Linear is the execution system of record for active work in this repo.

## Security and data handling

- Never read `.env`, secret files, credential files, private keys, backups, database dumps, or personal data unless the user explicitly authorizes it and the task truly requires it.
- Before touching `config/`, `credentials/`, `secrets/`, `keys/`, or `private/`, confirm the need first.
- Keep logs and responses free of secrets, tokens, and private URLs.
- Never propose insecure "temporary" shortcuts for auth, tenant isolation, secret handling, or production safety.
- Before giving the user manual commands, verify the target environment: machine, OS or shell, working directory, and active venv or container context when relevant.

## Change gates

### DB, RLS, auth, and multi-tenant behavior

- Verify `tenant_id` propagation, RLS coverage, validation boundaries, prepared SQL usage, and cross-tenant failure modes.
- For any DB, RLS, or auth change, explain how tenant A is prevented from seeing or mutating tenant B data.
- Add or update validation and tests when an isolation contract or auth behavior changes.
- Do not consider the work done until the sensitive contract has been reviewed explicitly.

### ERP and external integrations

- ERP access is GET-only. Do not add POST, PUT, PATCH, or DELETE behavior to a client ERP connector.
- Use or request read-only scopes only.
- Respect rate limits, backoff, timeouts, and fail-safe behavior.
- Keep credentials isolated per tenant and never log them.
- Maintain audit visibility for syncs, failures, and operational troubleshooting.

### Frontend and product behavior

- Preserve the established UX and information architecture unless the user approves a redesign.
- Validate meaningful desktop, mobile, and empty or error-state behavior when changing UI.
- Keep business logic, tenant enforcement, and other sensitive decisions out of the frontend when they belong in backend or DB layers.
- Avoid copy, labels, defaults, metrics, and empty states that assume IEY terminology or operating habits unless they are explicitly tenant-configurable.

### Anthropic Claude API cost discipline

- Treat tokens as a constrained resource.
- Avoid unnecessary calls, oversized prompts, and duplicated context.
- Preserve or improve existing guardrails around usage limits, budgeting, and fail-safe behavior.

## Quality bar

- Python: use type hints, explicit validation, specific errors, and structured logging.
- TypeScript: keep strict typing, prefer explicit validation, and avoid `any` unless a library boundary forces it and the reason is clear.
- SQL: use prepared statements, tenant-aware filters or RLS, and review indexes or query plans on hot paths.
- Prefer clear, durable implementations over clever ones.

## Definition of done

- Review affected dependencies, interfaces, contracts, docs, and operational flows before closing the task.
- For non-trivial logic or error-handling changes, reason through happy path, early failure, and late failure behavior.
- If security, auth, DB, multi-tenant, or external integration behavior changed, state what was verified and what remains unknown.
- Update `docs/PROJECT_STATE.md` when project state or operating state materially changes.
- Update handoffs, plans, or supporting docs when architecture, workflows, or operating model changed.
- If debt, risk, or follow-up remains, capture it in Linear with the required bundle and current status unless the user explicitly declines.
- If the task was anchored to a Linear issue or project, update that artifact before closing the task and leave the next operator enough context to continue without rediscovery.
- For product behavior, prompts, ERP mappings, dashboards, or commercial workflows, state how the change avoids overfitting to IEY and where tenant-specific variation lives.
- Finish with an explicit next step and no hidden assumptions.
