import type { Metadata } from "next";
import { TableroGaritas } from "@/components/garitas/tablero-garitas";
export const metadata: Metadata = { title: "Garitas · Pulso N33" };
export default function PaginaGaritas() { return <TableroGaritas />; }
