# 001 — Reveal the account inline under the name, instead of a floating panel

- **Status**: DONE (28 September 2026, executed in the working tree: a worktree from 3a66f4f would not contain the uncommitted rail)
- **Commit**: 3a66f4f — **but the rail is uncommitted work in the tree.** `riel.tsx`,
  `riel-cliente.tsx` and `iconos-nav.tsx` are untracked, and `globals.css` and
  `quien-mira.tsx` are modified. The excerpts below were copied from the working
  tree on 28 September 2026, not from 3a66f4f. Compare each excerpt with the file
  before editing (see Boundaries).
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Missed opportunities (a detached surface for an in-place state change)
- **Estimated scope**: 3 source files (`riel-cliente.tsx`, `riel.tsx`, `globals.css`) plus one line of `AGENTS.md`; roughly −70 / +90 lines

## Problem

The account at the foot of the desktop rail is a round button with the user's
initials. Pressing it opens a **floating popover to the right of the rail**. The
popover repeats the initials beside the name and email, then shows «Accesos»
(admins only) and «Salir». There are two problems:

1. **Two surfaces for one thing.** The client rejected exactly this on 24
   September 2026: a floating account panel with the initials repeated a finger's
   width away (the rejection is recorded in the history of
   `web/src/components/chrome/quien-mira.tsx`). The popover brought it back.
2. **The account is the only rail item with a different grammar.** Every other
   rail item is an icon over a label. The account is an unlabeled circle that
   opens a panel somewhere else. The user asked for the links to be revealed
   **under the name**, in place, with an animation.

Current code:

```tsx
// web/src/components/chrome/riel-cliente.tsx:29-52 — current
const ID_CUENTA = "cuenta-riel";

export function CuentaRiel({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const ruta = usePathname();

  // `hidePopover` sobre un panel cerrado lanza en algunos navegadores.
  useEffect(() => {
    const p = panel.current;
    if (p?.matches(":popover-open")) p.hidePopover();
  }, [ruta]);

  return (
    <>
      <button type="button" popoverTarget={ID_CUENTA} aria-label="Tu cuenta" className="boton-cuenta-riel">
        <InicialesCuenta />
      </button>
      <div ref={panel} id={ID_CUENTA} popover="auto" className="panel-cuenta" aria-label="Tu cuenta">
        <RenglonCuenta className="px-4 pt-4 pb-3" />
        <div className="border-t border-filo p-2">{children}</div>
      </div>
    </>
  );
}
```

```tsx
// web/src/components/chrome/riel.tsx:174-179 and :201-203 — current
  const salir = (
    <form action={cerrarSesion}>
      <button type="submit" className="renglon-cuenta">Salir</button>
    </form>
  );
  ...
        <div className="pie-riel">
          <CuentaRiel>{salir}</CuentaRiel>
        </div>
```

```css
/* web/src/app/globals.css:690-788 — current (abridged; the whole block goes) */
.pie-riel { margin-top: auto; display: flex; justify-content: center; padding-top: 1rem; }
.boton-cuenta-riel { anchor-name: --cuenta-riel; border-radius: 9999px; padding: 0.25rem; transition: …; }
.boton-cuenta-riel .inicial-cuenta { width: 2.25rem; height: 2.25rem; }
.boton-cuenta-riel:hover { background: var(--color-filo); }
.boton-cuenta-riel:active { transform: scale(0.97); }
.riel:has(.panel-cuenta:popover-open) .boton-cuenta-riel .inicial-cuenta { background: var(--color-realce); }
.panel-cuenta { position: fixed; … }            /* ~50 lines */
.panel-cuenta:popover-open { … }
@starting-style { .panel-cuenta:popover-open { … } }
@supports (position-anchor: --cuenta-riel) { .panel-cuenta { … } }
@supports not (position-anchor: --cuenta-riel) { .panel-cuenta { … } }
.panel-cuenta::backdrop { background: transparent; }
.renglon-cuenta { display: flex; width: 100%; … padding: 0.75rem 1rem; font-size: var(--text-cuerpo); … }
.renglon-cuenta:hover { background: var(--color-vela); color: var(--color-tinta-titulo); }
```

## Target

The account becomes a rail item: **the initials over the first name**, the same
shape as «En Tendencia» or «Redes». Pressing it reveals **«Accesos» (admins
only) and «Salir» directly under the name**, inside the rail. Pressing it again
hides them, and so do Escape, a click outside and navigating to another page.

**Nothing moves when it opens.** This is the one design decision the executor
must not "improve":

