# 001 — Give every sheet an entrance and an exit

- **Status**: DONE (2026-09-24)
- **Commit**: acb0123
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Physicality & origin
- **Estimated scope**: 2 files (`web/src/app/globals.css`, `web/src/components/ui/hoja.tsx`), ~50 lines

## Problem

Every sheet in the dashboard is a native `<dialog>` with the class
`.dialogo-lector`: comments, «Lectura automática» (Analizar), notas
relacionadas, place picker, menu, search. It is opened by `showModal()` and
closed by `close()`, and **neither has any motion**. On a phone the sheet is
anchored to the bottom edge (`inset: auto 0 0`), so it teleports from nothing
to a panel that can be 90% of the screen tall, and vanishes the same way. There
is no spatial cue that it came from the bottom edge or that closing it returns
you to the card underneath. The backdrop also snaps to 85% black instantly.

```css
/* web/src/app/globals.css:794 — current */
.dialogo-lector {
  position: fixed;
  inset: auto 0 0;
  margin: 0 auto;
  width: 100%;
  max-width: 40rem;
  max-height: calc(100svh - env(safe-area-inset-top) - 1rem);
  padding: 0 0 env(safe-area-inset-bottom);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-carta);
  color: var(--color-tinta-prosa);
  border: 1px solid var(--color-filo);
  border-radius: var(--radius-panel) var(--radius-panel) 0 0;
}
@media (min-width: 48rem) {
  /* En escritorio la hoja no nace del borde: flota centrada. */
  .dialogo-lector {
    inset: 0;
    margin: auto;
    max-height: min(80svh, 48rem);
    padding: 0;
    border-radius: var(--radius-panel);
  }
}
.dialogo-lector::backdrop { background: var(--color-vanta); opacity: 0.85; }
```

There is a trap that makes a naive exit animation look broken. Every caller
empties the sheet's content in `onClose`, and the dialog's `close` event fires
the moment `close()` is called, before any exit transition:

```tsx
// web/src/components/paneles/visor-redes.tsx:252 — current
<Hoja ref={hojaIA} titulo="Lectura automática" rotuloCerrar="Cerrar lectura" onClose={() => setAnalizada(null)}>
  {analizada === null ? null : <FichaPublicacion key={analizada.clave} fila={analizada} />}
</Hoja>
```

Same pattern at `visor-redes.tsx:247`, `ahora/feed-ahora.tsx:154`,
`paneles/ficha-consulta.tsx:387` and `ahora/analisis-titular.tsx:92`. With
only CSS added, the sheet would slide down **empty**, shrinking to its header
as it goes. So the caller's `onClose` has to run after the exit ends.

```tsx
// web/src/components/ui/hoja.tsx:22 — current
export function Hoja({ ref, id, titulo, rotuloCerrar, onClose, children }: { ... }) {
  const idTitulo = `${useId()}-titulo`;
  return (
    <dialog ref={ref} id={id} className="dialogo-lector" aria-labelledby={idTitulo} onClose={onClose}>
```

## Target

**Phone (below 48rem):** the sheet slides up from its own bottom edge,
`translateY(100%)` → `none`, and slides back down on close. Opacity stays at 1:
it is a physical panel, not a fade.

**Desktop (48rem and up):** the sheet floats centered, so it is a modal:
`opacity: 0; transform: scale(0.96)` → `opacity: 1; transform: none`.
`transform-origin` stays at its default, `center`. That is correct for a
centered modal; do not anchor it to anything.

**Backdrop:** opacity `0` → `0.85` over the same time.

**Timing:** duration `var(--dur-cambio)` (260ms) for enter and exit, curve
`var(--ease-firma)` (`cubic-bezier(0.32, 0.72, 0, 1)`, the iOS drawer curve;
the repo already owns it). The backdrop uses `var(--ease-out)`.

Use **no new duration**. `globals.css:257` says there are three named durations
and nothing outside that list, and `pnpm tokens` enforces it.

Target CSS. Replace the block quoted above with this block, keeping every
existing property:

