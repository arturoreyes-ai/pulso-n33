# 004 — Reader bar controls: right curve, no stuck hover on touch, press feedback

- **Status**: DONE (2026-09-24)
- **Commit**: acb0123
- **Severity**: LOW
- **Category**: Easing & duration / Accessibility (touch hover) / Cohesion
- **Estimated scope**: 2 files (`web/src/app/globals.css`, `web/src/components/ui/formulario-busqueda.tsx`), ~15 lines

## Problem

The reader bar and its tab row are the most-touched controls in the product:
the platform tabs (Todas · Instagram · TikTok · YouTube · X), the rubro tabs,
and the bar's icon buttons (back, search magnifier, menu, «Más recientes»).
They are hand-written CSS, not Tailwind:

```css
/* web/src/app/globals.css:588 — current */
.pestana-lector {
  position: relative;
  flex: none;
  padding: 0.75rem 1rem;
  color: var(--color-tinta-meta);
  border-radius: var(--radius-nucleo) var(--radius-nucleo) 0 0;
  transition: background-color var(--dur-toque) var(--ease-firma), color var(--dur-toque) var(--ease-firma);
}
.pestana-lector:hover { background: var(--color-vela); color: var(--color-tinta-prosa); }
```

```css
/* web/src/app/globals.css:771 — current */
.control-lector {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  border-radius: var(--radius-nucleo);
  color: var(--color-tinta-prosa);
  transition: background-color var(--dur-toque) var(--ease-firma);
}
.control-lector:hover { background: var(--color-vela); }
```

There are three problems:

1. **Stuck hover on phones.** A bare CSS `:hover` matches after a tap on touch
   devices and stays until you tap elsewhere. After choosing the TikTok tab,
   the previously tapped tab or icon keeps a gray pill. Tailwind v4's `hover:`
   utilities are already wrapped in `@media (hover: hover)`, which is why the
   rest of the app does not have this problem. These two hand-written rules
   are not.
2. **Wrong curve for a color change.** The repo's rule at `globals.css:273`
   says «FIRMA MUEVE COSAS, EASE-OUT CAMBIA COSAS». These transitions change
   colors on `--ease-firma`.
3. **No press feedback on the icon buttons.** Same issue as plan 002, for the
   bar's 44px icon buttons.

A fourth site, a color-only link with the same curve mistake:

```tsx
// web/src/components/ui/formulario-busqueda.tsx:68 — current
className="justify-self-start text-meta text-tinta-meta underline decoration-filo underline-offset-4 transition-colors duration-[var(--dur-toque)] ease-firma hover:text-tinta-titulo"
```

## Target

```css
/* target */
.pestana-lector {
  position: relative;
  flex: none;
  padding: 0.75rem 1rem;
  color: var(--color-tinta-meta);
  border-radius: var(--radius-nucleo) var(--radius-nucleo) 0 0;
  transition: background-color var(--dur-toque) var(--ease-out), color var(--dur-toque) var(--ease-out);
}
/* Solo con puntero de verdad. En un telefono `:hover` queda pegado despues
   del toque: la pestana que se dejo seguia con la pastilla gris. Las
   utilidades `hover:` de Tailwind v4 ya vienen dentro de esta consulta; estas
   dos reglas, escritas a mano, no. */
@media (hover: hover) and (pointer: fine) {
  .pestana-lector:hover { background: var(--color-vela); color: var(--color-tinta-prosa); }
}
```

```css
/* target */
.control-lector {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  border-radius: var(--radius-nucleo);
  color: var(--color-tinta-prosa);
  transition: background-color var(--dur-toque) var(--ease-out), transform var(--dur-toque) var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  .control-lector:hover { background: var(--color-vela); }
}
/* Al pulsar cede, como las pastillas (ui/clases.ts). */
.control-lector:active { transform: scale(0.97); }
```

`formulario-busqueda.tsx:68`: replace `ease-firma` with `ease-out` in that
className. Change nothing else.

Tabs get no press scale. A row of tabs dipping one by one under the thumb
reads as jitter; the color change is their feedback.

## Repo conventions to follow

- Tokens: `--dur-toque` (120ms) at `globals.css:292`; Tailwind's `--ease-out`
  is what `--default-transition-timing-function` points to (`globals.css:52`).
  Add no new tokens.
- Comments in `globals.css` are Spanish without accents and say why.
- If plan 002 has been executed, the recipe here matches its `clasesChip`
  (scale 0.97, 120ms, ease-out). If it has not, this plan is still independent.

## Steps

1. In `web/src/app/globals.css`, in `.pestana-lector`, change both
   `var(--ease-firma)` to `var(--ease-out)`. Wrap the `.pestana-lector:hover`
   line in `@media (hover: hover) and (pointer: fine) { … }` and put the
   comment above it.
2. Leave the active-state rules that follow `.pestana-lector:hover`
   (`aria-pressed`, `aria-current`, `aria-selected`) outside the media query.
   Active state must show on touch.
3. In `.control-lector`, replace the `transition` line with the target. Wrap
   `.control-lector:hover` in the same media query. Add the `:active` rule.
   Leave `.control-lector[data-nuevos]`, `.control-lector[aria-pressed="true"]`
   and the `data-solo-movil` media query untouched.
4. In `web/src/components/ui/formulario-busqueda.tsx:68`, swap `ease-firma` →
   `ease-out`.

## Boundaries

- Only these rules and that one className.
- Do NOT touch `.recorrido-lector`, `.dialogo-lector` (plan 001), `.entrada`,
  `.aparicion-suave`, `[data-revelar]` or `.fondo-led`. Their curves are
  documented choices.
- Do NOT change the global `prefers-reduced-motion` block.
- If the quoted CSS doesn't match, STOP and report.

## Verification

- **Mechanical** (from `web/`): `pnpm tokens` prints `tokens ok`; `pnpm tipos`
  passes.
- **Feel check** on `/redes`:
  - Phone viewport (375×812, a touch device in the emulator): tap TikTok, then
    Instagram. No tab other than the active one keeps a gray background. Tap
    the magnifier and close the sheet: the icon button does not stay gray.
  - Desktop: hovering a tab or icon button still shows the pill in about 120ms,
    and it leaves just as fast.
  - Press and hold the magnifier: it dips about 3% and springs back on release.
  - In DevTools Animations at 10%, the hover background starts changing
    immediately (ease-out) rather than after a flat start.
- **Done when**: no stuck hover on touch, both curves are `--ease-out`, and the
  icon buttons dip on press.
