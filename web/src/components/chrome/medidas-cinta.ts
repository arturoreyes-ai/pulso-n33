/**
 * Las medidas de la cinta, en un solo sitio.
 *
 * EL CASO, 18 de septiembre de 2026: el telefono tenia DOS barras superiores.
 * La del lector media 71px pegada a la orilla, con un filo de 1px y sin radio;
 * la pastilla flotante media 62px a 16px del borde, redonda, con `bg-black/40`
 * y blur. Se escribieron por separado y por separado se separaron: la casa
 * salia a 14 en una rama y a 18 en la otra, el hover a --color-vela en una y a
 * --color-filo en la otra, el radio a 16 en una y redondo en la otra. Ninguna
 * de esas tres diferencias la decidio nadie.
 *
 * Lo que es CSS vive en globals.css (`.cinta`, `.fila-cinta`, `.cinta-pagina`);
 * lo que es prop de React vive aqui, porque a un `size={22}` no lo alcanza
 * ninguna hoja de estilos. Cambiar una medida se hace en uno de esos dos
 * sitios, nunca dentro de un componente.
 */

/** El control de la barra: 44x44 de blanco de toque y radio --radius-nucleo.
 *  Vivia en components/lector/lector.tsx y se muda aqui para que chrome/ no
 *  tenga que importar de lector/ para dibujar su propia barra. Aquel modulo lo
 *  reexporta, asi que sus cinco importadores no se enteran. */
export const CONTROL = "control-lector";

/** La franja y su fila. En clase y no en utilidades porque las dos superficies
 *  que la usan —el lector y una pagina— tienen bloques contenedores distintos
 *  y solo el CSS garantiza que las MEDIDAS sean una sola. */
export const CINTA = "cinta";
export const FILA_CINTA = "fila-cinta";
export const CINTA_PAGINA = "cinta-pagina";

/**
 * Los glifos. Son dos tamanos de control y no uno, y la diferencia es OPTICA,
 * no de caja: los tres controles miden 44x44 igual.
 *
 *   22  el glifo que llena su cuadro -- el menu;
 *   20  el que se dibuja estrecho y a 22 pesaria mas que sus vecinos aun
 *       midiendo lo mismo la caja: la flecha de volver y la lupa;
 *   16  el caret, que acompana a un texto y no a un blanco de toque.
 *
 * La casa NO esta aqui: solo existe en la pastilla de escritorio, donde va
 * junto a un texto de 12px y mide 14. La de 18 de la rama de telefono murio
 * con esa rama -- se habia dimensionado para un blanco de toque sin texto.
 */
export const ICONO_CONTROL = 22;
export const ICONO_ESTRECHO = 20;
export const ICONO_DESPLEGAR = 16;
