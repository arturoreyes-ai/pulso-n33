import { EncabezadoSeccion } from "@/components/cabecera/encabezado";
import { Seccion } from "@/components/chrome/seccion";
import { PanelCobertura } from "@/components/paneles/cobertura";
import { tituloSeccion } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * COBERTURA: de que puede hablar este tablero y de que no.
 *
 * Era la ultima seccion de la pagina unica, o sea la que casi nadie veia, y
 * es la que sostiene todo lo demas: la cobertura es desigual por zona y eso
 * es estructural. Como pagina propia se puede enlazar, que es lo que hace
 * falta cuando alguien pregunta por que San Quintin sale en cero.
 */
export function PaginaCobertura({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <>
      <EncabezadoSeccion
        zona={zona}
        vista="cobertura"
        titulo={tituloSeccion("cobertura", nombre)}
        entrada={
          nombre === null
            ? "Qué mide este tablero, con qué fuentes y con qué huecos. La cobertura es desigual por zona y eso es estructural: los huecos se rotulan en vez de rellenarse con ceros."
            : `Qué se cubre de ${nombre} y qué no. Un hueco se rotula como hueco; un cero aquí significaría que no pasa nada, y lo que significa es que no lo medimos.`
        }
      />

      <Seccion id="cobertura">
        <PanelCobertura zona={zona} />
      </Seccion>
    </>
  );
}
