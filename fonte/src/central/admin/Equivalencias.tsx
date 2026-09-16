import { useMemo, useState } from "react";
import type { Equivalencia } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { repositorio } from "@/central/dados/repositorio";
import { gerarIdentificador, useCatalogo } from "@/central/hooks/useCatalogo";
import { BarraBusca } from "@/central/components/BarraBusca";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { normalizar, numero } from "@/central/utils/texto";
import { Modal } from "./componentes/Modal";
import { AreaTexto, Campo, Selecao, Texto } from "./componentes/Campos";

/**
 * Equivalências (§42 do briefing).
 *
 * Vale lembrar na própria tela: só é preciso cadastrar aqui quando a troca
 * NÃO for a razão entre as porções dos dois alimentos. Grupos que trabalham
 * em porções já geram todas as combinações sozinhos — cadastrar par a par
 * seria trabalho repetido e mais uma chance de erro de digitação.
 */
export function Equivalencias() {
  const versao = useCatalogo((e) => e.versao);
  const [consulta, definirConsulta] = useState("");
  const [editando, definirEditando] = useState<Equivalencia | "nova" | null>(null);

  const lista = useMemo(() => {
    void versao;
    const termo = normalizar(consulta);
    return catalogo.equivalenciasCadastradas().filter((e) => {
      if (!termo) return true;
      const origem = catalogo.alimento(e.origemAlimentoId)?.nome ?? "";
      const destino = catalogo.alimento(e.destinoAlimentoId)?.nome ?? "";
      return normalizar(origem).includes(termo) || normalizar(destino).includes(termo);
    });
  }, [consulta, versao]);

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Equivalências
      </h1>
      <p className="c-subtitulo">
        Cadastre aqui só as trocas que têm um valor próprio. Dentro de um grupo que trabalha em
        porções, as trocas saem sozinhas da porção de cada alimento.
      </p>

      <div className="c-barra-acoes">
        <BarraBusca valor={consulta} aoMudar={definirConsulta} placeholder="Buscar por alimento" rotulo="Buscar equivalência" />
        <button type="button" className="c-botao c-botao-pequeno" onClick={() => definirEditando("nova")}>
          Nova equivalência
        </button>
      </div>

      {lista.length === 0 ? (
        <EstadoVazio
          icone="troca"
          titulo="Nenhuma equivalência específica"
          descricao="As trocas dentro de cada grupo continuam funcionando pelas porções dos alimentos."
        />
      ) : (
        <div className="c-tabela">
          {lista.map((equivalencia) => (
            <div className="c-tabela-linha" key={equivalencia.id}>
              <button type="button" className="c-tabela-alvo" onClick={() => definirEditando(equivalencia)}>
                <span style={{ flex: 1, minWidth: 200 }}>
                  <span className="c-tabela-nome">{descrever(equivalencia)}</span>
                  <span className="c-tabela-apoio">
                    {equivalencia.ativo ? "" : "Oculta · "}
                    {equivalencia.bidirecional ? "Vale nos dois sentidos" : "Só neste sentido"}
                    {equivalencia.fonte ? ` · ${equivalencia.fonte}` : ""}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <ModalEquivalencia
          equivalencia={editando === "nova" ? null : editando}
          aoFechar={() => definirEditando(null)}
        />
      )}
    </>
  );
}

function descrever(equivalencia: Equivalencia): string {
  const origem = catalogo.alimento(equivalencia.origemAlimentoId)?.nome ?? equivalencia.origemAlimentoId;
  const destino = catalogo.alimento(equivalencia.destinoAlimentoId)?.nome ?? equivalencia.destinoAlimentoId;
  if (equivalencia.regra.tipo === "proporcional") {
    const de = equivalencia.regra.de;
    const para = equivalencia.regra.para;
    return `${numero(de.quantidade)} ${de.unidadeId} de ${origem} = ${numero(para.quantidade)} ${para.unidadeId} de ${destino}`;
  }
  if (equivalencia.regra.tipo === "tabela") {
    return `${origem} → ${destino} (tabela com ${equivalencia.regra.pontos.length} pontos)`;
  }
  return `${origem} → ${destino} (quantidade fixa)`;
}

function ModalEquivalencia({
  equivalencia,
  aoFechar,
}: {
  equivalencia: Equivalencia | null;
  aoFechar: () => void;
}) {
  const { comSalvamento, salvando, erro } = useCatalogo();
  const alimentos = catalogo.alimentos();
  const proporcional = equivalencia?.regra.tipo === "proporcional" ? equivalencia.regra : null;

  const [origemId, definirOrigem] = useState(equivalencia?.origemAlimentoId ?? alimentos[0]?.id ?? "");
  const [destinoId, definirDestino] = useState(equivalencia?.destinoAlimentoId ?? alimentos[1]?.id ?? "");
  const [quantidadeOrigem, definirQuantidadeOrigem] = useState(
    proporcional ? String(proporcional.de.quantidade) : "100",
  );
  const [unidadeOrigem, definirUnidadeOrigem] = useState(proporcional?.de.unidadeId ?? "g");
  const [quantidadeDestino, definirQuantidadeDestino] = useState(
    proporcional ? String(proporcional.para.quantidade) : "",
  );
  const [unidadeDestino, definirUnidadeDestino] = useState(proporcional?.para.unidadeId ?? "g");
  const [bidirecional, definirBidirecional] = useState(equivalencia?.bidirecional ?? true);
  const [ativa, definirAtiva] = useState(equivalencia?.ativo ?? true);
  const [fonte, definirFonte] = useState(equivalencia?.fonte ?? "Lista de substituição");
  const [observacao, definirObservacao] = useState(equivalencia?.observacao ?? "");
  const [aviso, definirAviso] = useState<string | null>(null);

  const naoProporcional = equivalencia && equivalencia.regra.tipo !== "proporcional";

  async function salvar() {
    const de = Number(quantidadeOrigem.replace(",", "."));
    const para = Number(quantidadeDestino.replace(",", "."));
    if (origemId === destinoId) return definirAviso("Escolha dois alimentos diferentes.");
    if (!Number.isFinite(de) || de <= 0) return definirAviso("A quantidade do primeiro alimento precisa ser maior que zero.");
    if (!Number.isFinite(para) || para <= 0) return definirAviso("A quantidade do segundo alimento precisa ser maior que zero.");

    const nova: Equivalencia = {
      id: equivalencia?.id ?? gerarIdentificador(`${origemId}-para-${destinoId}`),
      origemAlimentoId: origemId,
      destinoAlimentoId: destinoId,
      regra: {
        tipo: "proporcional",
        de: { quantidade: de, unidadeId: unidadeOrigem },
        para: { quantidade: para, unidadeId: unidadeDestino },
      },
      bidirecional,
      fonte: fonte.trim() || null,
      observacao: observacao.trim() || null,
      ativo: ativa,
    };

    const deuCerto = await comSalvamento(() => repositorio.salvarEquivalencia(nova, ativa));
    if (deuCerto) aoFechar();
  }

  if (alimentos.length < 2) {
    return (
      <Modal titulo="Nova equivalência" aoFechar={aoFechar}>
        <p className="c-dica" style={{ marginTop: 14 }}>
          Cadastre pelo menos dois alimentos antes de criar uma equivalência.
        </p>
        <div className="c-modal-acoes">
          <button type="button" className="c-botao" onClick={aoFechar}>
            Entendi
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo={equivalencia ? "Editar equivalência" : "Nova equivalência"} aoFechar={aoFechar}>
      {naoProporcional && (
        <div className="c-aviso" role="status" style={{ marginTop: 12 }}>
          <span>
            Esta equivalência usa uma regra que não é proporcional. Editar por aqui vai convertê-la
            em proporcional. Para manter a regra atual, edite direto no banco.
          </span>
        </div>
      )}

      <Campo rotulo="Alimento">
        <Selecao
          valor={origemId}
          aoMudar={definirOrigem}
          opcoes={alimentos.map((a) => ({ valor: a.id, rotulo: a.nome }))}
        />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="Quantidade">
          <Texto valor={quantidadeOrigem} aoMudar={definirQuantidadeOrigem} placeholder="100" />
        </Campo>
        <Campo rotulo="Unidade">
          <Selecao
            valor={unidadeOrigem}
            aoMudar={definirUnidadeOrigem}
            opcoes={catalogo.unidades().map((u) => ({ valor: u.id, rotulo: u.rotulo }))}
          />
        </Campo>
      </div>

      <p className="c-rotulo" style={{ marginTop: 18 }}>
        equivale a
      </p>

      <Campo rotulo="Alimento">
        <Selecao
          valor={destinoId}
          aoMudar={definirDestino}
          opcoes={alimentos.map((a) => ({ valor: a.id, rotulo: a.nome }))}
        />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="Quantidade">
          <Texto valor={quantidadeDestino} aoMudar={definirQuantidadeDestino} placeholder="80" />
        </Campo>
        <Campo rotulo="Unidade">
          <Selecao
            valor={unidadeDestino}
            aoMudar={definirUnidadeDestino}
            opcoes={catalogo.unidades().map((u) => ({ valor: u.id, rotulo: u.rotulo }))}
          />
        </Campo>
      </div>

      <label className="c-chip" style={{ marginTop: 14 }}>
        <input
          type="checkbox"
          checked={bidirecional}
          onChange={(e) => definirBidirecional(e.target.checked)}
        />
        Vale nos dois sentidos
      </label>

      <label className="c-chip" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={ativa} onChange={(e) => definirAtiva(e.target.checked)} />
        No ar para os pacientes
      </label>

      <Campo rotulo="Fonte">
        <Texto valor={fonte} aoMudar={definirFonte} placeholder="Lista de substituição" />
      </Campo>
      <Campo rotulo="Observação">
        <AreaTexto valor={observacao} aoMudar={definirObservacao} linhas={2} />
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
