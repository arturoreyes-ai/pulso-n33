# 002 — Ease in what a month or a comment list reveals when it opens

- **Status**: DONE (5 October 2026, executed in the working tree; reviewed: one `aparicion` of 260ms on `cubic-bezier(0.32, 0.72, 0, 1)` per open, opacity and transform only, replays on reopen, none on close)
- **Commit**: 2e66668 — **but the target is uncommitted work in the tree.**
  `web/src/components/reportes/reporte-redes.tsx` is untracked (written 2–5
  October 2026) and `web/src/app/globals.css` may carry other sessions' edits.
  The excerpts below were copied from the working tree on 5 October 2026, not
  from 2e66668. Compare each excerpt with the file before editing (see
  Boundaries). A git worktree from 2e66668 will NOT contain the target file.
- **Severity**: LOW
- **Category**: Missed opportunities (a state change that teleports)
- **Estimated scope**: 2 files (`globals.css` +12 lines, `reporte-redes.tsx` 2 class names)

## Problem

The «El año en redes» section of the expediente page
(`/reportes/ismael-burgueno-2026`) lists one row per month inside a native
`<details>`. Opening a month inserts up to nine posts in a single frame and
shoves every month below it down; opening a post's comments inserts up to ten
comments the same way. On a phone an open month is several screens tall, so the
reader loses their place in the jump. Nothing tells the eye that the new block
belongs to the row that was just pressed.

```tsx
/* web/src/components/reportes/reporte-redes.tsx:153-156 — current (DetalleMes) */
  return (
    // La rejilla de escritorio de COLUMNAS, escrita entera: Tailwind no ve una
    // clase armada en tiempo de ejecucion.
    <div className="grid gap-8 pb-8 pt-2 md:grid-cols-[5rem_repeat(3,minmax(0,1fr))_1rem] md:gap-x-10">
```

```tsx
/* web/src/components/reportes/reporte-redes.tsx:92-98 — current (Comentarios) */
    <details className="group/coms">
      <summary className={`${SUMARIO} inline-flex items-center gap-1 text-meta text-tinta-dato hover:text-tinta-titulo`}>
        {numero(p.cosechados)} {pluralizar(p.cosechados, "comentario", "comentarios")}
        <Desplegar size={12} aria-hidden className="transition-transform duration-[var(--dur-toque)] group-open/coms:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-3">
```

Both `<div>`s are the DIRECT child of their `<details>`, right after `<summary>`.

**Why not just add the existing `aparicion-suave` class to those divs.** Since
Chrome 131 a closed `<details>` hides its content with
`content-visibility: hidden` on `::details-content` instead of removing it from
rendering, so a class that is always on the element would animate at most once
(or not at all, if it ran while hidden) and never again on later opens. The
animation must start when the `open` attribute appears, which a selector on
`details[open]` guarantees in every engine.

## Target

The revealed block rises 6px and fades in over 260ms with the signature curve
each time its `<details>` opens. Closing stays instant (nothing to animate: the
content just leaves). Reduced motion: the global block in `globals.css`
already shortens every animation to 0.01ms, so nothing more is needed.

```css
/* target, in web/src/app/globals.css right after the .aparicion-suave rule */
details[open] > .al-abrir {
  animation: aparicion var(--dur-cambio) var(--ease-firma) both;
}
```

Exact values (all already tokens in this repo, do not inline numbers):

- keyframes: `aparicion` (existing: `from { opacity: 0; transform: translateY(0.375rem); } to { opacity: 1; transform: none; }`)
- duration: `var(--dur-cambio)` = 260ms
- easing: `var(--ease-firma)` = `cubic-bezier(0.32, 0.72, 0, 1)`
- fill: `both`

Only `opacity` and `transform` animate: no height, no layout property.

## Repo conventions to follow

- Motion tokens live in `web/src/app/globals.css`: `--dur-toque` 120ms,
  `--dur-cambio` 260ms, `--dur-entrada` 620ms, `--ease-firma`. The written rule
  there: «FIRMA MUEVE COSAS, EASE-OUT CAMBIA COSAS» — a block that moves 6px
  uses `--ease-firma`.
- Exemplar of the same keyframe used for "something new appears inside an open
  panel": `web/src/app/globals.css`, the `.aparicion-suave` rule
  (`animation: aparicion var(--dur-cambio) var(--ease-firma) both;`), consumed
  by `web/src/components/paneles/analisis-publicacion.tsx:143`.
- CSS comments in `globals.css` are Spanish **without accents** and name the
  case that motivated the rule. Class names are Spanish (`.al-abrir`).