- The account sits at the bottom of the rail (`margin-top: auto`). If the links
  appeared by growing the footer's height (`grid-template-rows: 0fr → 1fr`), the
  footer would grow **upward**. The initials the user just clicked would slide
  about 80px up, out from under the pointer, and the pointer would land on the
  new «Salir»: a second click signs the user out. So:
- **The links' space is always reserved**, and the reveal animates only
  `opacity` and `transform`. When closed, the links are `visibility: hidden` and
  `inert` (not focusable, not announced). There is plenty of room: seven rail
  items take ~520px of the rail's height, and the rail already scrolls on short
  screens (`overflow-y: auto` on `.riel`).

The motion:

| Moment | Properties | Duration | Curve |
| --- | --- | --- | --- |
| Open | `opacity 0 → 1`, `transform: translateY(-4px) → none` | `var(--dur-cambio)` (260ms) | `var(--ease-firma)` = `cubic-bezier(0.32, 0.72, 0, 1)` |
| Close | reverse | `var(--dur-toque)` (120ms) | `var(--ease-out)` |
| Press on the account button | `transform: scale(0.97)` on `:active` | `var(--dur-toque)` | `var(--ease-out)` |
| Open-state indicator | initials background `--color-vela → --color-realce` | existing `.inicial-cuenta` transition (120ms ease-out) | — |

Close is faster than open on purpose: when opening the user is looking; when
closing the system is responding. `visibility` flips at the **end** of the close
transition and at the **start** of the open one, so the fade is visible both
ways.

Target markup (`riel-cliente.tsx`):

```tsx
export function CuentaRiel({ children }: { children: ReactNode }) {
  const cuenta = useCuentaRiel();
  const ruta = usePathname();
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null);
  const abierta = abiertaEn === ruta;
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbiertaEn(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbiertaEn(null);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierta]);

  return (
    <div ref={caja} className="cuenta-riel" data-abierta={abierta || undefined}>
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        title={cuenta?.titulo}
        onClick={() => setAbiertaEn(abierta ? null : ruta)}
        className="boton-cuenta-riel"
      >
        <InicialesCuenta />
        <span className="nombre-cuenta-riel">{cuenta?.corto ?? "Tu cuenta"}</span>
      </button>
      <div id={id} className="tramo-cuenta-riel" inert={!abierta}>
        {cuenta?.admin ? <a href="/admin/usuarios" className="renglon-cuenta">Accesos</a> : null}
        {children}
      </div>
    </div>
  );
}
```

Target CSS (replaces the whole account block in `globals.css`):

```css
/* La cuenta, al pie: las iniciales sobre el primer nombre, como los demas
   renglones del riel. Al pulsarla aparecen «Accesos» y «Salir» DEBAJO del
   nombre, en su sitio (28 de septiembre de 2026, cliente: el panel flotante a
   la derecha era una segunda superficie para una sola cosa y repetia las
   iniciales, lo mismo que se rechazo el 24 de septiembre).

   El hueco de los enlaces esta SIEMPRE reservado y solo se animan opacidad y
   transform. Si el pie creciera al abrir, creceria hacia ARRIBA (esta pegado
   abajo con `margin-top: auto`): las iniciales se irian 80px de debajo del
   puntero y el segundo clic caeria en «Salir». Cerrado es `visibility:
   hidden` e `inert`. Abre con la curva de firma en --dur-cambio y cierra en
   --dur-toque; `visibility` cambia al final del cierre y al principio de la
   apertura. */
.pie-riel {
  margin-top: auto;
  padding-top: 1rem;
}
.cuenta-riel {
  display: grid;
  gap: 0.25rem;
}
.boton-cuenta-riel {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0;
  border-radius: var(--radius-nucleo);
  color: var(--color-tinta-prosa);
  font-size: var(--text-meta);
  font-weight: 500;
  line-height: 1.2;
  transition:
    color var(--dur-toque) var(--ease-out),
    background-color var(--dur-toque) var(--ease-out),
    transform var(--dur-toque) var(--ease-out);
}
.boton-cuenta-riel .inicial-cuenta { width: 2.25rem; height: 2.25rem; }
.boton-cuenta-riel:active { transform: scale(0.97); }
.nombre-cuenta-riel {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cuenta-riel[data-abierta] .boton-cuenta-riel { color: var(--color-tinta-titulo); }
.cuenta-riel[data-abierta] .inicial-cuenta { background: var(--color-realce); }

.tramo-cuenta-riel {
  display: grid;
  gap: 0.125rem;
  visibility: hidden;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity var(--dur-toque) var(--ease-out),
    transform var(--dur-toque) var(--ease-out),
    visibility 0s linear var(--dur-toque);
}
.cuenta-riel[data-abierta] .tramo-cuenta-riel {
  visibility: visible;
  opacity: 1;
  transform: none;
  transition:
    opacity var(--dur-cambio) var(--ease-firma),
    transform var(--dur-cambio) var(--ease-firma),
    visibility 0s;
}
.renglon-cuenta {
  display: block;
  width: 100%;
  padding: 0.5rem 0;
  border-radius: var(--radius-nucleo);
  color: var(--color-tinta-prosa);
  font-size: var(--text-meta);
  font-weight: 500;
  text-align: center;
  transition:
    color var(--dur-toque) var(--ease-out),
    background-color var(--dur-toque) var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  .boton-cuenta-riel:hover,
  .renglon-cuenta:hover { background: var(--color-vela); color: var(--color-tinta-titulo); }
}
```

