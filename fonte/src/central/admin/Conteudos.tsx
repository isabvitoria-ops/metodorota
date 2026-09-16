import { useMemo, useState } from "react";
import type {
  CategoriaComerFora,
  DecisaoComerFora,
  EstabelecimentoComerFora,
  Guia,
  NivelEscolha,
  OpcaoComerFora,
  SecaoGuia,
} from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { repositorio } from "@/central/dados/repositorio";
import { gerarIdentificador, useCatalogo } from "@/central/hooks/useCatalogo";
import { SeloNeutro } from "@/central/components/Selo";
import { CampoLogo } from "./componentes/CampoLogo";
import { EditorEstabelecimentos } from "./componentes/EditorEstabelecimentos";
import { Modal } from "./componentes/Modal";
import { AreaTexto, Campo, Selecao, Texto, linhasDeLista, listaDeLinhas } from "./componentes/Campos";

/**
 * Conteúdos: guias e comer fora (§43 e §44 do briefing).
 *
 * Editar conteúdo estruturado num celular é o tipo de tela que fica
 * impossível se cada item virar um formulário aninhado. A saída aqui é
 * escrever listas como texto, uma por linha: parágrafos, marcadores,
 * lembretes. Quem escreve pensa em texto corrido, não em campos.
 *
 * As calorias ficam guardadas com um interruptor próprio por item — é o §18
 * do briefing: o número existe no sistema, e aparecer ou não é decisão sua,
 * item a item.
 */
export function Conteudos() {
  const [aba, definirAba] = useState<"guias" | "comer-fora">("guias");
  const versao = useCatalogo((e) => e.versao);
  const [guiaEditando, definirGuia] = useState<Guia | "novo" | null>(null);
  const [categoriaEditando, definirCategoria] = useState<CategoriaComerFora | "nova" | null>(null);

  const guias = useMemo(() => {
    void versao;
    return catalogo.guias();
  }, [versao]);

  const categorias = useMemo(() => {
    void versao;
    return catalogo.categoriasComerFora();
  }, [versao]);

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Conteúdos
      </h1>
      <p className="c-subtitulo">Guias e material de comer fora. Só o que estiver publicado aparece para o paciente.</p>

      <div className="c-chips" style={{ marginTop: 18 }}>
        <button type="button" className="c-chip" aria-pressed={aba === "guias"} onClick={() => definirAba("guias")}>
          Guias
        </button>
        <button
          type="button"
          className="c-chip"
          aria-pressed={aba === "comer-fora"}
          onClick={() => definirAba("comer-fora")}
        >
          Comer fora
        </button>
      </div>

      <div className="c-barra-acoes">
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          onClick={() => (aba === "guias" ? definirGuia("novo") : definirCategoria("nova"))}
        >
          {aba === "guias" ? "Novo guia" : "Nova categoria"}
        </button>
      </div>

      <div className="c-tabela">
        {aba === "guias"
          ? guias.map((guia) => (
              <div className="c-tabela-linha" key={guia.id}>
                <button type="button" className="c-tabela-alvo" onClick={() => definirGuia(guia)}>
                  <span style={{ flex: 1, minWidth: 170 }}>
                    <span className="c-tabela-nome">{guia.titulo}</span>
                    <span className="c-tabela-apoio">
                      {guia.tema} · {guia.secoes.length} {guia.secoes.length === 1 ? "seção" : "seções"}
                    </span>
                  </span>
                  <span className="c-tabela-coluna" style={{ minWidth: 110 }}>
                    <SeloNeutro>{guia.status === "publicado" ? "Publicado" : "Rascunho"}</SeloNeutro>
                  </span>
                </button>
              </div>
            ))
          : categorias.map((categoria) => (
              <div className="c-tabela-linha" key={categoria.id}>
                <button type="button" className="c-tabela-alvo" onClick={() => definirCategoria(categoria)}>
                  <span style={{ flex: 1, minWidth: 170 }}>
                    <span className="c-tabela-nome">{categoria.nome}</span>
                    <span className="c-tabela-apoio">
                      {categoria.decisoes.length} {categoria.decisoes.length === 1 ? "decisão" : "decisões"} ·{" "}
                      {categoria.decisoes.reduce((s, d) => s + d.opcoes.length, 0)} opções
                    </span>
                  </span>
                  <span className="c-tabela-coluna" style={{ minWidth: 110 }}>
                    <SeloNeutro>{categoria.status === "publicado" ? "Publicado" : "Rascunho"}</SeloNeutro>
                  </span>
                </button>
              </div>
            ))}
      </div>

      {guiaEditando && (
        <ModalGuia guia={guiaEditando === "novo" ? null : guiaEditando} aoFechar={() => definirGuia(null)} />
      )}
      {categoriaEditando && (
        <ModalCategoria
          categoria={categoriaEditando === "nova" ? null : categoriaEditando}
          aoFechar={() => definirCategoria(null)}
        />
      )}
    </>
  );
}