## Steps

1. In `web/src/app/globals.css`, find this exact block:

   ```css
   .aparicion-suave {
     animation: aparicion var(--dur-cambio) var(--ease-firma) both;
   }
   ```

   Immediately after it (after its closing `}`), insert:

   ```css

   /* Lo que un <details> revela al abrirse, con la misma aparicion de una hoja.
      El caso: en el expediente («El año en redes», reportes/reporte-redes.tsx)
      abrir un mes metia nueve publicaciones en un cuadro y empujaba los meses
      de abajo sin decir de donde salian. Va colgado de [open] y no como clase
      fija porque desde Chrome 131 un <details> cerrado oculta su contenido con
      content-visibility, sin quitarlo: una clase fija animaria una sola vez.
      Cerrar no anima. El bloque de prefers-reduced-motion la apaga. */
   details[open] > .al-abrir {
     animation: aparicion var(--dur-cambio) var(--ease-firma) both;
   }
   ```

2. In `web/src/components/reportes/reporte-redes.tsx`, in `DetalleMes`, change

   ```tsx
       <div className="grid gap-8 pb-8 pt-2 md:grid-cols-[5rem_repeat(3,minmax(0,1fr))_1rem] md:gap-x-10">
   ```

   to

   ```tsx
       <div className="al-abrir grid gap-8 pb-8 pt-2 md:grid-cols-[5rem_repeat(3,minmax(0,1fr))_1rem] md:gap-x-10">
   ```

3. In the same file, in `Comentarios`, change

   ```tsx
         <div className="mt-3 grid gap-3">
   ```

   to

   ```tsx
         <div className="al-abrir mt-3 grid gap-3">
   ```

   (This string appears once, inside `Comentarios`. If it appears more than
   once, edit only the one directly after the `</summary>` of
   `<details className="group/coms">`.)

## Boundaries

- Do NOT touch any other file, component or `<details>` on the site; `.al-abrir`
  is opt-in by class.
- Do NOT change markup, structure, copy, or any other class.
- Do NOT animate height, `block-size`, `::details-content` or use
  `interpolate-size`: layout animation, partial browser support.
- Do NOT add a closing animation or JavaScript.
- Do NOT add new dependencies, tokens or keyframes.
- If an excerpt above doesn't match the file you find, STOP and report instead
  of improvising.

## Verification

- **Mechanical** (from `web/`):
  - `pnpm tipos` → ends with `✓ Types generated successfully` and no tsc errors.
  - `pnpm tokens` → `tokens ok — ningun valor fuera de escala.`
- **Feel check** at `http://localhost:3000/reportes/ismael-burgueno-2026`,
  section «El año en redes» → «Mes por mes»:
  - Open a month: the posts rise a few pixels and fade in; they no longer
    appear in one frame. Close and reopen the SAME month: it animates again.
  - Open a post's «N comentarios»: the tone line and list ease in the same way.
  - Click a month rapidly open/closed: nothing stalls or flickers; closing is
    instant.
  - DevTools → Animations panel at 10%: one `aparicion` per open, 260ms,
    opacity and transform only.
  - DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: content
    appears instantly.
- **Done when**: both class names are in place, the CSS rule exists once in
  `globals.css`, the two commands pass, and reopening a month replays the reveal.

## Revision — 5 October 2026: the close

The client found the close rough: as planned it was instant, so a month's
posts vanished in one frame and the rows below jumped up. Added, outside this
plan's original boundaries and at the client's request:

- `details.pliegue` in `globals.css`: `interpolate-size: allow-keywords` and a
  `::details-content` that transitions `block-size` 0 ↔ auto, `opacity`, and
  `content-visibility` (`allow-discrete`). Class `pliegue` on both `<details>`
  of `reporte-redes.tsx`.
- Close: opacity `var(--dur-toque) var(--ease-out)`, height
  `var(--dur-cambio) var(--ease-tamano)`, the new token
  `--ease-tamano: cubic-bezier(0.77, 0, 0.175, 1)`. Open: both on
  `var(--dur-cambio) var(--ease-firma)`.
- Measured in headless Chrome over CDP (the hidden pane does not advance the
  animation clock; a linear control transition proved the clock ran), 520px
  block. With `--ease-firma` the close went 520 → 141px in 64ms and crawled
  for 190ms more: that was the roughness. With `--ease-tamano`: opacity 0.02 at
  93ms with the height still at 430px, then the gap glides shut and lands at
  249ms. Without `interpolate-size` (Safari, Firefox) the close fades and then
  shuts, without the height animation.
