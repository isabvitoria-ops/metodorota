/**
 * A ficha aberta nos Cálculos e o caminho dela até a gaveta do navegador.
 *
 * O FORMATO É O MESMO da ferramenta antiga (nutri/): { id, nome, dieta,
 * corpo, macros }, com `corpo` e `macros` guardados pelos mesmos nomes de
 * campo ("c-peso", "m-kcal"…). Assim toda ficha que ela já salvou abre aqui
 * igual, e a ferramenta antiga continua lendo o que se salva aqui.
 *
 * Regras que vêm de lá e continuam valendo:
 *   * abrir os Cálculos começa em ficha nova — nunca a paciente de ontem;
 *   * cada mudança é gravada na hora: não há botão de salvar para esquecer;
 *   * ficha intocada não vira registro na lista.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizarRefeicao, refeicaoNova } from "./motor/dieta.mjs";
import {
  apagarFicha,
  fichaVazia,
  lerFicha,
  listarFichas,
  migrarGavetaAntiga,
  novoId,
  restaurarBackup,
  salvarFicha,
  textoDoBackup,
} from "./motor/fichas.mjs";
import { restaurarDoBackup, tudoParaBackup } from "./motor/meusAlimentos.mjs";
import { PROTOCOLOS } from "./motor/protocolos.mjs";
import { CATEGORIAS, EQUACOES } from "./motor/gasto/equacoes.mjs";
import type { ItemDaDieta, Medida } from "./tabela";

export interface Opcao {
  rotulo: string;
  itens: ItemDaDieta[];
}

export interface Refeicao {
  nome: string;
  horario: string;
  opcoes: Opcao[];
  opcaoAtiva: number;
  recolhida?: boolean;
}

export interface Dieta {
  peso: string;
  meta: string;
  refeicoes: Refeicao[];
}

export type Campos = Record<string, string>;

export interface FichaSalva {
  id: string;
  nome: string;
  dieta: Dieta;
  corpo: Campos;
  macros: Campos;
  atualizadoEm?: string;
}

export const LINHAS_MET = 5;

/** A data de hoje no relógio do computador dela, não em UTC. */
export function hojeLocal(): string {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

type Equacao = {
  id: string;
  categoria: string;
  padrao?: boolean;
  status?: string;
  atividade?: { tipo?: string; niveis?: { chave: string; rotulo: string }[] };
};

/** As equações de uma categoria: as que calculam primeiro, as "aguardando fonte" no fim. */
export function equacoesOrdenadas(categoria: string): Equacao[] {
  const daCategoria = (EQUACOES as Equacao[]).filter((x) => x.categoria === categoria);
  return [
    ...daCategoria.filter((x) => x.padrao),
    ...daCategoria.filter((x) => !x.padrao && x.status !== "aguardando_fonte"),
    ...daCategoria.filter((x) => x.status === "aguardando_fonte"),
  ];
}

const PRIMEIRO_PROTOCOLO = Object.keys(PROTOCOLOS)[0] as string;

/** Os campos da composição como a tela antiga nascia. */
export function corpoPadrao(): Campos {
  const protocolo = (PROTOCOLOS as Record<string, { conversao?: string }>)[PRIMEIRO_PROTOCOLO];
  const equacao = equacoesOrdenadas("geral")[0];
  const nivel = equacao?.atividade?.tipo === "pa" ? (equacao.atividade.niveis?.[0]?.chave ?? "") : "";
  const campos: Campos = {
    "c-data": hojeLocal(),
    "c-sexo": "feminino",
    "c-idade": "",
    "c-peso": "",
    "c-altura": "",
    "c-protocolo": PRIMEIRO_PROTOCOLO,
    "c-equacao": protocolo?.conversao ?? "siri",
    "c-atividade": "1.375",
    "c-fao": "leve",
    "g-categoria": (CATEGORIAS as { chave: string }[]).some((c) => c.chave === "geral") ? "geral" : "",
    "g-equacao": equacao?.id ?? "",
    "g-pa": nivel,
    "g-modo": "fa",
    "c-mm": "",
    "g-sg": "",
    "g-pre": "",
    "g-meses": "",
  };
  for (let i = 0; i < LINHAS_MET; i++) {
    for (const p of ["met-nome", "met-valor", "met-min", "met-vezes"]) campos[`${p}-${i}`] = "";
  }
  return campos;
}

/** Os campos dos macros como a tela antiga nascia (2000 kcal, 50/30/20, 30 dias). */
export function macrosPadrao(): Campos {
  return {
    "m-kcal": "2000",
    "m-peso": "",
    "m-cho": "50",
    "m-ptn": "30",
    "m-lip": "20",
    "m-atual": "",
    "m-desejado": "",
    "m-dias": "30",
  };
}

function dietaPadrao(): Dieta {
  return { peso: "", meta: "", refeicoes: [normalizarRefeicao(refeicaoNova("Café da manhã", "07:00")) as Refeicao] };
}

function deFicha(ficha: FichaSalva | null) {
  const corpo = { ...corpoPadrao(), ...(ficha?.corpo ?? {}) };
  if (!corpo["c-data"]) corpo["c-data"] = hojeLocal();
  const macros = { ...macrosPadrao() };
  for (const [k, v] of Object.entries(ficha?.macros ?? {})) if (v !== undefined && v !== "") macros[k] = String(v);
  const dieta: Dieta = {
    peso: ficha?.dieta?.peso ?? "",
    meta: ficha?.dieta?.meta ?? "",
    refeicoes: ficha?.dieta?.refeicoes?.length
      ? (ficha.dieta.refeicoes.map(normalizarRefeicao) as Refeicao[])
      : dietaPadrao().refeicoes,
  };
  return { id: ficha?.id ?? (novoId() as string), nome: ficha?.nome ?? "", dieta, corpo, macros };
}

const CHAVE_ULTIMO_BACKUP = "nutri:ultimo-backup";

export interface Lembrete {
  quantas: number;
  dias: number | null;
}

/** Quantas fichas estão só aqui e há quanto tempo não há backup. */
function lembreteDeBackup(): Lembrete | null {
  const quantas = (listarFichas() as FichaSalva[]).length;
  let ultimo: string | null = null;
  try {
    ultimo = localStorage.getItem(CHAVE_ULTIMO_BACKUP);
  } catch {
    /* sem memória, sem lembrete */
  }
  const dias = ultimo ? Math.floor((Date.now() - Date.parse(ultimo)) / 86_400_000) : null;
  if (!quantas || (dias !== null && dias < 7)) return null;
  return { quantas, dias };
}

/** A ficha aberta, a lista e as ações da barra de fichas. */
export function useFicha() {
  const [migrada] = useState(() => migrarGavetaAntiga() as FichaSalva | null);
  const [aberta, definirAberta] = useState(() => deFicha(null));
  const [fichas, definirFichas] = useState<FichaSalva[]>(() => listarFichas() as FichaSalva[]);
  const [estado, definirEstado] = useState<{ texto: string; alerta?: boolean }>(() =>
    migrada
      ? { texto: `Guardei o que estava na tela antes como a ficha “${migrada.nome}”. Ela está na lista de fichas salvas.` }
      : { texto: "Ficha nova. O que você digitar é salvo sozinho." },
  );
  const [lembrete, definirLembrete] = useState<Lembrete | null>(() => lembreteDeBackup());

  // O ponto de partida de toda ficha nova: o que muda em relação a ele é dela.
  const limpo = useMemo(() => {
    const { dieta, corpo, macros } = deFicha(null);
    return JSON.stringify({ dieta, corpo, macros });
  }, []);

  useEffect(() => {
    try {
      void navigator.storage?.persist?.();
    } catch {
      /* navegador sem esse recurso */
    }
  }, []);

  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const { id, nome, dieta, corpo, macros } = aberta;
    const ficha = { id, nome: nome.trim(), dieta, corpo, macros };
    if (!ficha.nome && JSON.stringify({ dieta, corpo, macros }) === limpo) return;
    if (fichaVazia(ficha)) return;
    if (!salvarFicha(ficha)) {
      definirEstado({
        texto: "Não consegui gravar nesta ficha — a memória do navegador recusou. Baixe o backup antes de fechar.",
        alerta: true,
      });
      return;
    }
    definirFichas(listarFichas() as FichaSalva[]);
    definirLembrete(lembreteDeBackup());
    definirEstado({
      texto: `Salvo automaticamente em “${ficha.nome || "ficha sem nome"}”. Fica na memória deste navegador: baixe o backup de vez em quando.`,
    });
  }, [aberta, limpo]);

  const mudarNome = useCallback((nome: string) => definirAberta((a) => ({ ...a, nome })), []);
  const mudarDieta = useCallback((f: (d: Dieta) => Dieta) => definirAberta((a) => ({ ...a, dieta: f(a.dieta) })), []);
  const mudarCorpo = useCallback((campos: Campos) => definirAberta((a) => ({ ...a, corpo: { ...a.corpo, ...campos } })), []);
  const mudarMacros = useCallback(
    (campos: Campos) => definirAberta((a) => ({ ...a, macros: { ...a.macros, ...campos } })),
    [],
  );

  const abrir = useCallback((id: string) => {
    const ficha = lerFicha(id) as FichaSalva | null;
    if (!ficha) return;
    primeira.current = true;
    definirAberta(deFicha(ficha));
    definirEstado({ texto: `Ficha de ${ficha.nome || "paciente sem nome"} aberta.` });
  }, []);

  const nova = useCallback(() => {
    primeira.current = true;
    definirAberta(deFicha(null));
    definirEstado({ texto: "Ficha nova. O que você digitar é salvo sozinho." });
  }, []);

  const apagar = useCallback(() => {
    const salva = lerFicha(aberta.id) as FichaSalva | null;
    if (!salva) {
      definirEstado({ texto: "Esta ficha ainda não foi salva — não há o que apagar." });
      return;
    }
    apagarFicha(aberta.id);
    primeira.current = true;
    definirAberta(deFicha(null));
    definirFichas(listarFichas() as FichaSalva[]);
    definirLembrete(lembreteDeBackup());
    definirEstado({ texto: "Ficha apagada." });
  }, [aberta.id]);

  const baixarBackup = useCallback(() => {
    // As fichas mais o que ela cadastrou: alimento e grupo também não podem se perder.
    const pacote = JSON.parse(textoDoBackup() as string);
    Object.assign(pacote, tudoParaBackup());
    const arquivo = new Blob([JSON.stringify(pacote, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fichas-${hojeLocal()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    try {
      localStorage.setItem(CHAVE_ULTIMO_BACKUP, new Date().toISOString());
    } catch {
      /* o arquivo já foi baixado */
    }
    definirLembrete(lembreteDeBackup());
    definirEstado({ texto: `Backup de ${(listarFichas() as FichaSalva[]).length} ficha(s) baixado. Guarde fora do computador.` });
  }, []);

  const restaurar = useCallback(async (arquivo: File, depois: () => void) => {
    try {
      const texto = await arquivo.text();
      const r = restaurarBackup(texto) as { novas: number; atualizadas: number };
      const meus = restaurarDoBackup(JSON.parse(texto)) as { alimentos: number; grupos: number };
      definirFichas(listarFichas() as FichaSalva[]);
      definirLembrete(lembreteDeBackup());
      depois();
      definirEstado({
        texto:
          `Backup restaurado: ${r.novas} ficha(s) nova(s), ${r.atualizadas} atualizada(s), ` +
          `${meus.alimentos} alimento(s) seu(s), ${meus.grupos} grupo(s). Nada do que já estava aqui foi apagado.`,
      });
    } catch (e) {
      definirEstado({ texto: `Não consegui ler este arquivo: ${e instanceof Error ? e.message : String(e)}`, alerta: true });
    }
  }, []);

  return {
    aberta,
    fichas,
    estado,
    lembrete,
    salva: fichas.some((f) => f.id === aberta.id),
    mudarNome,
    mudarDieta,
    mudarCorpo,
    mudarMacros,
    abrir,
    nova,
    apagar,
    baixarBackup,
    restaurar,
  };
}

export type { Medida };
