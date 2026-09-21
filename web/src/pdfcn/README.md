# pdfcn (base Takumi)

Copia de los componentes de [pdfcn](https://www.pdfcn.dev), un registro de
shadcn para armar PDFs con JSX sobre `takumi-pdf`. Licencia MIT (Shadcn
Labs). Los trae `scripts/sincronizar-pdfcn.mjs`, que explica por que no se
usa el CLI de shadcn.

**No se edita a mano.** Una sincronizacion borra esta carpeta entera y la
vuelve a escribir con lo que el registro publica ese dia; lo que se cambie
aqui se pierde. Los identificadores son los de pdfcn, en ingles, y no se
traducen: es la unica excepcion a la regla de identificadores en espanol de
AGENTS.md, acotada a esta carpeta. Cada archivo abre con `@ts-nocheck`: pdfcn
compila sin `noUncheckedIndexedAccess` y este repo con el, y se trata como una
libreria; lo que se tipa es el codigo que la usa.

Lo nuestro vive fuera: el tema propio (Geist, los colores del tablero) en
`src/lib/informe/tema.ts`, las fuentes en `src/lib/informe/fuentes.ts` y el
documento en `src/components/informe/`. Esos archivos importan de aqui; nada
de aqui importa de ellos.

Para volver a sincronizar: `node scripts/sincronizar-pdfcn.mjs` desde `web/`,
luego `pnpm tipos` y `node scripts/probar-informe.cjs`. Los items que se
bajan estan listados en el script; `types/` son dos modulos que el registro
no publica y se bajan del repositorio de pdfcn.

Version de referencia: takumi-pdf 0.14.3, sincronizado el 2026-09-19.
