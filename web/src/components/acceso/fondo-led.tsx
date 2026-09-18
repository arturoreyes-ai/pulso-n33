/**
 * El campo del panel: la reticula de diodos apagados que hace que la puerta
 * ENTERA sea una pantalla.
 *
 * Componente de servidor, cero JavaScript, hermano de chrome/malla.tsx en
 * todo: capa fija, sin eventos, puro CSS. Y compatible con ella a proposito.
 * Entre punto y punto la reticula es transparente, asi que los orbes violeta
 * y esmeralda se siguen viendo a traves: el lavado de color es del sitio, la
 * reticula es de esta pagina, y se suman en vez de taparse.
 *
 * FIJA Y NO UN FONDO DEL CONTENEDOR. Un `background-image` sobre el div de la
 * pagina se desplaza con ella, que es como se ve un papel tapiz; una capa fija
 * se queda quieta y el texto pasa por delante, que es como se ve una pantalla.
 * Es tambien lo que pide la regla de rendimiento que malla.tsx tiene escrita:
 * nada de texturas sobre algo que hace scroll.
 *
 * Va primera en el DOM dentro de <main>, que es `relative z-base` y por tanto
 * su propio contexto de apilamiento: ahi adentro el orden del DOM ya decide
 * quien tapa a quien y no hace falta estrenar un z-index suelto.
 *
 * Todo el dibujo —paso, mascara, barrido— esta en app/globals.css bajo
 * `.fondo-led`, porque el paso lo comparte con la marca y una clase no puede
 * llevar el parrafo que explica por que vale 3px.
 */
export function FondoLed() {
  return <div aria-hidden className="fondo-led" />;
}
