# CLAUDE.md Historical Compatibility Note

This file is retained only as historical context for PymePilot.
It is not the active source of instructions for Codex or other agents.

## Active source of truth

- Global operating manual: `C:\Users\Admin\.codex\AGENTS.md`
- Repo operating manual: `C:\Users\Admin\Documents\GitHub\pymepilot\AGENTS.md`

If this file conflicts with either `AGENTS.md`, the `AGENTS.md` files win.

## Priorities that were migrated

The active `AGENTS.md` files now carry forward the important operational intent that used to live here:

- senior-but-pedagogical execution for this repo
- brainstorming before new features, improvements, and other creative work
- verification against current official documentation before using external libraries or APIs
- preference for isolated worktrees on risky, multi-file, or experimental changes
- explicit uncertainty instead of pretending something is verified
- broader consistency review after local fixes
- strict multi-tenant, RLS, secret-handling, and read-only ERP rules
- anti-overfitting discipline: IEY validates the product, but shared logic must remain multi-client and configurable
- cost discipline around Anthropic Claude API usage
- Linear MCP-first execution, including automatic issue and project tracking plus required document bundles

## What remains historical

This file no longer defines live behavior. It exists only for compatibility with older conversations and notes that still mention `CLAUDE.md`.

Examples of content intentionally not kept active here:

- legacy Claude Code specific process rules
- old VPS paths, commands, or environment assumptions
- compacting or plan-mode mechanics tied to another runtime
- narrative history and rule origins that are better preserved in git history and repo docs

Use this file only when older material references it and historical context is useful.
For live work, read the two active `AGENTS.md` files first.
