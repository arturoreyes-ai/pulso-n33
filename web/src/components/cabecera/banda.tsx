"use client";

import { useEstado } from "@/lib/datos/hooks";
import { numero } from "@/lib/dominio/formato";

/**
 * La banda de estado. Dice honestamente que esta mirando el lector.
 *
 * Los tres mensajes vienen del tablero anterior casi textuales, porque son la
 * honestidad del producto sobre su propio estado: sin datos, corrida de
 * prueba, o ingesta real.
 */
export function Banda() {
  const { data: estado, error } = useEstado();

  if (error !== undefined || estado === undefined) {
    return (
      <p
        role="status"
        className="border-l-2 border-baja bg-vela px-4 py-3 text-meta text-tinta-prosa"
      >
        <b className="font-semibold text-baja">Sin datos.</b> No se pudo leer
        estado.json. Corre <code className="text-tinta-titulo">python -m pulso correr</code> y
        vuelve a cargar.
      </p>
    );
  }

  if (estado.modo === "corpus") {
    return (
      <p
        role="status"
        className="border-l-2 border-aviso bg-vela px-4 py-3 text-meta text-tinta-prosa"
      >
        <b className="font-semibold text-aviso">Corrida sin red.</b> Estas notas
        vienen del corpus de prueba, no de los feeds. Sirven para verificar el
        pipeline; no son un corte de prensa.
      </p>
    );
  }

  const roto = estado.fuentes_ok === 0;
  const partes: string[] = [
    `${estado.fuentes_ok} de ${estado.fuentes_ok + estado.fuentes_fallo} fuentes respondieron`,
  ];
  if (estado.notas_nuevas > 0) {
    partes.push(`${numero(estado.notas_nuevas)} notas nuevas en este corte`);
  }
  const descartadas = estado.por_alcance.fuera ?? 0;
  if (descartadas > 0) {
    partes.push(`${numero(descartadas)} de fuera de la región descartadas`);
  }
  if (estado.metodo_postura === "modelo") {
    partes.push("tono de titulares por modelo local");
  } else if (estado.metodo_postura === "diccionario") {
    partes.push("tono por diccionario, no publicable");
  } else {
    partes.push("sin clasificación de tono");
  }

  return (
    <p
      role="status"
      className={`border-l-2 bg-vela px-4 py-3 text-meta text-tinta-prosa ${
        roto ? "border-baja" : "border-sube"
      }`}
    >
      <b className={`font-semibold ${roto ? "text-baja" : "text-sube"}`}>
        {roto ? "Ninguna fuente respondió." : "Ingesta automática."}
      </b>{" "}
      {partes.join("; ")}.
      {estado.corrida === null ? null : (
        <>
          {" "}
          <a
            href={estado.corrida}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tinta-titulo underline decoration-tinta-inerte underline-offset-2 hover:decoration-tinta-prosa"
          >
            ver la corrida
          </a>
        </>
      )}
    </p>
  );
}
