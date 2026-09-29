import { notFound } from "next/navigation";
import { CheckCircle, Clock, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Navegacion } from "@/components/chrome/navegacion";
import { ControlAprobacion } from "@/components/acceso/control-aprobacion";
import { requerirUsuario } from "@/lib/acceso/sesion";
import { listarUsuarios, type Usuario } from "@/lib/acceso/usuarios";
import { hayBaseDeDatos } from "@/lib/acceso/bd";

export const metadata = { title: "Accesos · Pulso", robots: { index: false, follow: false } };

function FilaUsuario({ usuario, propia }: { usuario: Usuario; propia: boolean }) {
  const pendiente = usuario.activo && !usuario.aprobado;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 border-t border-filo py-5 md:grid-cols-[minmax(0,1fr)_8rem_10rem_10rem] md:gap-x-6">
      <div className="col-span-2 min-w-0 md:col-span-1">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lectura font-medium text-tinta-titulo">
          <span className="min-w-0 break-words">{usuario.nombre}</span>
          {propia ? <span className="text-meta font-normal text-tinta-meta">Tú</span> : null}
        </p>
        <p className="mt-1 break-all text-cuerpo text-tinta-meta">{usuario.correo}</p>
      </div>
      <span className="text-cuerpo text-tinta-prosa">{usuario.rol === "admin" ? "Administrador" : "Lector"}</span>
      <span className={`flex items-center justify-end gap-2 text-cuerpo md:justify-start ${pendiente ? "text-aviso" : "text-tinta-prosa"}`}>
        {usuario.activo ? pendiente ? <Clock size={16} aria-hidden /> : <CheckCircle size={16} className="text-sube" aria-hidden /> : null}
        {!usuario.activo ? "Desactivada" : pendiente ? "Pendiente" : "Aprobado"}
      </span>
      <div className="col-span-2 md:col-span-1 md:justify-self-end">
        {propia ? <span className="hidden text-cuerpo text-tinta-meta md:block">Tu cuenta</span> : usuario.activo ? (
          <ControlAprobacion id={usuario.id} nombre={usuario.nombre} aprobado={usuario.aprobado} />
        ) : null}
      </div>
    </li>
  );
}

export default async function PaginaUsuarios() {
  const admin = await requerirUsuario();
  if (admin.rol !== "admin") notFound();
  const conectada = hayBaseDeDatos();
  const usuarios = conectada ? await listarUsuarios() : [];
  const pendientes = usuarios.filter((usuario) => usuario.activo && !usuario.aprobado);
  const resto = usuarios.filter((usuario) => !usuario.activo || usuario.aprobado);
  return (
    <>
      <Navegacion zona={null} vista={null} fuera="Accesos" />
      <div className="mx-auto w-full max-w-[88rem] px-4 pb-16 pt-6 md:px-8 md:pt-0">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-filo pb-8 md:pb-10">
          <div>
            <h1 className="font-titular text-hero [font-stretch:112%] text-tinta-titulo">Accesos</h1>
            <p className="mt-5 max-w-[54ch] text-lectura text-tinta-prosa">Tener una cuenta de Microsoft no concede acceso. Aprueba a cada persona para que pueda entrar.</p>
          </div>
          <p className="flex items-center gap-2 text-cuerpo text-tinta-meta"><ShieldCheck size={18} aria-hidden /> Solo administradores</p>
        </header>
        {!conectada ? (
          <section className="py-10" aria-labelledby="conexion-titulo">
            <h2 id="conexion-titulo" className="text-lectura font-medium text-tinta-titulo">Administración no disponible</h2>
            <p className="mt-2 max-w-[60ch] text-cuerpo text-tinta-prosa">Conecta la base de datos de usuarios para consultar y aprobar solicitudes.</p>
          </section>
        ) : (
          <>
            <section className="py-8 md:py-10" aria-labelledby="pendientes-titulo">
              <div className="flex items-baseline gap-3">
                <h2 id="pendientes-titulo" className="text-lectura font-medium text-tinta-titulo">Solicitudes pendientes</h2>
                <span className="text-cuerpo tabular-nums text-tinta-meta">{pendientes.length}</span>
              </div>
              {pendientes.length ? (
                <ul className="mt-5">{pendientes.map((usuario) => <FilaUsuario key={usuario.id} usuario={usuario} propia={usuario.id === admin.id} />)}</ul>
              ) : (
                <div className="mt-5 flex items-start gap-3 rounded-nucleo bg-vela px-5 py-5">
                  <CheckCircle size={20} className="mt-0.5 shrink-0 text-sube" aria-hidden />
                  <div>
                    <p className="text-cuerpo font-medium text-tinta-dato">No hay solicitudes pendientes.</p>
                    <p className="mt-1 text-cuerpo text-tinta-meta">Las nuevas solicitudes aparecerán aquí cuando una persona intente entrar.</p>
                  </div>
                </div>
              )}
            </section>
            <section aria-labelledby="equipo-titulo">
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="equipo-titulo" className="text-lectura font-medium text-tinta-titulo">Cuentas del equipo</h2>
                <span className="text-cuerpo tabular-nums text-tinta-meta">{resto.length} {resto.length === 1 ? "cuenta" : "cuentas"}</span>
              </div>
              <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_8rem_10rem_10rem] gap-x-6 pb-3 text-meta text-tinta-meta md:grid">
                <span>Persona</span><span>Rol</span><span>Acceso</span><span className="text-right">Acciones</span>
              </div>
              <ul>{resto.map((usuario) => <FilaUsuario key={usuario.id} usuario={usuario} propia={usuario.id === admin.id} />)}</ul>
              {resto.length === 0 ? <p className="border-t border-filo py-6 text-cuerpo text-tinta-meta">Todavía no hay cuentas aprobadas o desactivadas.</p> : null}
              <p className="border-t border-filo pt-5 text-meta text-tinta-meta">Al revocar un acceso, la cuenta deja de entrar al tablero en su siguiente petición.</p>
            </section>
          </>
        )}
      </div>
    </>
  );
}
