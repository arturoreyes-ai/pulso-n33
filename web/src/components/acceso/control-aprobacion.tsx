"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ControlAprobacion({ id, nombre, aprobado }: { id: number; nombre: string; aprobado: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState("");
  function cambiar() {
    setMensaje("");
    iniciar(async () => {
      try {
        const respuesta = await fetch(`/api/admin/usuarios/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aprobado: !aprobado }),
        });
        if (!respuesta.ok) {
          setMensaje("No se pudo cambiar el acceso. Actualiza la página e intenta de nuevo.");
          return;
        }
        setMensaje(aprobado ? "Acceso revocado." : "Acceso aprobado.");
        router.refresh();
      } catch {
        setMensaje("No se pudo conectar. Intenta de nuevo.");
      }
    });
  }
  return (
    <div className="w-full md:max-w-40">
      <button type="button" disabled={pendiente} onClick={cambiar}
        aria-label={`${aprobado ? "Revocar acceso de" : "Aprobar acceso de"} ${nombre}`}
        className={`min-h-11 w-full rounded-full px-4 py-2.5 text-cuerpo font-medium transition-[background-color,color,transform] motion-reduce:transition-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${aprobado ? "border border-filo text-tinta-prosa hover:bg-filo hover:text-tinta-titulo" : "bg-tinta-titulo text-vanta hover:bg-white"}`}>
        {pendiente ? "Guardando…" : aprobado ? "Revocar acceso" : "Aprobar acceso"}
      </button>
      <p role="status" className={mensaje ? "mt-2 text-meta text-tinta-meta" : "sr-only"}>{mensaje}</p>
    </div>
  );
}
