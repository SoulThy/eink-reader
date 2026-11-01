---

name: think-and-act
description: Plan with a high-reasoning model, then execute with a fast model. Use for "think and act", or multi-step changes where plan quality matters but execution is mechanical.
argument-hint: "[task]"
allowed-tools:

- task

---

# Think and act

Run two delegated phases in order. Never skip phase 1.

## Phase 1 — plan (deepseek-v4-pro)

Call the `task` tool with:

- agent\_type: `general-purpose`
- model: `75869e08-cb1d-46a3-bbb8-19c166496fb2/deepseek-v4-pro`
- reasoning\_effort: `high`
- prompt: the user's task verbatim, plus:
  "You are the planner. Do NOT modify files. Investigate the repo, then return a
   numbered plan: each step names exact files/symbols, the concrete change, risks,
   and the command that verifies it."

If the plan is empty, contradictory, or lacks file paths, re-run phase 1 once
with the gaps called out. Do not proceed on a bad plan.

## Phase 2 — act (deepseek-flash)

Call the `task` tool with:

- agent\_type: `general-purpose`
- model: `75869e08-cb1d-46a3-bbb8-19c166496fb2/deepseek-flash`
- prompt: "You are the executor. Implement this plan exactly. Do not redesign it.
  Run the listed verification commands. Report deviations, failures, and anything
  the plan got wrong."

## Phase 3 — report

Summarize: what shipped, files touched, verification output, and any plan step
that had to be deviated from (so the planner's blind spots stay visible).
