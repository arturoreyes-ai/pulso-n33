# 002 — Press feedback on the pill buttons

- **Status**: DONE (2026-09-24)
- **Commit**: acb0123
- **Severity**: MEDIUM
- **Category**: Physicality & origin (press feedback) / Easing & duration
- **Estimated scope**: 4 files, ~6 changed lines

## Problem

The pill is the dashboard's main button: «Analizar», «Comentarios», «Analizar
con IA», «Cancelar», «Abrir en…», the zone and rubro chips, the either/or
switches. All of it comes from `clasesChip` / `clasesBoton` or from
`Segmentado`. **None of it responds to the press itself.** On a phone there is
no hover, so a tap gives no feedback until whatever it triggers renders. That
can be a sheet (occasional) or nothing visible for a moment.

```ts
// web/src/components/ui/clases.ts:24 — current
export function clasesChip(activo: boolean): string {
  return [
    "inline-flex items-baseline gap-2 rounded-full px-4 py-3 text-cuerpo",
    "transition-colors duration-[var(--dur-cambio)] ease-firma",
    activo
      ? "bg-realce text-tinta-titulo"
      : "bg-vela text-tinta-prosa hover:bg-filo hover:text-tinta-titulo",
  ].join(" ");
}
```

That line has a second problem: it is a hover color change at 260ms on
`--ease-firma`. The repo's own rule (`web/src/app/globals.css:262-277`) says
immediate feedback is `--dur-toque` (120ms), and «FIRMA MUEVE COSAS, EASE-OUT
CAMBIA COSAS»: a color change is ease-out. At 260ms with firma's long flat
tail, the hover color is still arriving when the pointer has already moved on.
That is the exact failure the comment there describes for 700ms.

The same pattern appears in three more places:

```ts
// web/src/components/paneles/resumen-tiktok.tsx:64 — current (source chips under each bullet)
const CLASES_FUENTE = [
  "inline-flex min-h-11 items-center justify-center rounded-full bg-vela px-4 text-meta text-tinta-prosa",
  "transition-colors duration-[var(--dur-cambio)] ease-firma hover:bg-filo hover:text-tinta-titulo",
].join(" ");
```

```ts
// web/src/components/ui/segmentado.tsx:31 — current
const SEGMENTO = "rounded-full px-3 py-2 text-center text-cuerpo transition-colors duration-[var(--dur-toque)] ease-firma";
```

```tsx
// web/src/components/ui/formulario-busqueda.tsx:54 — current (the «Buscar» submit)
className="group inline-flex items-center justify-between gap-3 rounded-full bg-realce py-2 pl-5 pr-2 text-cuerpo text-tinta-titulo transition-[background-color,transform] duration-[var(--dur-toque)] ease-firma hover:bg-filo active:scale-[0.99]"
```

`active:scale-[0.99]` on a ~200px button is a ~2px change, which nobody can
see. It is the only press feedback in the app, and it is below the threshold.

## Target

One press recipe for every pill: `scale(0.97)` while pressed. Colors and
transform move together at `--dur-toque` (120ms) on `ease-out` (Tailwind's
`--ease-out`, which `globals.css:52` already makes the default curve).
Release uses the same 120ms, so the button springs back as soon as the finger
lifts.

The Tailwind string to use everywhere below:

```
transition-[color,background-color,scale] duration-[var(--dur-toque)] ease-out active:scale-[0.97]
```

- `clasesChip`: replace `"transition-colors duration-[var(--dur-cambio)] ease-firma"`
  with the string above. `clasesBoton` derives from `clasesChip` via
  `.replace("items-baseline", …)`, so it inherits this for free. Do not edit
  `clasesBoton`.
- `CLASES_FUENTE` (resumen-tiktok): replace
  `"transition-colors duration-[var(--dur-cambio)] ease-firma hover:bg-filo hover:text-tinta-titulo"`
  with the string above plus ` hover:bg-filo hover:text-tinta-titulo`.
