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
  /** La cifra es de hace menos de 90 minutos, o sea que se puede decir al
   *  aire. Una cifra con `false` sigue siendo una cifra real de CBP: se
   *  muestra, con su hora, y se queda fuera de la frase. */
  alDia: boolean;
  /** Solo cuando los carriles de ese modo no comparten hora. */
  hora: string;
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
  /** La ficha de atribucion: «CBP · 11:00 de la manana», o solo «CBP». */
  atribucion: string;
  cues: Cue[];
  /** Hay alguna cifra en pantalla, aunque ninguna se pueda decir. Es lo que
   *  decide si el bloque se dibuja; `cierre` decide otra cosa. */
  hayCifras: boolean;
  /** El cierre hablado. Vacio cuando no hay ninguna frase que atribuir: la
   *  etiqueta ya atribuye lo que se ve, y esto cierra lo que se dice. */
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
 * Tuvo una rama «reporte vencido» para el carril que CBP reporto hace mas de
 * 90 minutos, y borraba la cifra. Estaba mal dos veces: leia como «no hay
 * dato» cuando si lo hay —PedWest publicaba 55 minutos a las 7:00 y la ficha
 * decia «reporte vencido»— y, al sonar a que lo viejo era lo nuestro, invitaba
 * a pulsar Actualizar, que vuelve a traer las mismas 7:00 porque es la hora a
 * la que CBP actualizo PedWest. La regla de los 90 minutos es de PRODUCT.md y
 * es sobre lo que se DICE al aire, no sobre lo que se muestra.
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
function motivoSinLinea(carriles: Carril[], ultima: string): string {
  if (carriles.length === 0) return "";
  if (carriles.every((c) => c.estado === "cerrado")) return "Todos sus carriles están cerrados.";
  // Hay cifras, pero ninguna de la ultima hora y media: se muestran arriba y
  // no se dicen. Decir desde cuando es lo unico que hace entendible por que.
  if (ultima) return `Sin actualizar desde las ${ultima}; sus cifras están arriba.`;
  return "CBP no publica un reporte para sus carriles.";
}

function unir(partes: string[]): string {
  const ultima = partes.at(-1);
  if (ultima === undefined) return "";
  return partes.length === 1 ? ultima : `${partes.slice(0, -1).join(", ")} y ${ultima}`;
}

interface Leible {
  carril: Carril;
  minutos: number;
  hora: string;
  alDia: boolean;
}

/**
 * La frase de un modo, diciendo una sola vez lo que se repite.
 *
 * Dos carriles con la misma espera y la misma hora se dicen juntos —«casi dos
 * horas en carril general y en Ready Lane»—, y las clausulas que comparten
 * hora la dicen una vez al final en lugar de arrastrarla cada una. Sin esto,
 * los cuatro carriles peatonales de San Ysidro salian con «a las 8:00 de la
 * manana» dos veces y «a las 7:00» otras dos, en una frase de cuarenta y
 * cinco palabras.
 *
 * Las clausulas se separan con punto y coma en cuanto una lleva «y» dentro:
 * «…y en Ready Lane y media hora por SENTRI» no deja oir donde acaba una cifra
 * y empieza la siguiente.
 */