```css
.dialogo-lector {
  position: fixed;
  inset: auto 0 0;
  margin: 0 auto;
  width: 100%;
  max-width: 40rem;
  max-height: calc(100svh - env(safe-area-inset-top) - 1rem);
  padding: 0 0 env(safe-area-inset-bottom);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-carta);
  color: var(--color-tinta-prosa);
  border: 1px solid var(--color-filo);
  border-radius: var(--radius-panel) var(--radius-panel) 0 0;
  /* La hoja nace del borde de abajo y vuelve a el. Estado cerrado aqui,
     abierto en [open], y el de partida en @starting-style: sin JS. `overlay`
     y `display` con allow-discrete mantienen el dialogo en la capa superior
     mientras sale; sin ellos desaparece de golpe y la salida no se ve. Donde
     el navegador no los conoce, la hoja sale seca, como antes. */
  transform: translateY(100%);
  transition:
    transform var(--dur-cambio) var(--ease-firma),
    opacity var(--dur-cambio) var(--ease-firma),
    overlay var(--dur-cambio) allow-discrete,
    display var(--dur-cambio) allow-discrete;
}
.dialogo-lector[open] { transform: none; }
@starting-style {
  .dialogo-lector[open] { transform: translateY(100%); }
}
@media (min-width: 48rem) {
  /* En escritorio la hoja no nace del borde: flota centrada. Por eso aparece
     en su lugar, desde el centro, y no se desliza. */
  .dialogo-lector {
    inset: 0;
    margin: auto;
    max-height: min(80svh, 48rem);
    padding: 0;
    border-radius: var(--radius-panel);
    opacity: 0;
    transform: scale(0.96);
  }
  .dialogo-lector[open] { opacity: 1; transform: none; }
  @starting-style {
    .dialogo-lector[open] { opacity: 0; transform: scale(0.96); }
  }
}
.dialogo-lector::backdrop {
  background: var(--color-vanta);
  opacity: 0;
  transition:
    opacity var(--dur-cambio) var(--ease-out),
    overlay var(--dur-cambio) allow-discrete,
    display var(--dur-cambio) allow-discrete;
}
.dialogo-lector[open]::backdrop { opacity: 0.85; }
@starting-style {
  .dialogo-lector[open]::backdrop { opacity: 0; }
}
```

**Reduced motion needs no new code.** The global block at `globals.css:381`
sets `transition-duration: 0.01ms !important` on everything, so the sheet
simply appears and disappears, as it does today.

Target `Hoja`: it runs the caller's `onClose` after the exit transition, and
skips it if the sheet was reopened in the meantime.

```tsx
// web/src/components/ui/hoja.tsx — target (only the parts that change)
import { useId, useRef, type ReactNode, type Ref } from "react";

/** Un poco mas que --dur-cambio (260ms): si `transitionend` no llega (sin
 *  transicion, movimiento reducido, pestana oculta), el vaciado ocurre
 *  igual. */
const MS_SALIDA = 300;

export function Hoja({ ref, id, titulo, rotuloCerrar, onClose, children }: { /* unchanged */ }) {
  const idTitulo = `${useId()}-titulo`;
  const pendiente = useRef<number | undefined>(undefined);

  // El `close` del dialogo llega al EMPEZAR a cerrar, y quien usa la hoja
  // vacia su contenido ahi. Con la salida animada eso bajaba una hoja vacia.
  // Se espera a que termine la transicion; si la hoja se reabrio mientras
  // tanto, el contenido nuevo ya es otro y no se toca.
  function alCerrar(evento: React.SyntheticEvent<HTMLDialogElement>) {
    if (onClose === undefined) return;
    const dialogo = evento.currentTarget;
    window.clearTimeout(pendiente.current);
    const terminar = () => {
      window.clearTimeout(pendiente.current);
      dialogo.removeEventListener("transitionend", alTerminar);
      if (!dialogo.open) onClose();
    };
    const alTerminar = (e: TransitionEvent) => {
      if (e.target === dialogo && e.propertyName === "transform") terminar();
    };
    dialogo.addEventListener("transitionend", alTerminar);
    pendiente.current = window.setTimeout(terminar, MS_SALIDA);
  }

  return (
    <dialog ref={ref} id={id} className="dialogo-lector" aria-labelledby={idTitulo} onClose={alCerrar}>
      {/* rest unchanged */}
```

