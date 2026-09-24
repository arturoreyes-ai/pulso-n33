/** Version en la URL: separa en el CDN la respuesta anterior de esta ficha. */
export const VERSION_ANALISIS = "4";

export interface SugerenciaSocial {
  formato: string;
  enfoque: string;
  gancho: string;
}

export interface LecturaAnalisis {
  lectura: string;
  puntos: string[];
  salvedad: string;
  sugerenciaSocial: SugerenciaSocial;
}

export interface Analisis extends LecturaAnalisis {
  medio: string;
}
