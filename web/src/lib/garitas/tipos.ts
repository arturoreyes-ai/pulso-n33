export type EstadoCarril = "reportado" | "cerrado" | "pendiente" | "no_disponible";
export interface Carril {
  categoria: "general" | "ready" | "sentri";
  nombre: string;
  viajero: "vehiculo" | "peaton";
  acceso: string;
  minutos: number | null;
  abiertos: number | null;
  estado: EstadoCarril;
  observado: string | null;
}
export interface Cruce {
  id: string;
  nombre: string;
  direccion: "norte";
  carriles: Carril[];
}
export interface RespuestaGaritas {
  consultado: string;
  fuente: string;
  cruces: Cruce[];
}