function frase(
  sujeto: string,
  leibles: Leible[],
  etiquetar: (carril: Carril, solo: boolean) => string,
  horaAlFrente: string,
  porCifra: boolean,
): string {
  const solo = leibles.length === 1;
  const clausulas: { espera: string; etiquetas: string[]; hora: string }[] = [];
  for (const l of leibles) {
    const espera = duracionHablada(l.minutos);
    const previa = clausulas.at(-1);
    if (previa && previa.espera === espera && previa.hora === l.hora) {
      previa.etiquetas.push(etiquetar(l.carril, solo));
    } else {
      clausulas.push({ espera, etiquetas: [etiquetar(l.carril, solo)], hora: l.hora });
    }
  }

  const grupos: { textos: string[]; hora: string; compuesta: boolean }[] = [];
  for (const c of clausulas) {
    const texto = [c.espera, unir(c.etiquetas.filter(Boolean))].filter(Boolean).join(" ");
    const previo = grupos.at(-1);
    if (previo && previo.hora === c.hora) {
      previo.textos.push(texto);
      previo.compuesta = previo.compuesta || c.etiquetas.length > 1;
    } else {
      grupos.push({ textos: [texto], hora: c.hora, compuesta: c.etiquetas.length > 1 });
    }
  }

  const dichos = grupos.map((g) => {
    const cuerpo = g.compuesta ? g.textos.join("; ") : unir(g.textos);
    return porCifra ? `${cuerpo}, a las ${g.hora}` : cuerpo;
  });
  return `${sujeto}${horaAlFrente ? `, a las ${horaAlFrente}` : ""}: ${dichos.join("; ")}.`;
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
 * La hora se dice UNA vez cuando se puede y una por cifra cuando no. CBP fecha
 * cada carril por separado, asi que una sola hora al frente de la frase seria
 * una atribucion falsa en cuanto dos carriles no la compartan. Tres niveles,
 * del mas barato al mas caro: si coinciden TODOS los carriles de todos los
 * cruces, la hora vive en la etiqueta y ninguna frase la repite; si coinciden
 * los de una frase, va delante de esa frase; y si no, cada cifra lleva la suya
 * —«40 minutos por la garita principal a las 8:00 de la manana y casi una hora
 * por PedWest a las 7:00 de la manana»—.
 *
 * Esa tercera rama callaba la frase entera, y estaba mal: el locutor tiene que
 * dar esos minutos igual, y callarlos no le quita el problema, lo deja sin
 * texto delante de la camara. Repetir la hora cuesta unas palabras y no miente
 * en ninguna.
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
      // Dos conjuntos distintos, y confundirlos fue el error: TENER cifra es
      // una cosa y poder DECIRLA al aire es otra. La ficha muestra las que hay;
      // la frase dice solo las de la ultima hora y media (regla de PRODUCT.md).
      const conCifra = carriles.flatMap((carril) =>
        carril.estado === "reportado" && carril.minutos !== null && carril.observado !== null
          ? [{
              carril,
              minutos: carril.minutos,
              hora: horaHablada(carril.observado),
              alDia: vigente(carril, ahora),
            }]
          : [],
      );
      const leibles = conCifra.filter((l) => l.alDia);
      const [primero] = conCifra;
      const hora = primero && conCifra.every((l) => l.hora === primero.hora) ? primero.hora : null;
      const [primeroDicho] = leibles;
      const horaDicha =
        primeroDicho && leibles.every((l) => l.hora === primeroDicho.hora) ? primeroDicho.hora : null;
      // La mas reciente de las que hay, para poder decir desde cuando no se
      // actualiza cuando ninguna llega al aire.
      const ultima = conCifra.reduce<Leible | null>(
        (mayor, l) =>
          mayor === null || Date.parse(l.carril.observado ?? "") > Date.parse(mayor.carril.observado ?? "") ? l : mayor,
        null,
      );
      return { modo, carriles, conCifra, leibles, hora, horaDicha, ultima };
    }),
  }));

  // La etiqueta tiene que describir lo que hay EN PANTALLA, no solo lo que se
  // dice: con PedWest a las 7:00 en la ficha, un «CBP · 8:00» seria falso.
  const todas = armados.flatMap((a) => a.modos).flatMap((m) => m.conCifra);
  const [inicial] = todas;
  const horaComun = inicial && todas.every((l) => l.hora === inicial.hora) ? inicial.hora : null;

  return {
    atribucion: horaComun ? `CBP · ${horaComun}` : "CBP",
    hayCifras: todas.length > 0,
    cierre: todas.some((l) => l.alDia) ? "Cifras de CBP." : "",
    cues: armados.map(({ cruce, modos }) => ({
      lugar: cruce.nombre,
      modos: modos.map(({ modo, carriles, conCifra, leibles, hora, horaDicha, ultima }) => {
        // Cuando los carriles del modo no coinciden, la hora baja a cada cifra:
        // en la frase y, para los que ni siquiera tienen cifra, en la ficha.
        const porCifra = horaComun === null && hora === null;
        return {
          titulo: modo.titulo,
          renglones: carriles.map((carril) => {
            const cifra = conCifra.find((l) => l.carril === carril);
            return {
              nombre: nombreCarril(carril),
              figura: cifra ? duracionFicha(cifra.minutos) : sinCifra(carril),
              hayCifra: cifra !== undefined,
              alDia: cifra?.alDia ?? false,
              // Una cifra que no se dice SIEMPRE lleva hora: es lo unico que
              // explica por que no esta en la frase de arriba.
              hora: cifra && (porCifra || !cifra.alDia) ? cifra.hora : "",
            };
          }),
          linea:
            leibles.length === 0
              ? ""
              : frase(
                  modo.sujeto(cruce.nombre),
                  leibles,
                  modo.etiqueta,
                  horaComun === null && horaDicha !== null ? horaDicha : "",
                  horaComun === null && horaDicha === null,
                ),
          sinLinea: leibles.length > 0 ? "" : motivoSinLinea(carriles, ultima ? ultima.hora : ""),
        };
      }),
    })),
  };
}
