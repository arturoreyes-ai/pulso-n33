import type { Carril, Cruce } from "./tipos";

const RELOJ = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Tijuana", hour: "numeric", minute: "2-digit", hour12: true,
});
const FECHA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Tijuana", day: "2-digit", month: "short",
});
export const horaLocal = (fecha: string) => RELOJ.format(new Date(fecha));
export const fechaLocal = (fecha: string) => `${FECHA.format(new Date(fecha))}, ${horaLocal(fecha)}`;
export function duracion(minutos: number, locucion = false): string {
  if (minutos < 60) return `${minutos} ${locucion ? minutos === 1 ? "minuto" : "minutos" : "min"}`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return locucion
    ? `${horas} ${horas === 1 ? "hora" : "horas"} y ${resto} ${resto === 1 ? "minuto" : "minutos"}`
    : `${horas} h ${resto.toString().padStart(2, "0")} min`;
}
export function vigente(carril: Carril, ahora: number): boolean {
  if (!carril.observado) return false;
  const edad = ahora - Date.parse(carril.observado);
  return edad >= 0 && edad <= 90 * 60_000;
}
/**
 * La hora como se dice, no como se escribe. Un locutor no lee «11:00 AM»:
 * lee «once de la manana». El reloj de 12 con la franja es lo que se pronuncia
 * sin tropezar.
 */
const RELOJ24 = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Tijuana", hourCycle: "h23", hour: "2-digit", minute: "2-digit",
});
export function horaHablada(fecha: string): string {
  const [hora = "0", minuto = "00"] = RELOJ24.format(new Date(fecha)).split(":");
  const h = Number(hora);
  return `${h % 12 || 12}:${minuto} ${h < 12 ? "de la mañana" : h < 20 ? "de la tarde" : "de la noche"}`;
}

const NUMEROS = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];

/**
 * El hito redondo mas cercano, o `null` si la cifra no se parece a ninguno.
 *
 * Nadie dice «dos horas con cincuenta y cinco minutos» al aire; dice «casi
 * tres horas». Pero redondear siempre mentiria: 2 h 40 min no es «dos horas y
 * media» ni «tres horas», y ahi la cifra exacta es la unica honesta.
 *
 * La tolerancia no es una sola: 10 minutos para una hora en punto y 5 para la
 * media. Una hora en punto es un hito fuerte —«casi dos horas» por 1 h 50 min
 * es lo que dice cualquiera— y la media es debil: por 2 h 40 min nadie dice
 * «poco mas de dos horas y media», dice los cuarenta minutos.
 */
function hito(minutos: number): number | null {
  if (minutos < 30) return null;
  const cerca = Math.round(minutos / 30) * 30;
  return Math.abs(minutos - cerca) <= (cerca % 60 === 0 ? 10 : 5) ? cerca : null;
}

function nombreHito(hito: number): string | null {
  const horas = Math.floor(hito / 60);
  const media = hito % 60 === 30;
  if (horas === 0) return "media hora";
  const palabra = NUMEROS[horas];
  if (palabra === undefined) return null;
  return `${horas === 1 ? "una hora" : `${palabra} horas`}${media ? " y media" : ""}`;
}

/** La espera como se dice. */
export function duracionHablada(minutos: number): string {
  const cerca = hito(minutos);
  const nombre = cerca === null ? null : nombreHito(cerca);
  if (cerca === null || nombre === null) return duracion(minutos, true);
  if (minutos === cerca) return nombre;
  return minutos < cerca ? `casi ${nombre}` : `poco más de ${nombre}`;
}

/** La espera como se ve en la ficha: la misma aproximacion, con la tilde que
 *  avisa de que lo es. La cifra exacta sigue abajo, en la tarjeta del cruce. */
export function duracionFicha(minutos: number): string {
  const cerca = hito(minutos);
  if (cerca === null || minutos === cerca) return duracion(minutos);
  if (cerca < 60) return `~${cerca} min`;
  const resto = cerca % 60;
  return `~${Math.floor(cerca / 60)} h${resto ? ` ${resto} min` : ""}`;
}

/** El nombre del carril como se rotula en todo el tablero: PedWest es un
 *  acceso aparte de San Ysidro, no una categoria, y sin el prefijo las dos
 *  garitas peatonales se leerian como el mismo carril repetido. */
export function nombreCarril(carril: Carril): string {
  return `${carril.acceso === "PedWest" ? "PedWest · " : ""}${carril.nombre}`;
}

