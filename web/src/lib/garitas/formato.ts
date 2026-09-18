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
  /** La cifra es de hace menos de 90 minutos. Una cifra con `false` sigue
   *  siendo real: se muestra y el detalle conserva su hora de reporte. */
  alDia: boolean;
}
/** Un modo de cruce: se va en coche o se va a pie, y son dos noticias. */
export interface Modo {
  titulo: string;
  renglones: Renglon[];
  /** El continuo, listo para decirse. Vacio solo si no hay ninguna cifra que
   *  esta linea nombre; nunca por como estan fechadas. */
  linea: string;
  /** Por que no hay linea. Vacio cuando si hay linea. Un modo sin linea y sin motivo dejaba un hueco mudo en el
   *  bloque: Otay Mesa con su frase al lado y San Ysidro con nada, que es lo
   *  ultimo que se quiere en un apuntador que se lee al aire. */
  sinLinea: string;
}
export interface Cue {
  lugar: string;
  modos: Modo[];
}
export interface Guion {
  /** La fuente que respalda la ficha; el detalle vive en las horas de cada linea. */
  atribucion: string;
  cues: Cue[];
  /** Hay alguna cifra en pantalla y disponible para la ficha hablada. */
  hayCifras: boolean;
  /** Se conserva en el contrato por compatibilidad; la fuente ya vive en la pagina. */
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
 * Se dicen TODOS los carriles de cada modo. A pie se dijeron un tiempo solo
 * los generales, por no alargar la frase; era la ficha decidiendo por el
 * locutor, que tiene que dar esos minutos igual. El Ready Lane peatonal de
 * PedWest lleva su acceso en la etiqueta porque si no se confunde con el de la
 * garita principal, que es otra fila.
 */
const MODOS = [
  {
    titulo: "Vehículos",
    viajero: "vehiculo",
    sujeto: (lugar: string) => lugar,
    etiqueta: (carril: Carril) =>
      carril.categoria === "general" ? "en carril general" : carril.categoria === "ready" ? "en Ready Lane" : "por SENTRI",
  },
  {
    titulo: "Peatones",
    viajero: "peaton",
    sujeto: (lugar: string) => `${lugar} a pie`,
    etiqueta: (carril: Carril, solo: boolean) =>
      solo
        ? ""
        : carril.categoria === "ready"
          ? carril.acceso === "PedWest"
            ? "en Ready Lane de PedWest"
            : "en Ready Lane"
          : carril.acceso === "PedWest"
            ? "por PedWest"
            : "por la garita principal",
  },
] as const satisfies readonly {
  titulo: string;
  viajero: Carril["viajero"];
  sujeto: (lugar: string) => string;
  etiqueta: (carril: Carril, solo: boolean) => string;
}[];

/**
 * El hueco en palabras. Nunca un cero: un cero se lee como «no hay espera».
 *
 * Una espera reportada conserva su cifra y su hora aunque tenga mas de 90
 * minutos; la cabecera muestra la actualizacion mas reciente del conjunto.
 */
function sinCifra(carril: Carril): string {
  if (carril.estado === "cerrado") return "cerrado";
  if (carril.estado === "pendiente") return "actualización pendiente";
  return "sin dato";
}

/**
 * Por que este modo no tiene linea. Situaciones distintas y no una: decir «sin
 * reporte» sobre una ficha que muestra cifras al lado seria contradecirse en
 * pantalla.
 *
 * Tuvo una cuarta rama, «solo reportan carriles que esta linea no nombra»,
 * para cuando a pie se decia unicamente el general. Ahora se dicen todos, asi
 * que un carril con cifra siempre llega a la frase y esa rama no puede darse.
 */
function motivoSinLinea(carriles: Carril[]): string {
  if (carriles.length === 0) return "";
  if (carriles.every((c) => c.estado === "cerrado")) return "Todos sus carriles están cerrados.";
  if (carriles.some((c) => c.estado === "pendiente")) return "Actualización pendiente.";
  return "No hay un tiempo disponible para estos carriles.";
}

function unir(partes: string[]): string {
  const ultima = partes.at(-1);
  if (ultima === undefined) return "";
  return partes.length === 1 ? ultima : `${partes.slice(0, -1).join(", ")} y ${ultima}`;
}

interface Leible {
  carril: Carril;
  minutos: number;
  alDia: boolean;
}

/**
 * La frase de un modo, diciendo una sola vez lo que se repite.
 *
 * La hora no se mezcla con la locucion: se muestra una sola vez arriba como
 * «Actualización más reciente» y cada tarjeta detallada conserva su reporte.
 * Dos carriles con la misma espera se dicen juntos —«casi dos horas en carril
 * general y en Ready Lane»—, sin hacer que el locutor confunda la hora del
 * reporte con el tiempo que tarda el cruce.
 *
 * Las clausulas se separan con punto y coma en cuanto una lleva «y» dentro:
 * «…y en Ready Lane y media hora por SENTRI» no deja oir donde acaba una cifra
 * y empieza la siguiente.
 */
function frase(
  sujeto: string,
  leibles: Leible[],
  etiquetar: (carril: Carril, solo: boolean) => string,
): string {
  const solo = leibles.length === 1;
  const clausulas: { espera: string; etiquetas: string[] }[] = [];
  for (const l of leibles) {
    const espera = duracionHablada(l.minutos);
    const previa = clausulas.at(-1);
    if (previa && previa.espera === espera) {
      previa.etiquetas.push(etiquetar(l.carril, solo));
    } else {
      clausulas.push({ espera, etiquetas: [etiquetar(l.carril, solo)] });
    }
  }

  const dichos = clausulas.map((c) =>
    [c.espera, unir(c.etiquetas.filter(Boolean))].filter(Boolean).join(" "),
  );
  return `${sujeto}: ${dichos.join("; ")}.`;
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
 * La hora del reporte ya no entra en la frase: el apuntador solo dice el tiempo
 * que tarda el cruce. La pagina muestra la actualizacion mas reciente una vez
 * en la cabecera y conserva la hora individual en cada tarjeta para quien
 * necesite revisar el origen del dato.
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
      // La cifra visible y la cifra hablada son el mismo conjunto. La hora de
      // cada carril se conserva para el detalle, no para el apuntador.
      const conCifra = carriles.flatMap((carril) =>
        carril.estado === "reportado" && carril.minutos !== null && carril.observado !== null
          ? [{
              carril,
              minutos: carril.minutos,
              alDia: vigente(carril, ahora),
            }]
          : [],
      );
      const leibles = conCifra;
      return { modo, carriles, conCifra, leibles };
    }),
  }));

  // Todas las cifras se mantienen aunque un reporte ya no este fresco: la
  // etiqueta de actualizacion vive en la pagina y no borra una espera real.
  const todas = armados.flatMap((a) => a.modos).flatMap((m) => m.conCifra);

  return {
    atribucion: "Fuente oficial",
    hayCifras: todas.length > 0,
    cierre: "",
    cues: armados.map(({ cruce, modos }) => ({
      lugar: cruce.nombre,
      modos: modos.map(({ modo, carriles, conCifra, leibles }) => {
        return {
          titulo: modo.titulo,
          renglones: carriles.map((carril) => {
            const cifra = conCifra.find((l) => l.carril === carril);
            return {
              nombre: nombreCarril(carril),
              figura: cifra ? duracionFicha(cifra.minutos) : sinCifra(carril),
              hayCifra: cifra !== undefined,
              alDia: cifra?.alDia ?? false,
            };
          }),
          linea:
            leibles.length === 0
              ? ""
              : frase(
                  modo.sujeto(cruce.nombre),
                  leibles,
                  modo.etiqueta,
                ),
          sinLinea: leibles.length > 0 ? "" : motivoSinLinea(carriles),
        };
      }),
    })),
  };
}