## Repo conventions to follow

- **Motion tokens live in `web/src/app/globals.css`**, in the `@theme` block and
  its `:root`: `--dur-toque: 120ms`, `--dur-cambio: 260ms`, `--dur-entrada:
  620ms`, `--ease-firma: cubic-bezier(0.32, 0.72, 0, 1)`, and Tailwind's
  `--ease-out`. Use only these. Do not write a raw duration or cubic-bezier.
  The repo's rule, written by the tokens: «firma mueve cosas, ease-out cambia
  cosas».
- **Exemplar for the open/close state: `CuentaPastilla` at commit 3a66f4f**
  (`git show 3a66f4f:web/src/components/chrome/quien-mira.tsx`, lines 79–150).
  It is the same state machine this plan asks for: `abiertaEn` keyed to the
  pathname, so navigating closes it without an effect; Escape and outside
  `pointerdown` close it; the closed strip is `inert`. Copy that logic. Its CSS
  (`.tramo-cuenta`, around line 618 of that commit's `globals.css`) is the
  precedent for asymmetric open/close timing. That strip animated
  `grid-template-columns`, which is layout. Do **not** copy that part; this plan
  reserves the space instead.
- **Rail item exemplar:** `.renglon-riel` in `globals.css` (around line 657) and
  `RenglonRiel` in `riel.tsx`: icon over label, `--text-meta`, 500 weight,
  `--radius-nucleo`. The account button must look like one of these.
- **Hover is gated** behind `@media (hover: hover) and (pointer: fine)`, as the
  rail's other hover rules are.
- **Reduced motion:** the global rule in `globals.css` (`@media
  (prefers-reduced-motion: reduce)`, around line 380) sets every
  `transition-duration` to `0.01ms !important`. The repo decided this on purpose
  («No es opcional… la desactiva completa»). Add no local reduced-motion block;
  it would never apply.
- **Comments are Spanish without accents** and name the case that motivated the
  code (see the comment in the target CSS). Identifiers are Spanish.

## Steps

1. **`web/src/components/chrome/quien-mira.tsx`: expose what the rail needs.**
   Add and export, next to `InicialesCuenta`, a hook that reuses the existing
   private `useCuenta()` (same SWR key `/api/yo`, so no extra request):

   ```tsx
   /**
    * Lo que el pie del riel pinta: el primer nombre como rotulo y el nombre
    * entero con el correo en el `title`. Sin nombre, la parte del correo antes
    * de la arroba: un correo entero no cabe en 96px.
    */
   export function useCuentaRiel(): { corto: string; titulo: string; admin: boolean } | null {
     const cuenta = useCuenta();
     if (!cuenta) return null;
     const corto = cuenta.nombre.includes("@") ? (cuenta.nombre.split("@")[0] ?? cuenta.nombre) : (cuenta.nombre.split(/\s+/)[0] ?? cuenta.nombre);
     const titulo = cuenta.correo && cuenta.correo !== cuenta.nombre ? `${cuenta.nombre} · ${cuenta.correo}` : cuenta.nombre;
     return { corto, titulo, admin: cuenta.admin };
   }
   ```

   Leave `InicialesCuenta` and `RenglonCuenta` unchanged. `RenglonCuenta` is
   still used by the phone's «Más» sheet (`menu-lector.tsx:134`).

2. **`web/src/components/chrome/riel-cliente.tsx`: replace `CuentaRiel`** with
   the target markup above.
   - Imports: `useEffect, useId, useRef, useState, type ReactNode` from
     `"react"`; `InicialesCuenta, useCuentaRiel` from `quien-mira`.
   - Remove the `RenglonCuenta` import and the `ID_CUENTA` constant.
   - Keep `PestanaMas` exactly as it is.
   - Rewrite the `CuentaRiel` paragraph of the file's header comment. It should
     say that the account reveals «Accesos» and «Salir» under the name, in
     place, with the space reserved so nothing moves under the pointer, and that
     this replaced the right-hand popover on 28 September 2026 because it
     repeated the initials on a second surface.

3. **`web/src/components/chrome/riel.tsx`.**
   - Leave the `salir` form as it is (`className="renglon-cuenta"` stays; its
     CSS changes in step 4).
   - Leave `<div className="pie-riel"><CuentaRiel>{salir}</CuentaRiel></div>` as
     it is.
   - In the header comment, change «Lo unico de cliente es la cuenta (un
     popover que se cierra al navegar)» to «Lo unico de cliente es la cuenta
     (un tramo que aparece bajo el nombre y se cierra al navegar)».

4. **`web/src/app/globals.css`: replace the account block.**
   - Delete everything from the comment `/* La cuenta, al pie. Las iniciales
     crecen a 36px` down to and including `.renglon-cuenta:hover { … }`. That
     covers `.pie-riel`, `.boton-cuenta-riel*`, the `.riel:has(.panel-cuenta…)`
     rule, every `.panel-cuenta` rule including `@starting-style` and both
     `@supports` blocks, `.panel-cuenta::backdrop` and `.renglon-cuenta*`.
   - Paste the target CSS in its place.
   - Search the file for `panel-cuenta` and `--cuenta-riel`; the result must be
     zero matches.

5. **`AGENTS.md`**, in the bullet «The site navigation is a left rail on
   desktop…»: change «and the account (a native `popover`) at the foot» to «and
   the account at the foot, which reveals Accesos and Salir under the name in
   place (space reserved, so nothing moves under the pointer)».

## Boundaries

- Do NOT touch the phone: `PestanaMas`, `menu-lector.tsx` and `RenglonCuenta`
  keep the account in the «Más» sheet.
- Do NOT animate `height`, `grid-template-rows`, `max-height`, `margin` or
  `padding`. Only `opacity`, `transform`, and the discrete `visibility` flip.
  The reserved space is the design.
- Do NOT add a stagger, a spring, a bounce or a new library.
- Do NOT change the navigation items, the rail's width or `--riel-ancho`.
- Do NOT add a local `prefers-reduced-motion` block (see conventions).
- If any "current" excerpt above does not match the file you open (the rail was
  uncommitted work when this plan was written), STOP and report the mismatch
  instead of improvising.

## Verification

- **Mechanical** (from `web/`):
  - `pnpm tipos` must print `✓ Types generated successfully`, with no `tsc`
    errors.
  - `pnpm tokens` must print `tokens ok — ningun valor fuera de escala.`
  - `node scripts/probar-analisis.cjs` must exit 0. It checks that `riel.tsx`
    paints the visible sueltas.
  - `grep -rn "panel-cuenta\|popoverTarget=\"cuenta\|--cuenta-riel" src` must
    return nothing.
- **Feel check** (dev server at a desktop width ≥ 768px, e.g. `/garitas`):
  - Closed, the rail foot shows the initials over the first name, aligned like
    the other items, with empty space below them.
  - Click the initials. «Accesos» (only with an admin role; `ACCESO_DEV_ROL` in
    `web/.env`) and «Salir» fade in **under the name** and drop 4px into place.
    **The initials and the name do not move at all.** Hold the pointer still
    after the click: it must still be over the initials, not over «Salir».
  - Click again: the links fade out **faster** than they came in.
  - Open it and press Escape: it closes. Open it and click the page: it closes.
    Open it and click «Redes»: the next page renders with it closed.
  - Keyboard: Tab reaches the account button. While closed, Tab does NOT land on
    an invisible «Accesos»/«Salir». While open, Tab reaches them in order.
    VoiceOver or NVDA announces the button as expanded or collapsed.
  - DevTools → Animations panel at 10% playback: open and close. The opacity and
    the 4px translate move together with no pop at either end, and nothing
    flashes before or after the close fade (the `visibility` delay is correct).
  - DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: the links
    appear and disappear instantly. That is the repo's global rule, and it is
    expected.
  - Spam-click the button: each click retargets smoothly from where the fade is
    (transitions, not keyframes), with no restart from zero.
- **Done when:** no popover remains, the account reveals in place with the
  values above, the initials never move when it opens, and all four mechanical
  checks pass.
