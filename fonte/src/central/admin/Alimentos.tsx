import { useMemo, useState } from "react";
import type { Alimento } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { repositorio } from "@/central/dados/repositorio";
import { gerarIdentificador, useCatalogo } from "@/central/hooks/useCatalogo";
import { BarraBusca } from "@/central/components/BarraBusca";
import { SeloNeutro } from "@/central/components/Selo";
import { normalizar } from "@/central/utils/texto";
import { textoMedida } from "@/central/utils/medidas";
import { Modal } from "./componentes/Modal";
import { AreaTexto, Campo, Selecao, Texto, linhasDeLista, listaDeLinhas } from "./componentes/Campos";

/**
 * Cadastro de alimentos (§41 do briefing).
 *
 * Um alimento com porção cadastrada passa a valer, sozinho, para todas as
 * trocas dentro do grupo dele — não é preciso escrever equivalência par a
 * par. Por isso a porção é o campo que mais importa desta tela, e é o que
 * a lista mostra.
 */
export function Alimentos() {
  const versao = useCatalogo((e) => e.versao);
  const [consulta, definirConsulta] = useState("");
  const [editando, definirEditando] = useState<Alimento | "novo" | null>(null);

  const alimentos = useMemo(() => {
    void versao;
    const termo = normalizar(consulta);
    return catalogo
      .alimentosCadastrados()
      .filter((a) => !termo || normalizar(a.nome).includes(termo) || a.tags.some((t) => normalizar(t).includes(termo)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [consulta, versao]);

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Alimentos
      </h1>
      <p className="c-subtitulo">
        {catalogo.alimentosCadastrados().length} cadastrados ·{" "}
        {catalogo.alimentosCadastrados().filter((a) => a.porcao).length} com porção definida
        {catalogo.alimentosCadastrados().some((a) => !a.ativo)
          ? ` · ${catalogo.alimentosCadastrados().filter((a) => !a.ativo).length} ocultos`
          : ""}
        .
      </p>

      <div className="c-barra-acoes">
        <BarraBusca valor={consulta} aoMudar={definirConsulta} placeholder="Buscar alimento" rotulo="Buscar alimento" />
        <button type="button" className="c-botao c-botao-pequeno" onClick={() => definirEditando("novo")}>
          Novo alimento
        </button>
      </div>

      <div className="c-tabela">
        {alimentos.map((alimento) => {
          const grupo = catalogo.grupo(alimento.grupoId);
          return (
            <div className="c-tabela-linha" key={alimento.id}>
              <button type="button" className="c-tabela-alvo" onClick={() => definirEditando(alimento)}>
                <span style={{ flex: 1, minWidth: 170 }}>
                  <span className="c-tabela-nome">{alimento.nome}</span>
                  <span className="c-tabela-apoio">{grupo?.nome ?? alimento.grupoId}</span>
                </span>
                <span className="c-tabela-coluna">
                  {!alimento.ativo ? (
                    <SeloNeutro>Oculto</SeloNeutro>
                  ) : alimento.porcao ? (
                    <span className="c-tabela-apoio" style={{ marginTop: 0 }}>
                      1 porção · {textoMedida(alimento.porcao, catalogo.unidade(alimento.porcao.unidadeId))}
                    </span>
                  ) : (
                    <SeloNeutro>Sem porção</SeloNeutro>
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {alimentos.length === 0 && <p className="c-contagem">Nenhum alimento com esse nome.</p>}

      {editando && (
        <ModalAlimento
          alimento={editando === "novo" ? null : editando}
          aoFechar={() => definirEditando(null)}
        />
      )}
    </>
  );
}

function ModalAlimento({ alimento, aoFechar }: { alimento: Alimento | null; aoFechar: () => void }) {
  const { comSalvamento, salvando, erro } = useCatalogo();
  const [nome, definirNome] = useState(alimento?.nome ?? "");
  const [grupoId, definirGrupoId] = useState(alimento?.grupoId ?? catalogo.grupos()[0]?.id ?? "");
  const [unidadeBaseId, definirUnidadeBase] = useState(alimento?.unidadeBaseId ?? "g");
  const [porcao, definirPorcao] = useState(alimento?.porcao ? String(alimento.porcao.quantidade) : "");
  const [porcaoUnidade, definirPorcaoUnidade] = useState(alimento?.porcao?.unidadeId ?? "g");
  const [semGluten, definirSemGluten] = useState(trinario(alimento?.atributos.semGluten));
  const [semLactose, definirSemLactose] = useState(trinario(alimento?.atributos.semLactose));
  const [tags, definirTags] = useState(linhasDeLista(alimento?.tags ?? []));
  const [observacao, definirObservacao] = useState(alimento?.observacao ?? "");
  // Começa no valor atual do alimento, não em "ativo": abrir um item oculto
  // só para corrigir o nome não pode religá-lo sem ninguém pedir.
  const [ativo, definirAtivo] = useState(alimento?.ativo ?? true);
  const [quantidadeLivre, definirQuantidadeLivre] = useState(alimento?.quantidadeLivre ?? false);
  const [aviso, definirAviso] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) return definirAviso("Escreva o nome do alimento.");
    const identificador = alimento?.id ?? gerarIdentificador(nome);
    if (!identificador) {
      return definirAviso("O nome precisa ter pelo menos uma letra ou número.");
    }
    const quantidade = porcao.trim() ? Number(porcao.replace(",", ".")) : null;
    if (porcao.trim() && (!Number.isFinite(quantidade) || quantidade! <= 0)) {
      return definirAviso("A porção precisa ser um número maior que zero.");
    }
    // Os dois juntos diriam coisas contrárias: "a porção é 100 g" e "não tem
    // porção". Recusar aqui é mais honesto do que eleger um vencedor calado.
    if (quantidadeLivre && quantidade !== null) {
      return definirAviso("Quantidade livre e porção não convivem: apague a porção ou desmarque o livre.");
    }

    const novo: Alimento = {
      id: identificador,
      nome: nome.trim(),
      grupoId,
      unidadeBaseId,
      porcao: quantidade !== null ? { quantidade: quantidade!, unidadeId: porcaoUnidade } : null,
      quantidadeLivre,
      medidas: alimento?.medidas ?? [],
      atributos: { semGluten: deTrinario(semGluten), semLactose: deTrinario(semLactose) },
      tags: listaDeLinhas(tags),
      imagem: alimento?.imagem ?? null,
      observacao: observacao.trim() || null,
      ativo,
    };

    const deuCerto = await comSalvamento(() => repositorio.salvarAlimento(novo, ativo));
    if (deuCerto) aoFechar();
  }

  return (
    <Modal titulo={alimento ? "Editar alimento" : "Novo alimento"} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <Texto valor={nome} aoMudar={definirNome} placeholder="Batata-doce cozida" />
      </Campo>
      <Campo rotulo="Grupo">
        <Selecao
          valor={grupoId}
          aoMudar={definirGrupoId}
          opcoes={catalogo.grupos().map((g) => ({ valor: g.id, rotulo: g.nome }))}
        />
      </Campo>
      <Campo rotulo="Unidade base" dica="A unidade em que as medidas deste alimento são convertidas.">
        <Selecao
          valor={unidadeBaseId}
          aoMudar={definirUnidadeBase}
          opcoes={catalogo.unidades().map((u) => ({ valor: u.id, rotulo: u.rotulo }))}
        />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="1 porção equivale a" dica="Deixe vazio se ainda não souber.">
          <Texto valor={porcao} aoMudar={definirPorcao} placeholder="100" />
        </Campo>
        <Campo rotulo="Unidade da porção">
          <Selecao
            valor={porcaoUnidade}
            aoMudar={definirPorcaoUnidade}
            opcoes={catalogo.unidades().map((u) => ({ valor: u.id, rotulo: u.rotulo }))}
          />
        </Campo>
      </div>
      <div className="c-duas-colunas">
        <Campo rotulo="Sem glúten">
          <Selecao valor={semGluten} aoMudar={definirSemGluten} opcoes={OPCOES_TRINARIAS} />
        </Campo>
        <Campo rotulo="Sem lactose">
          <Selecao valor={semLactose} aoMudar={definirSemLactose} opcoes={OPCOES_TRINARIAS} />
        </Campo>
      </div>
      <Campo rotulo="Palavras de busca" dica="Uma por linha. Ajudam o paciente a encontrar pelo nome que ele usa.">
        <AreaTexto valor={tags} aoMudar={definirTags} linhas={3} placeholder={"batata\ntuberculo"} />
      </Campo>
      <Campo rotulo="Observação (só para você)">
        <AreaTexto valor={observacao} aoMudar={definirObservacao} linhas={2} />
      </Campo>
      <label className="c-chip" style={{ marginTop: 10 }}>
        <input
          type="checkbox"
          checked={quantidadeLivre}
          onChange={(e) => definirQuantidadeLivre(e.target.checked)}
        />
        Quantidade livre
      </label>
      <p className="c-dica">
        Marque quando o alimento não entra em conta de porção por decisão sua — o limão, na lista de
        frutas. É diferente de deixar a porção vazia, que quer dizer &ldquo;ainda não cadastrei&rdquo;.
      </p>
      <label className="c-chip" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={ativo} onChange={(e) => definirAtivo(e.target.checked)} />
        Visível para os pacientes
      </label>

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

/**
 * Três estados, não dois: "não informado" é diferente de "tem glúten". O
 * filtro da Troca Inteligente só aparece para quem foi informado.
 */
type Trinario = "sim" | "nao" | "nao-informado";

const OPCOES_TRINARIAS: { valor: Trinario; rotulo: string }[] = [
  { valor: "nao-informado", rotulo: "Não informado" },
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
];

function trinario(valor: boolean | null | undefined): Trinario {
  if (valor === true) return "sim";
  if (valor === false) return "nao";
  return "nao-informado";
}

function deTrinario(valor: Trinario): boolean | null {
  if (valor === "sim") return true;
  if (valor === "nao") return false;
  return null;
}