If `React.SyntheticEvent` is not in scope, import `type SyntheticEvent` from
`"react"` and use that. Do not add a namespace import.

## Repo conventions to follow

- Durations are only `--dur-toque` (120ms), `--dur-cambio` (260ms) and
  `--dur-entrada` (620ms), declared at `web/src/app/globals.css:292-294`. Curves
  are `--ease-firma` (moves things, `globals.css:45`) and Tailwind's `--ease-out`
  (changes things). The rule is written at `globals.css:273`: «FIRMA MUEVE
  COSAS, EASE-OUT CAMBIA COSAS».
- An exemplar of a transition with named tokens, in plain CSS:
  `globals.css:370-377` (`[data-revelar="listo"]`).
- CSS comments in `globals.css` are Spanish **without accents** and say why.
  Match that in anything you add.
- Components are Spanish: no English identifiers in `web/src/`.

## Steps

1. In `web/src/app/globals.css`, find the `.dialogo-lector` block, its
   `@media (min-width: 48rem)` override and the `::backdrop` line (about lines
   794–825, quoted above). Replace them with the target CSS. Do not touch
   `.cabecera-dialogo-lector` that follows.
2. In `web/src/components/ui/hoja.tsx`, add `useRef` to the React import, add
   the `MS_SALIDA` constant above the component, and add the `pendiente` ref
   and the `alCerrar` function inside it. Change `onClose={onClose}` on the
   `<dialog>` to `onClose={alCerrar}`. Leave the header and close button as
   they are.
3. Check `web/src/components/chrome/menu-cinta.tsx`. It uses the
   `.dialogo-lector` class directly instead of `Hoja` (see its comment at
   line 38). It gets the CSS for free. If it has its own `onClose` that empties
   content, report it and leave it. Do not refactor it into `Hoja`.

## Boundaries

- Do NOT change what any caller of `Hoja` does in its `onClose`. The deferral
  lives in `Hoja` only.
- Do NOT add a duration or curve token, and do NOT write a raw `ms` value in a
  `.tsx` className (`pnpm tokens` rejects `duration-300` and the like). The
  300 in `MS_SALIDA` is a JS timeout, which is allowed.
- Do NOT add `will-change` or a motion library.
- Do NOT anchor the desktop modal's `transform-origin`: `center` is correct for
  a centered modal.
- If the code at the cited lines doesn't match (drift since `acb0123`), STOP
  and report instead of improvising.

## Verification

- **Mechanical** (from `web/`):
  - `pnpm tipos` passes.
  - `pnpm tokens` prints `tokens ok`.
  - `node scripts/probar-analisis.cjs` passes. It reads
    `ahora/analisis-titular.tsx` as text, which this plan does not touch.
- **Feel check**: run the dev server (`http://localhost:3000`, usually already
  running), open the portada and press **Analizar** on a card, then close.
  Open **Comentarios** on `/redes` and close. Do both at desktop width and in
  the phone viewport (375×812):
  - Phone: the sheet rises from the bottom edge and lands without bounce. On
    close it slides down **with its content still inside**. It must never
    shrink to an empty header.
  - Desktop: it grows slightly (96% → 100%) and fades in centered. No slide.
  - The backdrop darkens with the sheet and lightens as it leaves.
  - Close and instantly reopen on another card: the new content appears and
    does not get wiped 300ms later. This is the `dialogo.open` guard.
  - Press Esc: same exit as the close button.
  - In DevTools Animations, set playback to 10% and confirm the phone sheet
    starts fast and settles slowly (the drawer curve), with nothing flashing at
    full size before it slides.
  - In the Rendering panel, set `prefers-reduced-motion: reduce`: open and
    close are instant, and content still clears after closing.
- **Done when**: all sheets animate on both widths, no sheet empties while
  visible, and the three commands pass.