- `SEGMENTO` (segmentado): replace
  `transition-colors duration-[var(--dur-toque)] ease-firma` with the string
  above.
- «Buscar» submit (formulario-busqueda:54): replace
  `transition-[background-color,transform] duration-[var(--dur-toque)] ease-firma hover:bg-filo active:scale-[0.99]`
  with `transition-[color,background-color,scale] duration-[var(--dur-toque)] ease-out hover:bg-filo active:scale-[0.97]`.
  Leave the inner arrow circle (line 57) alone: its
  `group-hover:translate-x-0.5` on `ease-firma` moves a thing, which is
  firma's job.

**`scale`, not `transform`, in the transition list.** Tailwind v4's `scale-*`
utilities set the CSS `scale` property. With `transform` listed, the press
snaps instead of animating. This was caught while executing the plan.

`transform-origin` stays at its default (`center`), which is right for a press.

Reduced motion: the global block at `globals.css:381` shrinks transitions to
0.01ms, so the scale still applies while pressed, as an instant state change
with no animation. That still counts as feedback. Do not remove it for reduced
motion.

## Repo conventions to follow

- Durations are consumed as `duration-[var(--dur-toque)]`. Never
  `duration-150`: `web/scripts/verificar-tokens.mjs` rejects numeric durations
  in `.tsx`/`.ts`.
- `ease-out` is Tailwind's utility for `var(--ease-out)`. There is no custom
  `ease-*` utility besides `ease-firma`.
- Exemplar of the documented feedback timing: `.control-lector` in
  `globals.css:780` uses `--dur-toque`. Plan 004 fixes its curve.

## Steps

1. `web/src/components/ui/clases.ts`: in `clasesChip`, swap the second array
   element as described. Nothing else in the file changes.
2. `web/src/components/paneles/resumen-tiktok.tsx`: swap the second element of
   `CLASES_FUENTE`.
3. `web/src/components/ui/segmentado.tsx`: swap the transition part of
   `SEGMENTO`.
4. `web/src/components/ui/formulario-busqueda.tsx`: edit the submit button's
   className on line 54 only. Update the JSX comment above it (line 50–51,
   «Al pulsar, el boton cede un punto: es la unica animacion aqui.») to «Al
   pulsar, el boton cede como todas las pastillas (ui/clases.ts).».
5. In `clases.ts`, add one sentence to the `clasesChip` doc comment, in the
   repo's register (Spanish, no accents): «Al pulsar cede a 0.97: en el
   telefono no hay hover, y sin esto un toque no respondia hasta que llegaba
   lo que abria.»

## Boundaries

- Do NOT touch `.pestana-lector` or `.control-lector` in `globals.css`. That is
  plan 004.
- Do NOT add press feedback to links inside prose, to tab rows, or to cards in
  the reader. Scaling a full-screen card on tap would fight the scroll gesture.
- Do NOT change padding, colors or the `activo` branches.
- If a quoted string doesn't match exactly, STOP and report.

## Verification

- **Mechanical** (from `web/`): `pnpm tipos` passes; `pnpm tokens` prints
  `tokens ok`; `node scripts/probar-analisis.cjs` passes.
- **Feel check** (dev server at `http://localhost:3000`, phone viewport
  375×812 and desktop):
  - Press and hold «Analizar» on a portada card: it visibly sinks, about 3%.
    Release: it returns in about 120ms, with no wobble.
  - Tap quickly several times: every tap shows the dip and none stalls halfway.
    Transitions retarget, so this should hold.
  - Desktop hover over a zone chip: the color arrives while the pointer is
    still on it. It should not trail behind after the pointer leaves.
  - In DevTools Animations at 10%, the press starts fast (ease-out) rather than
    easing in.
  - Text inside a pressed pill does not blur or shift. If it does in Safari,
    report it rather than adding `will-change`.
- **Done when**: all four sites use the exact string, and presses are visible on
  a phone.
