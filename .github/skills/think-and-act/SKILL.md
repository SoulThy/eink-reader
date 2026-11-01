---
name: think-and-act
description: Plan a PLAN.md milestone with a high-reasoning model, get user approval, then execute with a fast model. Use for multi-step changes where plan quality matters.
argument-hint: "[milestone or task]"
allowed-tools:
  - task
---

# Think and act

Run the phases in order. Never skip phase 1. Never start phase 2 without approval.

## Phase 1: plan (deepseek-v4-pro)

Call the `task` tool with:

- agent_type: `general-purpose`
- model: `75869e08-cb1d-46a3-bbb8-19c166496fb2/deepseek-v4-pro`
- reasoning_effort: `high`
- prompt: the user's task verbatim, plus:
  "You are the planner. Do NOT modify any file. First read AGENTS.md, SPEC.md
  and PLAN.md and obey them (especially: no dependencies, no new permissions,
  no new files without approval). Then investigate
  the code and return a numbered plan: each step names exact files and
  functions, the concrete change, and risks. End with manual verification
  steps using test/test.html, and state what cannot be verified without the
  device. If anything is ambiguous, list it as a question instead of guessing."

If the plan is empty, contradictory, or lacks file paths, re-run phase 1 once
with the gaps called out.

## Checkpoint: approval

Show the user the full plan and any open questions. STOP and wait for an
explicit "go". Do not continue on silence.

## Phase 2: act (deepseek-flash)

Only after approval, call the `task` tool with:

- agent_type: `general-purpose`
- model: `75869e08-cb1d-46a3-bbb8-19c166496fb2/deepseek-flash`
- prompt: "You are the executor. Read AGENTS.md first. Implement the approved
  plan exactly, with the minimum code. Do not redesign it. Do not add
  dependencies, permissions or files that are not in the plan. Do not touch
  anything outside the plan. Do not commit. If a step is impossible or the plan
  seems wrong, STOP and report instead of improvising. Retry a failing step at
  most twice. Tick the finished item in PLAN.md."

## Phase 3: report

Summarize in a short list: what changed, files touched, line counts versus the
size budget, what to test by hand, and any deviation from the plan (so the
planner's blind spots stay visible).
