import type { ArtigoBiblioteca } from "@/types";
import { atraso, db } from "./mockDb";

export async function listarArtigos(): Promise<ArtigoBiblioteca[]> {
  await atraso();
  return db.artigosBiblioteca;
}
