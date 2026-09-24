# Animation plans

Written by an `improve-animations` audit on 2026-09-24 at commit `acb0123`.
Each plan is self-contained: hand one file to any agent.

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | [Give every sheet an entrance and an exit](001-hojas-entran-y-salen.md) | MEDIUM | DONE |
| 002 | [Press feedback on the pill buttons](002-realimentacion-al-pulsar.md) | MEDIUM | DONE |
| 003 | [Make the ficha's smooth scroll respect reduced motion](003-desplazamiento-respeta-movimiento-reducido.md) | MEDIUM | DONE |
| 004 | [Reader bar controls: curve, touch hover, press](004-controles-del-lector.md) | LOW | DONE |

## Order

1. **003** first: eight lines in one file, and a real accessibility gap.
2. **002**, then **004**. They share the press recipe: `scale(0.97)`,
   `--dur-toque`, `ease-out`. 004 does not depend on 002, but reviewing them in
   this order keeps the recipe consistent.
3. **001** last. It has the most surface, since every sheet changes and `Hoja`
   gains deferred `onClose` logic. It deserves its own review on a real phone.

No plan edits the same lines as another. 002 and 004 both touch
`ui/formulario-busqueda.tsx`, but on different lines (54 and 68).

## Deliberately not planned

These are documented choices, not defects:

- The global `prefers-reduced-motion` block (`globals.css:381`) zeroes every
  transition, including opacity. The audit rule prefers keeping gentle fades,
  but the comment there makes it an explicit product decision («No es
  opcional»).
- `Revelar` / `[data-revelar]`: 620ms with a 4px blur and 2.5rem rise.
  Section-level only, with the reasons written in `chrome/revelar.tsx`.
- `.fondo-led::after`: an infinite `linear` sweep over 12s, transform-only, on
  a fixed layer, documented in `globals.css:882`.
- Skeletons use `animate-pulse` without `motion-safe:`. The global block
  already stops them.
