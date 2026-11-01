# Project: minimal e-ink browsing extension

## Read first
- SPEC.md = what to build. PLAN.md = current task list. Read both before coding.
- RESEARCH.md = notes on reference repos.

## Stack and constraints
- WebExtension, Manifest V3, Firefox.
- The extension is intended for firefox e-ink android devices.
- Vanilla JS/CSS only. NO dependencies, NO build step, NO frameworks.
- All shipped code lives in /extension. Planning files live at the root.
- /reference is read-only research. Never copy code from it.
- Never add a library, permission, or file without asking me first.

## Tools
- Context7 MCP is available and usable: resolve a library id, then query its docs
  for current API details before writing against a browser/WebExtension API.
- Docs are reference only. This project still takes no dependencies.

## Code style
- Simplicity beats features. Keep it simple.
- Small functions, self explicit names, comments only for non-obvious "why".
- Never animate or transition anything (slow-refresh e-ink screen).
- Don't request manifest permissions beyond what the current task needs.

## Workflow
- Work on ONE item from PLAN.md at a time. Tick it when done.
- If requirements are ambiguous, ask me instead of guessing.
- For anything bigger than a small fix, propose a short plan and wait for approval.
- Don't refactor or touch code unrelated to the current task.
- After each change, summarize in 3 bullets what changed.

## Testing
- Test manually with test/test.html (long text, sticky header, images).
- Tell me exactly how to verify each change in the browser.
