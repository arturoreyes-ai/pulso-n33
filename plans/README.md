# Animation plans

Written by `improve-animations`. Each plan is self-contained: an agent with no
context can execute it. Run them in the order below.

| # | Plan | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| 001 | [Reveal the account inline under the name, instead of a floating panel](001-cuenta-en-linea-en-el-riel.md) | MEDIUM | DONE | — (but the rail it edits was uncommitted work on 28 September 2026; commit that first, or check the excerpts) |
| 002 | [Ease in what a month or a comment list reveals when it opens](002-revelar-al-abrir-un-mes.md) | LOW | DONE | — (its target, `reporte-redes.tsx`, is untracked work of 2–5 October 2026; run in the working tree, not a worktree from 2e66668) |

## Execution order

1. **001.** Done.
2. **002.** Done. Independent of 001.

Execute one with `improve-animations execute plans/002-revelar-al-abrir-un-mes.md`,
or hand the file to any agent.
