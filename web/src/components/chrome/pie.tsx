/**
 * El pie. Es el componente mas importante del tablero que no muestra un dato.
 *
 * Todo esto viaja como HTML de servidor, no como cadenas dentro de un bundle
 * de JavaScript. Esta prosa ES la integridad del producto y tiene que
 * renderizar aunque el bundle nunca llegue.
 */
export function Pie() {
  return (
    <footer className="mx-auto w-full max-w-[88rem] border-t border-filo px-4 py-16 md:px-8 md:py-24">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="max-w-[65ch] space-y-4 text-sm leading-relaxed text-tinta-prosa">
          <p>
            Esta página mide <strong className="text-tinta-titulo">volumen de prensa</strong> y
            de conversación, no opinión pública. Un titular es una decisión
            editorial de un medio; un comentario es de quien decidió comentar.
            Ninguno de los dos es una muestra de la población.
          </p>
          <p>
            La única medición de percepción con muestra probabilística es la ENSU
            del INEGI, y solo cubre Tijuana y Mexicali. Para Ensenada, Tecate,
            Rosarito, San Quintín y San Felipe no hay medición, y no se infiere
            de las otras.
          </p>
          <p>
            Con volumen bajo se muestran <strong className="text-tinta-titulo">conteos, no
            porcentajes</strong>. Con seis notas al día un porcentaje se mueve con
            dos comentarios.
          </p>
        </div>

        <div className="max-w-[65ch] space-y-4 text-sm leading-relaxed text-tinta-prosa">
          <p>
            Los temas salen de contar repeticiones de frases en los titulares, sin
            modelo. Funcionan para lo que está claramente arriba y mal para lo
            sutil. Un tema sostenido por un solo medio se rotula como tal, porque
            es la agenda de ese medio.
          </p>
          <p>
            El <strong className="text-tinta-titulo">tono</strong> de titulares y el{" "}
            <strong className="text-tinta-titulo">sentimiento</strong> de comentarios los
            asigna un modelo local entrenado en texto de redes sociales. Mide si
            una frase suena a queja, a celebración o a información; no mide la
            postura hacia una persona, y por eso nunca se cruza con las figuras
            públicas. Cuando el paso está apagado, la banda de estado lo dice.
          </p>
          <p>
            Ninguna cifra de los indicadores la calcula este tablero: se leen de la
            fuente oficial y se etiquetan con su cadencia y su salvedad. La
            cobertura es desigual por zona y eso es estructural, no un problema de
            presupuesto.
          </p>
        </div>
      </div>

      <p className="mt-14 text-2xs text-tinta-meta">
        Agregación en formato titular, fuente y enlace. Nunca se republica el
        cuerpo de una nota ni el texto de un comentario.
      </p>
    </footer>
  );
}