const STATUS: { valor: "rascunho" | "publicado"; rotulo: string }[] = [
  { valor: "rascunho", rotulo: "Rascunho (só você vê)" },
  { valor: "publicado", rotulo: "Publicado (paciente vê)" },
];

function ModalGuia({ guia, aoFechar }: { guia: Guia | null; aoFechar: () => void }) {
  const { comSalvamento, salvando, erro } = useCatalogo();
  const [titulo, definirTitulo] = useState(guia?.titulo ?? "");
  const [tema, definirTema] = useState(guia?.tema ?? "No dia a dia");
  const [resumo, definirResumo] = useState(guia?.resumo ?? "");
  const [ordem, definirOrdem] = useState(String(guia?.ordem ?? 99));
  const [status, definirStatus] = useState<"rascunho" | "publicado">(
    guia?.status === "publicado" ? "publicado" : "rascunho",
  );
  const [tags, definirTags] = useState(linhasDeLista(guia?.tags ?? []));
  const [secoes, definirSecoes] = useState<SecaoGuia[]>(guia?.secoes ?? []);
  const [aviso, definirAviso] = useState<string | null>(null);

  function alterarSecao(indice: number, mudanca: Partial<SecaoGuia>) {
    definirSecoes((atual) => atual.map((s, i) => (i === indice ? { ...s, ...mudanca } : s)));
  }

  async function salvar() {
    definirAviso(null);
    if (!titulo.trim()) return definirAviso("Escreva o título do guia.");
    const identificador = guia?.id ?? gerarIdentificador(titulo);
    if (!identificador) return definirAviso("O título precisa ter pelo menos uma letra ou número.");

    const novo: Guia = {
      id: identificador,
      titulo: titulo.trim(),
      tema: tema.trim() || "Outros",
      resumo: resumo.trim() || null,
      ordem: Number(ordem) || 99,
      status: status === "publicado" ? "publicado" : "em-preparacao",
      secoes: secoes.filter((s) => s.paragrafos.length > 0 || s.itens.length > 0 || s.titulo),
      tags: listaDeLinhas(tags),
    };
    const deuCerto = await comSalvamento(() => repositorio.salvarGuia(novo));
    if (deuCerto) aoFechar();
  }

  return (
    <Modal titulo={guia ? "Editar guia" : "Novo guia"} aoFechar={aoFechar}>
      <Campo rotulo="Título">
        <Texto valor={titulo} aoMudar={definirTitulo} placeholder="Refeição livre" />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="Tema" dica="Agrupa na listagem.">
          <Texto valor={tema} aoMudar={definirTema} placeholder="Digestão" />
        </Campo>
        <Campo rotulo="Ordem">
          <Texto valor={ordem} aoMudar={definirOrdem} />
        </Campo>
      </div>
      <Campo rotulo="Resumo" dica="Uma linha, aparece na listagem.">
        <Texto valor={resumo} aoMudar={definirResumo} />
      </Campo>
      <Campo rotulo="Situação">
        <Selecao valor={status} aoMudar={definirStatus} opcoes={STATUS} />
      </Campo>
      <Campo rotulo="Palavras de busca" dica="Uma por linha.">
        <AreaTexto valor={tags} aoMudar={definirTags} linhas={2} />
      </Campo>

      <h3 className="c-secao-titulo" style={{ marginTop: 22 }}>
        Seções
      </h3>
      {secoes.map((secao, indice) => (
        <div className="c-bloco" key={indice}>
          <div className="c-bloco-topo">
            <strong style={{ fontSize: 14 }}>Seção {indice + 1}</strong>
            <button
              type="button"
              className="c-link"
              onClick={() => definirSecoes((a) => a.filter((_, i) => i !== indice))}
            >
              Remover
            </button>
          </div>
          <Campo rotulo="Título da seção">
            <Texto valor={secao.titulo ?? ""} aoMudar={(v) => alterarSecao(indice, { titulo: v })} />
          </Campo>
          <Campo rotulo="Parágrafos" dica="Um parágrafo por linha.">
            <AreaTexto
              valor={linhasDeLista(secao.paragrafos)}
              aoMudar={(v) => alterarSecao(indice, { paragrafos: listaDeLinhas(v) })}
              linhas={4}
            />
          </Campo>
          <Campo rotulo="Marcadores" dica="Um por linha.">
            <AreaTexto
              valor={linhasDeLista(secao.itens)}
              aoMudar={(v) => alterarSecao(indice, { itens: listaDeLinhas(v) })}
              linhas={3}
            />
          </Campo>
        </div>
      ))}
      <button
        type="button"
        className="c-botao c-botao-secundario c-botao-pequeno"
        style={{ marginTop: 12 }}
        onClick={() =>
          definirSecoes((a) => [
            ...a,
            { id: `secao-${a.length + 1}`, titulo: "", paragrafos: [], itens: [] },
          ])
        }
      >
        Adicionar seção
      </button>

      {(aviso || erro) && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso ?? erro}</span>
        </div>
      )}

      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className="c-botao" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

