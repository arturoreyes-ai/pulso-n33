"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import type { Carril, RespuestaGaritas } from "@/lib/garitas/tipos";
import { duracion, fechaLocal, horaLocal, resumen, vigente } from "@/lib/garitas/formato";
import estilos from "./garitas.module.css";

async function consultar(ruta: string): Promise<RespuestaGaritas> {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error("CBP no disponible");
  return respuesta.json();
}
function Fila({ carril, escala, ahora }: { carril: Carril; escala: number; ahora: number }) {
  const actual = vigente(carril, ahora);
  const medido = carril.estado === "reportado" && carril.minutos !== null;
  const estado = carril.estado === "cerrado" ? "Cerrado" : carril.estado === "pendiente" ? "Actualización pendiente" : "Sin dato";
  return <div className={estilos.fila}>
    <div className={estilos.filaTitulo}><span>{carril.acceso === "PedWest" ? "PedWest · " : ""}{carril.nombre}</span><span className={medido ? estilos.numero : estilos.sinDato} aria-label={medido ? duracion(carril.minutos!, true) : undefined}>{medido ? duracion(carril.minutos!).split(" ").map((parte, indice) => /^\d+$/.test(parte) ? <span key={indice}>{parte}</span> : <small key={indice}>{parte}</small>) : estado}</span></div>
    <div className={estilos.pista} aria-hidden="true">{medido && <div className={actual ? estilos.barra : estilos.barraAntigua} style={{ width: `${carril.minutos! / escala * 100}%` }} />}</div>
    <div className={estilos.detalle}><span>{carril.abiertos === null ? "Carriles abiertos: sin dato" : carril.abiertos === 1 ? "1 carril abierto" : `${carril.abiertos} carriles abiertos`}</span><span>{carril.observado ? `Reporte: ${fechaLocal(carril.observado)}` : "Sin hora de reporte"}</span></div>
    {carril.estado === "no_disponible" && <p className={estilos.detalle}>CBP no publica un reporte para este carril.</p>}
    {medido && !carril.observado && <p className={estilos.antiguo}>Vigencia desconocida · excluido del resumen</p>}
  </div>;
}
export function TableroGaritas() {
  // Una consulta al entrar; despues solo el boton. Foco, reconexion y error no consultan.
  const { data: datos, error, isValidating: consultando, mutate: actualizar } = useSWR<RespuestaGaritas>("/api/garitas", consultar, {
    refreshInterval: 0, revalidateOnMount: true, revalidateIfStale: false,
    revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false,
    keepPreviousData: true,
  });
  const [ahora, fijarAhora] = useState(0);
  const [confirmacion, fijarConfirmacion] = useState("");
  async function actualizarManual() {
    fijarConfirmacion("");
    try {
      const resultado = await actualizar();
      if (!resultado) return;
      const hora = horaLocal(new Date().toISOString());
      fijarConfirmacion(`Consulta completada a las ${hora}. Revisa la hora de reporte de cada carril; CBP puede mantener las mismas cifras.`);
    } catch {
      fijarConfirmacion("No se pudo actualizar. Intenta de nuevo; conservamos el último reporte recibido.");
    }
  }
  useEffect(() => { fijarAhora(Date.now()); const reloj = setInterval(() => fijarAhora(Date.now()), 15_000); return () => clearInterval(reloj); }, []);
  const escala = Math.max(180, ...((datos?.cruces ?? []).flatMap((cruce) => cruce.carriles.map((c) => Math.ceil((c.minutos ?? 0) / 30) * 30))));
  const lectura = datos && ahora ? resumen(datos.cruces, ahora) : "";
  return <div className={estilos.pagina}>
    <nav className={estilos.navegacion} aria-label="Navegación principal"><Link href="/">← Pulso N33</Link><span aria-current="page">Garitas</span></nav>
    <header className={estilos.cabecera}>
      <div className={estilos.titulo}><h1>El pulso de las garitas</h1><button onClick={() => void actualizarManual()} disabled={consultando} aria-busy={consultando}>{consultando ? "Consultando…" : "Actualizar"}</button></div>
      <p>San Ysidro y Otay Mesa. Esperas reportadas por CBP para vehículos y peatones.</p>
      <div className={estilos.metadatos}><span>Hora local de Tijuana</span><span>Consulta al entrar · después, actualización manual</span><a href="https://bwt.cbp.gov/" target="_blank" rel="noreferrer">Fuente: CBP ↗</a></div>
      <p role="status" className={estilos.confirmacion}>{consultando ? "Consultando el último reporte disponible…" : confirmacion}</p>
    </header>
    {error && <p role="alert" className={estilos.alerta}>{datos ? "Falló la actualización. Se conserva el último reporte recibido; comprueba la hora de cada carril." : "No fue posible consultar CBP. Los tiempos no están disponibles. Puedes reintentar con Actualizar."}</p>}
    {!datos && !error && <p className={estilos.espera}>{consultando ? "Consultando los reportes de CBP…" : "Pulsa Actualizar para consultar los tiempos de cruce."}</p>}
    {datos && <><section className={estilos.lectura} aria-labelledby="lectura-titulo"><h2 id="lectura-titulo">Para leer al aire <span>VEHÍCULOS · GENERAL</span></h2><p>{error ? "Actualización interrumpida. Verifica los reportes antes de leer cifras al aire." : lectura || "No hay reportes vigentes con hora verificable para los carriles generales. Consulta el detalle de cada cruce."}</p></section>
      <div className={estilos.leyenda}><span>Las barras representan tiempo de espera, no longitud de la fila.</span><span>Escala compartida: 0–{duracion(escala)}</span></div>
      <div className={estilos.cruces}>{datos.cruces.map((cruce) => <section key={cruce.id} className={estilos.cruce} aria-labelledby={cruce.id}><header><h2 id={cruce.id}>{cruce.nombre}</h2><p>Hacia Estados Unidos</p></header>
        {(["vehiculo", "peaton"] as const).map((viajero) => <div key={viajero} className={estilos.grupo}><h3>{viajero === "vehiculo" ? "Vehículos" : "Peatones"}</h3>{cruce.carriles.filter((c) => c.viajero === viajero && !(cruce.id === "otay_mesa" && c.viajero === "peaton" && c.categoria === "ready")).map((c) => <Fila key={`${c.acceso}-${c.categoria}`} carril={c} escala={escala} ahora={ahora} />)}</div>)}
      </section>)}</div>
      <footer className={estilos.pie}>Consulta a CBP: {fechaLocal(datos.consultado)}. Cada carril conserva su propia hora de reporte. Los reportes de más de 90 minutos se excluyen del resumen para locución. Las estimaciones no garantizan el tiempo de cruce.</footer>
    </>}
  </div>;
}
