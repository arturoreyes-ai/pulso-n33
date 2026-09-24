# 003 — Make the ficha's smooth scroll respect reduced motion

- **Status**: DONE (2026-09-24)
- **Commit**: acb0123
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`web/src/components/paneles/ficha-consulta.tsx`), ~8 lines

## Problem

The term ficha (`/redes?q=…`) has two links that scroll smoothly. Publicaciones
goes to the first post card and Noticias goes to the news list:

```tsx
// web/src/components/paneles/ficha-consulta.tsx:176 — current
function irAPublicaciones(evento: MouseEvent<HTMLButtonElement>) {
  evento.currentTarget.closest(".recorrido-lector")
    ?.querySelector<HTMLElement>('[data-indice="1"]')
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Lleva a la lista de noticias de la misma ficha. */
function irANoticias(evento: MouseEvent<HTMLButtonElement>) {
  evento.currentTarget.closest("article")?.querySelector<HTMLElement>("#ficha-prensa")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
```

The global reduced-motion block (`web/src/app/globals.css:381`) sets
`scroll-behavior: auto !important`. That covers CSS-driven scrolling only. An
explicit `behavior: "smooth"` passed from JS is not overridden by it, so
someone who asked for reduced motion still gets a full-screen animated scroll
here. That is the largest motion this dashboard produces. Everywhere else the
reader already handles this correctly:

```ts
// web/src/lib/pantalla/recorrido.ts:31 — the exemplar
function desplazar(raiz: HTMLElement, tarjeta: HTMLElement, suave: boolean, interior = 0) {
  const behavior = suave && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant";
```

## Target

Both functions compute `behavior` the same way `recorrido.ts` does: `"smooth"`
normally, `"instant"` under `prefers-reduced-motion: reduce`.

```tsx
// target
/** «smooth» salvo con movimiento reducido. El bloque global de globals.css
 *  pone `scroll-behavior: auto`, pero eso no alcanza a un `behavior` pedido
 *  desde JS: sin esto, quien pidio menos movimiento recibia el desplazamiento
 *  mas largo del tablero. Igual que lib/pantalla/recorrido.ts. */
function comportamiento(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

function irAPublicaciones(evento: MouseEvent<HTMLButtonElement>) {
  evento.currentTarget.closest(".recorrido-lector")
    ?.querySelector<HTMLElement>('[data-indice="1"]')
    ?.scrollIntoView({ behavior: comportamiento(), block: "start" });
}

/** Lleva a la lista de noticias de la misma ficha. */
function irANoticias(evento: MouseEvent<HTMLButtonElement>) {
  evento.currentTarget.closest("article")?.querySelector<HTMLElement>("#ficha-prensa")
    ?.scrollIntoView({ behavior: comportamiento(), block: "start" });
}
```

Place `comportamiento` directly above `irAPublicaciones`, after that
function's existing doc comment has been moved down so it still sits on
`irAPublicaciones`.

## Repo conventions to follow

- The exemplar is `web/src/lib/pantalla/recorrido.ts:31-35`, quoted above.
- Doc comments are Spanish without accents and state the case that forced
  them.
- Do not import from `recorrido.ts`. Its `desplazar` is private and has a
  different signature, and a two-line helper here is cheaper than widening that
  module's API.

## Steps

1. In `web/src/components/paneles/ficha-consulta.tsx`, add the `comportamiento`
   function right above `irAPublicaciones`, keeping `irAPublicaciones`'s doc
   comment attached to it.
2. In both `scrollIntoView` calls, replace `behavior: "smooth"` with
   `behavior: comportamiento()`.
3. Run `grep -rn 'behavior: "smooth"' web/src`. If any other hit remains
   outside `recorrido.ts`, list it in your report. Do not fix it in this plan.

## Boundaries

- Only `ficha-consulta.tsx`.
- Do NOT change `block: "start"` or the selectors.
- If the functions don't match the quoted code, STOP and report.

## Verification

- **Mechanical** (from `web/`): `pnpm tipos` passes.
- **Feel check**: open `/redes?q=Vive%20la%20Baja` on the dev server.
  - With normal motion, pressing the Publicaciones card scrolls smoothly to the
    first post. This is unchanged.
  - In DevTools, open Rendering and set «Emulate CSS media feature
    prefers-reduced-motion: reduce». Reload, then press Publicaciones and
    Noticias: each jumps instantly, with no animated scroll.
- **Done when**: both calls use `comportamiento()` and the reduced-motion jump
  is instant.