const NIVEIS: { valor: NivelEscolha | "nenhum"; rotulo: string }[] = [
  { valor: "nenhum", rotulo: "Sem classificação" },
  { valor: "melhor", rotulo: "Melhor escolha" },
  { valor: "boa", rotulo: "Boa opção" },
  { valor: "ocasional", rotulo: "Mais ocasional" },
];

function ModalCategoria({
  categoria,
  aoFechar,
}: {
  categoria: CategoriaComerFora | null;
  aoFechar: () => void;
}) {
  const { comSalvamento, salvando, erro } = useCatalogo();
  const [nome, definirNome] = useState(categoria?.nome ?? "");
  const [resumo, definirResumo] = useState(categoria?.resumo ?? "");
  const [icone, definirIcone] = useState(categoria?.icone ?? "restaurante");
  const [ordem, definirOrdem] = useState(String(categoria?.ordem ?? 99));
  const [status, definirStatus] = useState<"rascunho" | "publicado">(
    categoria?.status === "publicado" ? "publicado" : "rascunho",
  );
  const [introducao, definirIntroducao] = useState(categoria?.introducao ?? "");
  const [lembretes, definirLembretes] = useState(linhasDeLista(categoria?.lembretes ?? []));
  const [tags, definirTags] = useState(linhasDeLista(categoria?.tags ?? []));
  const [decisoes, definirDecisoes] = useState<DecisaoComerFora[]>(categoria?.decisoes ?? []);
  const [logo, definirLogo] = useState<string | null>(categoria?.logo ?? null);
  const [estabelecimentos, definirEstabelecimentos] = useState<EstabelecimentoComerFora[]>(
    categoria?.estabelecimentos ?? [],
  );
  const [aviso, definirAviso] = useState<string | null>(null);

  function alterarDecisao(indice: number, mudanca: Partial<DecisaoComerFora>) {
    definirDecisoes((atual) => atual.map((d, i) => (i === indice ? { ...d, ...mudanca } : d)));
  }

  function alterarOpcao(iDecisao: number, iOpcao: number, mudanca: Partial<OpcaoComerFora>) {
    definirDecisoes((atual) =>
      atual.map((d, i) =>
        i === iDecisao
          ? { ...d, opcoes: d.opcoes.map((o, j) => (j === iOpcao ? { ...o, ...mudanca } : o)) }
          : d,
      ),
    );
  }

  async function salvar() {
    definirAviso(null);
    if (!nome.trim()) return definirAviso("Escreva o nome da categoria.");
    const identificador = categoria?.id ?? gerarIdentificador(nome);
    if (!identificador) return definirAviso("O nome precisa ter pelo menos uma letra ou número.");

    const nova: CategoriaComerFora = {
      id: identificador,
      nome: nome.trim(),
      resumo: resumo.trim() || null,
      icone: icone.trim() || "restaurante",
      logo,
      ordem: Number(ordem) || 99,
      status: status === "publicado" ? "publicado" : "em-preparacao",
      introducao: introducao.trim() || null,
      decisoes,
      estabelecimentos: estabelecimentos.filter((e) => e.nome.trim() !== ""),
      lembretes: listaDeLinhas(lembretes),
      tags: listaDeLinhas(tags),
    };
    const deuCerto = await comSalvamento(() => repositorio.salvarCategoriaComerFora(nova));
    if (deuCerto) aoFechar();
  }

  return (
    <Modal titulo={categoria ? "Editar categoria" : "Nova categoria"} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <Texto valor={nome} aoMudar={definirNome} placeholder="Pizza" />
      </Campo>
      <Campo rotulo="Resumo" dica="Uma linha, aparece no cartão da grade.">
        <Texto valor={resumo} aoMudar={definirResumo} />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="Ícone" dica="hamburguer, japonesa, massas, doces, pizza, acai, sanduiche, restaurante, delivery">
          <Texto valor={icone} aoMudar={definirIcone} />
        </Campo>
        <Campo rotulo="Ordem">
          <Texto valor={ordem} aoMudar={definirOrdem} />
        </Campo>
      </div>
      <Campo rotulo="Situação">
        <Selecao valor={status} aoMudar={definirStatus} opcoes={STATUS} />
      </Campo>
      <Campo rotulo="Introdução">
        <AreaTexto valor={introducao} aoMudar={definirIntroducao} linhas={3} />
      </Campo>

      <CampoLogo nome={nome} logo={logo} aoMudar={definirLogo} />
      <p className="c-dica">
        Use quando a categoria for uma marca — Subway, por exemplo. Com logo, ela aparece no lugar
        do ícone na grade de Comer fora.
      </p>

      <EditorEstabelecimentos estabelecimentos={estabelecimentos} aoMudar={definirEstabelecimentos} />

      <h3 className="c-secao-titulo" style={{ marginTop: 22 }}>
        Decisões da refeição
      </h3>
      {decisoes.map((decisao, iDecisao) => (
        <div className="c-bloco" key={iDecisao}>
          <div className="c-bloco-topo">
            <strong style={{ fontSize: 14 }}>Decisão {iDecisao + 1}</strong>
            <button
              type="button"
              className="c-link"
              onClick={() => definirDecisoes((a) => a.filter((_, i) => i !== iDecisao))}
            >
              Remover
            </button>
          </div>
          <Campo rotulo="Título">
            <Texto valor={decisao.titulo} aoMudar={(v) => alterarDecisao(iDecisao, { titulo: v })} />
          </Campo>
          <Campo rotulo="Pergunta">
            <Texto
              valor={decisao.pergunta ?? ""}
              aoMudar={(v) => alterarDecisao(iDecisao, { pergunta: v })}
            />
          </Campo>
          <Campo rotulo="Observações desta decisão" dica="Uma por linha. Valem para todas as opções abaixo.">
            <AreaTexto
              valor={linhasDeLista(decisao.observacoes)}
              aoMudar={(v) => alterarDecisao(iDecisao, { observacoes: listaDeLinhas(v) })}
              linhas={2}
            />
          </Campo>

          {decisao.opcoes.map((opcao, iOpcao) => (
            <div className="c-bloco" key={iOpcao} style={{ background: "var(--surface)" }}>
              <div className="c-bloco-topo">
                <strong style={{ fontSize: 13 }}>Opção {iOpcao + 1}</strong>
                <button
                  type="button"
                  className="c-link"
                  onClick={() =>
                    alterarDecisao(iDecisao, {
                      opcoes: decisao.opcoes.filter((_, j) => j !== iOpcao),
                    })
                  }
                >
                  Remover
                </button>
              </div>
              <Campo rotulo="Título">
                <Texto valor={opcao.titulo} aoMudar={(v) => alterarOpcao(iDecisao, iOpcao, { titulo: v })} />
              </Campo>
              <Campo rotulo="Classificação">
                <Selecao
                  valor={opcao.nivel ?? "nenhum"}
                  aoMudar={(v) =>
                    alterarOpcao(iDecisao, iOpcao, { nivel: v === "nenhum" ? null : (v as NivelEscolha) })
                  }
                  opcoes={NIVEIS}
                />
              </Campo>
              <Campo rotulo="Descrição">
                <AreaTexto
                  valor={opcao.descricao ?? ""}
                  aoMudar={(v) => alterarOpcao(iDecisao, iOpcao, { descricao: v || null })}
                  linhas={2}
                />
              </Campo>
              <Campo rotulo="Marcadores" dica="Um por linha.">
                <AreaTexto
                  valor={linhasDeLista(opcao.detalhes)}
                  aoMudar={(v) => alterarOpcao(iDecisao, iOpcao, { detalhes: listaDeLinhas(v) })}
                  linhas={2}
                />
              </Campo>
              <div className="c-duas-colunas">
                <Campo rotulo="Calorias" dica="Fica guardado mesmo sem aparecer.">
                  <Texto
                    valor={opcao.energia?.kcal !== null && opcao.energia?.kcal !== undefined ? String(opcao.energia.kcal) : ""}
                    aoMudar={(v) =>
                      alterarOpcao(iDecisao, iOpcao, {
                        energia: {
                          kcal: v.trim() ? Number(v.replace(",", ".")) : null,
                          mostrarKcal: opcao.energia?.mostrarKcal ?? false,
                          observacao: opcao.energia?.observacao ?? null,
                        },
                      })
                    }
                  />
                </Campo>
                <Campo rotulo="Mostrar ao paciente">
                  <Selecao
                    valor={opcao.energia?.mostrarKcal ? "sim" : "nao"}
                    aoMudar={(v) =>
                      alterarOpcao(iDecisao, iOpcao, {
                        energia: {
                          kcal: opcao.energia?.kcal ?? null,
                          mostrarKcal: v === "sim",
                          observacao: opcao.energia?.observacao ?? null,
                        },
                      })
                    }
                    opcoes={[
                      { valor: "nao", rotulo: "Não" },
                      { valor: "sim", rotulo: "Sim" },
                    ]}
                  />
                </Campo>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            style={{ marginTop: 10 }}
            onClick={() =>
              alterarDecisao(iDecisao, {
                opcoes: [
                  ...decisao.opcoes,
                  {
                    id: `opcao-${decisao.opcoes.length + 1}-${Date.now().toString(36)}`,
                    titulo: "",
                    descricao: null,
                    nivel: null,
                    energia: null,
                    detalhes: [],
                    tags: [],
                  },
                ],
              })
            }
          >
            Adicionar opção
          </button>
        </div>
      ))}

      <button
        type="button"
        className="c-botao c-botao-secundario c-botao-pequeno"
        style={{ marginTop: 12 }}
        onClick={() =>
          definirDecisoes((a) => [
            ...a,
            { id: `decisao-${a.length + 1}`, titulo: "", pergunta: "", opcoes: [], observacoes: [] },
          ])
        }
      >
        Adicionar decisão
      </button>

      <Campo rotulo="Lembretes" dica="Um por linha. Aparecem no fim da tela.">
        <AreaTexto valor={lembretes} aoMudar={definirLembretes} linhas={2} />
      </Campo>
      <Campo rotulo="Palavras de busca" dica="Uma por linha.">
        <AreaTexto valor={tags} aoMudar={definirTags} linhas={2} />
      </Campo>

      {(aviso || erro) && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso ?? erro}</span>
        </div>
      )}

      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className="c-botao" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
