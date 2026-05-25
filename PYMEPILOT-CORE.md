# PYMEPILOT CORE

Status: Canonical business reference shared across the active PymePilot repos.
Applies to:
- `C:\Users\Admin\Documents\GitHub\pymepilot`
- `C:\claude-projects\pymepilot-landing`
- `C:\claude-projects\pymepilot-landing-v2`
Last updated: 2026-04-03

Primary sources:
- Notion page `PymePilot`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_STATE.md`

## Purpose

This document defines the business core that must stay consistent across product, stable landing, and landing v2.
Use it as the default source of truth for copy, product framing, onboarding, prompts, demos, and internal docs.
If a repo-specific file conflicts with this document on PymePilot's business definition, this document wins unless the user explicitly changes the core.

## One-line definition

PymePilot turns each sale into the start of a relationship, not the end of a transaction.

## Short definition

PymePilot is a post-sale follow-up and loyalty system that uses operational data, WhatsApp, and AI to detect the right moment to contact each account, suggest the right message, and keep commercial relationships active over time.

## Product truth today

- Current wedge: distribuidoras mayoristas and B2B commercial teams in Argentina.
- Active validation tenant: IEY.
- Main channel: WhatsApp.
- Main data inputs: ERP, spreadsheets, sales history, and account behavior.
- Current product focus: the `seguimiento` module.
- Current live outcomes: activation, replenishment, cross-sell, and recovery workflows.
- Current business model: base fee plus revenue share on attributable recovered sales.

## Strategic thesis

The broad thesis is bigger than wholesalers: most businesses have tools to acquire and close customers, but almost no system keeps the relationship alive after the sale.
PymePilot exists to fill that post-sale gap.
In long-term terms, PymePilot is a system of external commercial memory for businesses with recurring relationships.

## Default positioning rule

For public-facing repos and current sales material, lead with the concrete wedge, not the broad thesis.
Default framing today:
- `seguimiento inteligente por WhatsApp para distribuidoras mayoristas`
- `sistema que ordena a quien contactar, cuando actuar y con que contexto`

Use the broader thesis only in strategy docs, investor conversations, roadmap material, or when the user explicitly wants expansion framing.

## Core problem

- The market is saturated with tools for acquisition and closing.
- The main leak starts after the sale.
- Businesses sell once, then lose track of the customer.
- Manual follow-up does not scale.
- By the time a team notices inactivity, the account often already bought elsewhere.

## Core engine

```text
Sale happens
-> Customer is registered
-> Purchase and relationship pattern is analyzed
-> Best moment to re-contact is detected
-> Personalized WhatsApp message is suggested or sent
-> Response is interpreted with AI
-> Next action and relationship state are updated
```

## What PymePilot does

- Detects silent churn before it becomes obvious.
- Predicts replenishment windows based on actual buying behavior.
- Activates first-time buyers toward repeat purchase.
- Finds cross-sell opportunities from real purchase patterns.
- Gives the commercial team a prioritized daily action list.
- Preserves relationship context so the operator does not start from zero every time.

## What PymePilot is not

- Not a generic CRM.
- Not an ERP replacement.
- Not a mass broadcast or spam tool.
- Not a write-back integration into the client's ERP.
- Not an IEY-only product.
- Not a general `software for any business` in current public positioning.

## Validated proof that may be used today

- IEY is the active validation tenant and may be cited only as validated proof, never as the universal template.
- Validated results currently reused across repos:
  - recurrent revenue from 34% to 74%
  - churn from 18% to 8%
- Any stronger claim, broader benchmark, or new metric must be verified before reuse.

## IEY guardrail

IEY is evidence, not doctrine.
What was learned in IEY should become:
- a reusable business rule
- a configurable tenant behavior
- or a segment-specific module

It should not become hardcoded platform logic or mandatory copy for every repo.

## Roadmap vs shipped reality

Shipped or validated today:
- proactive follow-up engine
- distributor-focused dashboard and pipeline
- data-driven prioritization for seguimiento
- WhatsApp as the main action channel

In progress or next:
- reactive webhook processing
- deeper AI analysis of incoming responses
- multi-agent conversations
- embedded signup
- expansion to new sectors

Do not present roadmap items as if they were fully live unless the user explicitly wants forward-looking copy.

## Preferred language

Prefer:
- `seguimiento inteligente`
- `fidelizacion post-venta`
- `reactivacion`
- `reposicion predictiva`
- `clientes recurrentes`
- `distribuidoras mayoristas B2B`
- `WhatsApp`
- `contexto comercial`
- `senales operativas`

Avoid by default:
- `otro CRM`
- `bot de WhatsApp`
- `automatizacion masiva`
- `sirve para cualquier negocio` as the main headline
- product claims that hide the post-sale differentiation

## Cross-repo usage

- `pymepilot`: use this file to align product decisions, prompts, docs, onboarding, and multi-tenant behavior.
- `pymepilot-landing`: use this file to keep production messaging inside validated product truth.
- `pymepilot-landing-v2`: use this file as the business guardrail while experimenting with structure, visuals, and sharper copy.

## Maintenance rule

If this document changes in one of the three active repos, sync the same business change to the other two repos in the same task unless the user explicitly wants divergence.
