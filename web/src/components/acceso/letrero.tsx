/**
 * La marca de la puerta: los diodos ENCENDIDOS del panel que dibuja
 * acceso/fondo-led.tsx. Misma reticula y mismo paso, en el rojo de marca.
 *
 * Componente de servidor, cero JavaScript.
 *
 * ES LA UNICA PIEZA GRAFICA DE MARCA QUE EXISTE. No hay logo, ni favicon, ni
 * og-image, y en la nav la marca son 12px de Geist detras de un icono de
 * casa. Esta pagina es la primera que le pone cara.
 *
 * NO ES UNA IMAGEN, a proposito. Un PNG seria un archivo que mantener, una
 * peticion mas en la unica pagina del sitio que hoy no hace ninguna, y una
 * segunda copia para pantallas de doble densidad. Recortar la reticula contra
 * el texto no cuesta nada, escala solo, y sobre todo mantiene la marca hecha
 * DEL MISMO panel que el fondo, que es la idea entera.
 *
 * El rojo no estrena nada: extiende el unico precedente que ya habia, el
 * subrayado de `.pestana-lector`, donde --color-chart-1 aparece como TRAZO y
 * no como texto porque a tamano de cuerpo no pasa AA. Aqui es lo mismo, en
 * puntos.
 *
 * Es un <p> y no un <h1>: el h1 de la pagina es el de la entrada. Y va
 * `aria-hidden` porque la marca ya la dicen el <title> y el h1; anunciarla una
 * tercera vez antes de la puerta no agrega nada.
 */
export function Letrero() {
  return (
    <p aria-hidden className="letrero-marca">
      Pulso N33
    </p>
  );
}
