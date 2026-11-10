import type { ItemDeReintroducao, RegistroDeReintroducao, StatusReintroducao } from "@/central/types";
import { rotuloSintoma, temSintoma } from "./reintroducao";
import { classificar } from "./rastreio";

/**
 * O resumo do rastreio para a nutricionista: uma linha por alimento.
 *
 * Tudo aqui é CONTAGEM do que a paciente registrou — quantas vezes comeu, em
 * quantos dias, quantas com sintoma, quais sintomas. A única leitura é a
 * escada de pontos, que é a mesma conta que a paciente vê (`classificar`), e
 * vem ao lado da classificação que a nutricionista deu, sem substituí-la.
 */
export interface LinhaPorAlimento {
  itemId: string;
  nome: string;
  status: StatusReintroducao;
  /** Quantos registros. */
  testes: number;
  /** Em quantos dias diferentes — dois registros no mesmo dia são uma exposição. */
  dias: number;
  comSintoma: number;
  sintomas: { chave: string; rotulo: string; vezes: number }[];
  /** A maior intensidade informada; nulo se ela nunca informou. */
  intensidadeMaxima: number | null;
  /** A data do registro mais recente. */
  ultimo: string;
  escada: { tom: "bom" | "atencao" | "grave"; rotulo: string };
}

export function resumoPorAlimento(
  itens: Pick<ItemDeReintroducao, "id" | "nome" | "status">[],
  registros: RegistroDeReintroducao[],
): LinhaPorAlimento[] {
  const porItem = new Map<string, RegistroDeReintroducao[]>();
  for (const r of registros) porItem.set(r.itemId, [...(porItem.get(r.itemId) ?? []), r]);

  const linhas: LinhaPorAlimento[] = [];
  for (const [itemId, meus] of porItem) {
    const item = itens.find((i) => i.id === itemId);
    const vezes = new Map<string, number>();
    let intensidadeMaxima: number | null = null;
    for (const r of meus) {
      if (!temSintoma(r)) continue;
      for (const s of r.sintomas) if (s !== "nenhum") vezes.set(s, (vezes.get(s) ?? 0) + 1);
      if (r.intensidade !== null && r.intensidade > 0) {
        intensidadeMaxima = Math.max(intensidadeMaxima ?? 0, r.intensidade);
      }
    }
    linhas.push({
      itemId,
      nome: item?.nome ?? meus[0]?.itemNome ?? "",
      status: item?.status ?? "em_teste",
      testes: meus.length,
      dias: new Set(meus.map((r) => r.data)).size,
      comSintoma: meus.filter(temSintoma).length,
      sintomas: [...vezes.entries()]
        .map(([chave, n]) => ({ chave, rotulo: rotuloSintoma(chave), vezes: n }))
        .sort((a, b) => b.vezes - a.vezes || a.rotulo.localeCompare(b.rotulo, "pt-BR")),
      intensidadeMaxima,
      ultimo: meus.map((r) => r.data).sort().at(-1) ?? "",
      escada: classificar(meus),
    });
  }
  return linhas.sort(
    (a, b) => b.comSintoma - a.comSintoma || b.testes - a.testes || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/** Os sintomas mais relatados: em quantos registros e em quantos alimentos. */
export function frequenciaDeSintomas(
  registros: RegistroDeReintroducao[],
): { chave: string; rotulo: string; registros: number; alimentos: number }[] {
  const contas = new Map<string, { registros: number; itens: Set<string> }>();
  for (const r of registros) {
    if (!temSintoma(r)) continue;
    for (const s of new Set(r.sintomas)) {
      if (s === "nenhum") continue;
      const conta = contas.get(s) ?? { registros: 0, itens: new Set<string>() };
      conta.registros += 1;
      conta.itens.add(r.itemId);
      contas.set(s, conta);
    }
  }
  return [...contas.entries()]
    .map(([chave, c]) => ({ chave, rotulo: rotuloSintoma(chave), registros: c.registros, alimentos: c.itens.size }))
    .sort((a, b) => b.registros - a.registros || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Os quatro números do alto do resumo. */
export function numerosDoRastreio(registros: RegistroDeReintroducao[]): {
  registros: number;
  comSintoma: number;
  alimentos: number;
  dias: number;
} {
  return {
    registros: registros.length,
    comSintoma: registros.filter(temSintoma).length,
    alimentos: new Set(registros.map((r) => r.itemId)).size,
    dias: new Set(registros.map((r) => r.data)).size,
  };
}
