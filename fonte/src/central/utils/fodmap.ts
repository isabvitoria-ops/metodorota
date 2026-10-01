import type {
  AlimentoFodmap,
  CategoriaFodmap,
  FaseFodmap,
  GrupoFodmap,
  NivelFodmap,
} from "@/central/types/fodmap";
import { normalizar } from "@/central/utils/texto";

export function filtrarFodmap(
  catalogo: AlimentoFodmap[],
  busca: string,
  categoria: CategoriaFodmap | null,
  grupo: GrupoFodmap | null,
  nivel: NivelFodmap | null,
): AlimentoFodmap[] {
  const termo = normalizar(busca);
  return catalogo.filter((a) => {
    if (categoria && a.categoria !== categoria) return false;
    if (grupo && !a.grupos.includes(grupo)) return false;
    if (nivel && a.nivel !== nivel) return false;
    if (termo && !normalizar(a.nome).includes(termo)) return false;
    return true;
  });
}

export function alimentosParaFase(
  catalogo: AlimentoFodmap[],
  fase: FaseFodmap,
): AlimentoFodmap[] {
  if (fase === "eliminacao") return catalogo.filter((a) => a.nivel === "verde");
  return catalogo;
}

export function contarPorNivel(alimentos: AlimentoFodmap[]): Record<NivelFodmap, number> {
  const c: Record<NivelFodmap, number> = { verde: 0, amarelo: 0, vermelho: 0 };
  for (const a of alimentos) c[a.nivel]++;
  return c;
}

export function ordenarPorNivel(alimentos: AlimentoFodmap[]): AlimentoFodmap[] {
  const peso: Record<NivelFodmap, number> = { verde: 0, amarelo: 1, vermelho: 2 };
  return [...alimentos].sort((a, b) => peso[a.nivel] - peso[b.nivel] || a.nome.localeCompare(b.nome, "pt-BR"));
}
