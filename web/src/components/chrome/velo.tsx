/**
 * El velo de arriba: la orilla superior se disuelve en el propio negro de la
 * pagina antes de llegar a la pildora.
 *
 * Componente de servidor, cero JavaScript, hermano de `Malla`.
 *
 * POR QUE EXISTE. La pildora es `bg-black/40` y flota sobre contenido que
 * hace scroll, asi que los titulares se leian A TRAVES de ella, y ademas
 * quedaban dos franjas descubiertas —24px arriba de la pildora y 20px entre
 * la pildora y la barra del muro— por donde las filas desfilaban a opacidad
 * completa. Tres bandas de texto pisandose es lo que se veia como un
 * desorden al scrollear.
 *
 * La respuesta correcta en este arquetipo no es opacar la pildora, que le
 * quitaria el cristal: es que el CONTENIDO se apague al subir. El velo es
 * `--color-vanta`, o sea el mismo fondo de <html>, asi que no introduce una
 * superficie nueva; la pagina se desvanece en su propio piso.
 *
 * Las paradas van en unidades absolutas contra `--nav-alto` y no en
 * porcentajes: asi la parte solida termina donde termina la pildora, sin
 * importar cuanto mida la cola. Son siete paradas con caida desacelerada
 * (0.9 -> 0.62 -> 0.32 -> 0.12 -> 0) por dos razones: una rampa lineal deja
 * un borde visible donde el velo se acaba, y sobre negro OLED un degradado
 * de dos paradas hace bandas.
 *
 * SOLO EN ESCRITORIO desde el 18 de septiembre de 2026. Existe por la pastilla
 * flotante, y la pastilla dejo de flotar debajo de 48rem: ahi la nav es una
 * cinta opaca pegada a la orilla, que tapa lo que sube porque es opaca y no
 * porque apague el contenido. Dejarlo encendido no era neutro: la cinta cubre
 * su banda solida, pero la COLA del degradado seguia pintando de 71px a 136px,
 * o sea una bruma gris colgando del filo de una barra que ya no esta debajo.
 * La consulta va en una utilidad y no en globals.css porque nada sin capa le
 * fija `display` a este elemento, asi que `md:block` gana; el caso contrario
 * esta escrito en `.control-lector[data-solo-movil]`.
 *
 * Va DENTRO de <main>, que es el contexto de apilamiento, y ANTES de las
 * secciones. Con el mismo `--z-elevado` que la barra pegajosa del muro, el
 * orden del DOM decide: el velo tapa las filas, y la barra tapa al velo.
 * Sin eventos: es una capa que se ve, no una que se toca.
 */
export function Velo() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-elevado)] hidden h-[calc(var(--nav-alto)+3.5rem)] md:block"
      style={{
        background: [
          "linear-gradient(to bottom,",
          "var(--color-vanta) 0,",
          "var(--color-vanta) calc(var(--nav-alto) - 0.75rem),",
          "rgb(5 5 5 / 0.9) var(--nav-alto),",
          "rgb(5 5 5 / 0.62) calc(var(--nav-alto) + 1rem),",
          "rgb(5 5 5 / 0.32) calc(var(--nav-alto) + 2rem),",
          "rgb(5 5 5 / 0.12) calc(var(--nav-alto) + 2.75rem),",
          "rgb(5 5 5 / 0) calc(var(--nav-alto) + 3.5rem))",
        ].join(" "),
      }}
    />
  );
}
