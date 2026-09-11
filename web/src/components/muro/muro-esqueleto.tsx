/**
 * El muro mientras carga.
 *
 * Existe porque el muro pasó a ser lo primero de la pagina. Antes era un solo
 * bloque de 600px y daba igual: nadie lo veia sin haber scrolleado cuatro
 * secciones. Ahora es lo primero que se pinta en una visita en frio, y un
 * rectangulo pulsando seguido de un salto de layout es la primera impresion.
 *
 * Asi que la cascara es REAL -- la barra de filtros con sus proporciones
 * verdaderas -- y solo las filas son fantasmas, al alto exacto de una fila
 * (104px, la misma cuenta de nota-fila.tsx). Lo que se mueve al llegar los
 * datos es el contenido de las filas, no la pagina.
 *
 * Componente de servidor: no tiene estado ni escucha nada.
 *
 * `conZona` cuenta las pastillas: la barra real lleva el alcance (tres
 * peldanos en el indice, cuatro en la pagina de una zona) mas los dos de
 * orden, y la cascara tiene que medir lo mismo o la fila salta al llegar.
 */

const FILAS = [0, 1, 2, 3, 4, 5, 6, 7];

// Anchos que no se repiten, para que no se lea como una tabla.
const ANCHOS = ["w-11/12", "w-3/4", "w-10/12", "w-2/3", "w-5/6", "w-3/5", "w-11/12", "w-7/12"];

const PASTILLAS_INDICE = [0, 1, 2, 3, 4];
const PASTILLAS_ZONA = [0, 1, 2, 3, 4, 5];

export function MuroEsqueleto({ conZona = false }: { conZona?: boolean }) {
  const pastillas = conZona ? PASTILLAS_ZONA : PASTILLAS_INDICE;
  return (
    <div aria-hidden className="animate-pulse">
      <div className="-mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-vela px-4 py-3 md:-mx-8 md:px-8">
        <div className="h-9 w-56 rounded-full bg-vela md:w-72" />
        {pastillas.map((i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-vela" />
        ))}
        <div className="ml-auto h-4 w-32 rounded-etiqueta bg-vela" />
      </div>

      {FILAS.map((i) => (
        <div
          key={i}
          className="grid h-[104px] grid-cols-[4rem_1fr] gap-4 border-b border-vela py-3.5"
        >
          <div className="h-4 w-10 rounded-etiqueta bg-vela" />
          <div>
            <div className={`h-5 rounded-etiqueta bg-vela ${ANCHOS[i] ?? "w-3/4"}`} />
            <div className="mt-3 h-3 w-28 rounded-etiqueta bg-vela" />
          </div>
        </div>
      ))}
    </div>
  );
}