/** Un carril en la ficha, con hueco y todo: lo que NO se reporta tiene que
 *  verse, o el locutor cree que lo que lee es todo lo que hay. */
export interface Renglon {
  nombre: string;
  figura: string;
  hayCifra: boolean;
  /** Solo cuando los carriles de ese modo no comparten hora. */
  hora: string;
}
/** Un modo de cruce: se va en coche o se va a pie, y son dos noticias. */
export interface Modo {
  titulo: string;
  renglones: Renglon[];
  /** El continuo, listo para decirse. Vacio cuando no hay nada que decir. */
  linea: string;
  /** `linea` esta vacia porque las horas no cuadran, no por falta de datos. */
  horasMezcladas: boolean;
  /** Por que no hay linea, cuando NO es por horas mezcladas. Vacio cuando si
   *  hay linea. Un modo sin linea y sin motivo dejaba un hueco mudo en el
   *  bloque: Otay Mesa con su frase al lado y San Ysidro con nada, que es lo
   *  ultimo que se quiere en un apuntador que se lee al aire. */
  sinLinea: string;
}
export interface Cue {
  lugar: string;
  modos: Modo[];
}
export interface Guion {
  /** La ficha de atribucion: «CBP · 11:00 de la manana», o solo «CBP». */
  atribucion: string;
  cues: Cue[];
  cierre: string;
}

/**
 * Los dos modos, y como se nombra cada carril al decirlo.
 *
 * En coche se dice el tipo de carril, que es lo que distingue una espera de
 * otra. A pie lo que distingue es el ACCESO —San Ysidro tiene dos garitas
 * peatonales y son dos filas distintas—, asi que ahi la etiqueta nombra la
 * garita; y cuando solo hay una, no se nombra: «Otay Mesa a pie: 15 minutos»
 * no necesita aclarar por cual.
 *
 * A pie solo se dice el carril general de cada acceso. El Ready Lane peatonal
 * es minoritario y alargaria la frase sin cambiar la noticia; su cifra sigue
 * en la ficha, que es donde se comprueba. En coche se dicen los tres, porque
 * los tres mueven volumen.
 */
const MODOS = [
  {
    titulo: "Vehículos",
    viajero: "vehiculo",
    sujeto: (lugar: string) => lugar,
    seDice: () => true,
    etiqueta: (carril: Carril) =>
      carril.categoria === "general" ? "en carril general" : carril.categoria === "ready" ? "en Ready Lane" : "por SENTRI",
  },
  {
    titulo: "Peatones",
    viajero: "peaton",
    sujeto: (lugar: string) => `${lugar} a pie`,
    seDice: (carril: Carril) => carril.categoria === "general",
    etiqueta: (carril: Carril, solo: boolean) =>
      solo ? "" : carril.acceso === "PedWest" ? "por PedWest" : "por la garita principal",
  },
] as const satisfies readonly {
  titulo: string;
  viajero: Carril["viajero"];
  sujeto: (lugar: string) => string;
  seDice: (carril: Carril) => boolean;
  etiqueta: (carril: Carril, solo: boolean) => string;
}[];

/** El hueco en palabras. Nunca un cero: un cero se lee como «no hay espera». */
function sinCifra(carril: Carril, ahora: number): string {
  if (carril.estado === "cerrado") return "cerrado";
  if (carril.estado === "pendiente") return "actualización pendiente";
  if (carril.estado === "reportado" && !vigente(carril, ahora)) return "reporte vencido";
  return "sin dato";
}

/**
 * Por que este modo no tiene linea. Cuatro situaciones distintas y no una:
 * decir «sin reporte vigente» sobre una ficha que muestra un Ready Lane con
 * cifra seria contradecir en pantalla lo que se acaba de escribir al lado.
 */
function motivoSinLinea(
  carriles: Carril[],
  hayLeibles: boolean,
  ahora: number,
): string {
  if (carriles.length === 0) return "";
  // Hay carriles con reporte vigente, pero esta linea no los nombra: a pie
  // solo se dice el carril general (ver MODOS), asi que un Ready Lane fresco
  // con el general vencido cae aqui.
  if (hayLeibles) return "Solo reportan carriles que esta línea no nombra; sus cifras están abajo.";
  if (carriles.every((c) => c.estado === "cerrado")) return "Todos sus carriles están cerrados.";
  return "Ningún carril tiene un reporte vigente.";
}

function unir(partes: string[]): string {
  const ultima = partes.at(-1);
  if (ultima === undefined) return "";
  return partes.length === 1 ? ultima : `${partes.slice(0, -1).join(", ")} y ${ultima}`;
}

/**
 * El guion que se lee al aire.
 *
 * La version anterior repetia la frase entera por cruce —«Segun CBP, a las
 * 11:00 AM, X reporta N de espera en carriles generales hacia Estados
 * Unidos»— con la atribucion, la hora y el destino duplicados, y solo leia el
 * carril general de vehiculos: la mitad de la garita, la que va a pie, no
 * llegaba al aire.
 *
 * Ahora cada cruce da, por modo, una ficha de un vistazo con TODOS sus
 * carriles —incluidos los que no reportan— y una linea continua con los que
 * si, lista para decirse o para improvisar encima. Cada linea nombra su
 * lugar y su modo porque son alternativas, no una secuencia: el locutor puede
 * leer solo una y tiene que sostenerse sola.
 *
 * La atribucion sube a una etiqueta y vuelve hablada al final, que es donde va
 * en television: el dato primero, la fuente despues.
 *
 * La hora sube a la etiqueta SOLO si TODOS los carriles leibles la comparten.
 * CBP fecha cada carril por separado, y una etiqueta que anunciara una hora
 * valida para unos y no para otros seria una atribucion falsa dicha al aire.
 * Si los carriles de un modo no comparten hora entre ellos, ese modo se queda
 * sin linea: la ficha las muestra una por una y no hay forma de decir esa
 * mezcla en una frase sin mentir en alguna parte.
 */
export function guion(cruces: Cruce[], ahora: number): Guion {
  const armados = cruces.map((cruce) => ({
    cruce,
    modos: MODOS.map((modo) => {
      const carriles = cruce.carriles.filter(
        (c) =>
          c.viajero === modo.viajero &&
          // Otay publica un Ready Lane peatonal que repite al general con la
          // misma cifra; contarlo seria leer la misma fila dos veces.
          !(cruce.id === "otay_mesa" && c.viajero === "peaton" && c.categoria === "ready"),
      );
      const leibles = carriles.flatMap((carril) =>
        carril.estado === "reportado" && carril.minutos !== null && carril.observado !== null && vigente(carril, ahora)
          ? [{ carril, minutos: carril.minutos, hora: horaHablada(carril.observado) }]
          : [],
      );
      const [primero] = leibles;
      const hora = primero && leibles.every((l) => l.hora === primero.hora) ? primero.hora : null;
      return { modo, carriles, leibles, hora };
    }),
  }));

  const todas = armados.flatMap((a) => a.modos).flatMap((m) => m.leibles);
  const [inicial] = todas;
  const horaComun = inicial && todas.every((l) => l.hora === inicial.hora) ? inicial.hora : null;

  return {
    atribucion: horaComun ? `CBP · ${horaComun}` : "CBP",
    cierre: todas.length > 0 ? "Cifras de CBP." : "",
    cues: armados.map(({ cruce, modos }) => ({
      lugar: cruce.nombre,
      modos: modos.map(({ modo, carriles, leibles, hora }) => {
        const dichos = leibles.filter((l) => modo.seDice(l.carril));
        const horasMezcladas = leibles.length > 0 && horaComun === null && hora === null;
        return {
          titulo: modo.titulo,
          horasMezcladas,
          renglones: carriles.map((carril) => {
            const leible = leibles.find((l) => l.carril === carril);
            return {
              nombre: nombreCarril(carril),
              figura: leible ? duracionFicha(leible.minutos) : sinCifra(carril, ahora),
              hayCifra: leible !== undefined,
              hora: horasMezcladas && leible ? leible.hora : "",
            };
          }),
          linea:
            dichos.length === 0 || horasMezcladas
              ? ""
              : `${modo.sujeto(cruce.nombre)}${horaComun === null ? `, a las ${hora}` : ""}: ${unir(
                  dichos.map((l) => `${duracionHablada(l.minutos)} ${modo.etiqueta(l.carril, dichos.length === 1)}`.trim()),
                )}.`,
          sinLinea:
            dichos.length > 0 || horasMezcladas
              ? ""
              : motivoSinLinea(carriles, leibles.length > 0, ahora),
        };
      }),
    })),
  };
}
