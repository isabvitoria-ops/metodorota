import { useCallback, useEffect, useState } from "react";
import type { Fase } from "@/central/types/fase";
import { repositorio } from "@/central/dados/repositorio";
import { Campo, Texto, AreaTexto } from "@/central/admin/componentes/Campos";

/**
 * As fases do método — área da nutricionista.
 *
 * NÃO HÁ FASE PRONTA nesta tela, e isso é deliberado. O Método ROTA é dela:
 * eu não sei o que cada letra significa nem o que separa uma etapa da
 * seguinte, e chutar isso seria a mesma linha que não cruzei na carta de
 * encaminhamento — o aplicativo preenche fato, não escreve conteúdo
 * clínico assinado por outra pessoa.
 *
 * APAGAR VIRA DESATIVAR quando já passou gente pela fase, e a tela diz qual
 * dos dois aconteceu em vez de supor. Apagar levaria junto o passado de
 * quem passou por ali — e "por onde esta paciente passou" é justamente o
 * que o módulo existe para guardar.
 */
export function Fases() {
  const [lista, definirLista] = useState<Fase[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [novoNome, definirNovoNome] = useState("");
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    definirCarregando(true);
    try {
      definirLista(await repositorio.listarFases());
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar as fases.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function acrescentar() {
    const nome = novoNome.trim();
    if (!nome) return;
    try {
      // A ordem nasce no fim da fila; ela reordena com as setas.
      await repositorio.salvarFase(null, nome, null, lista.length + 1, true);
      definirNovoNome("");
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui criar.");
    }
  }

  async function mover(i: number, passo: -1 | 1) {
    const aqui = lista[i];
    const la = lista[i + passo];
    if (!aqui || !la) return;
    try {
      await Promise.all([
        repositorio.salvarFase(aqui.id, aqui.nome, aqui.descricao, la.ordem, aqui.ativa),
        repositorio.salvarFase(la.id, la.nome, la.descricao, aqui.ordem, la.ativa),
      ]);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui reordenar.");
    }
  }

  async function excluir(fase: Fase) {
    try {
      const oQue = await repositorio.excluirFase(fase.id);
      // A tela diz o que ACONTECEU, e não o que foi pedido.
      definirAviso(
        oQue === "desativada"
          ? `“${fase.nome}” foi desativada em vez de apagada: já há pacientes com histórico nela, e apagar levaria esse histórico junto.`
          : `“${fase.nome}” foi apagada.`,
      );
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui excluir.");
    }
  }

  return (
    <>
      <h1 className="c-titulo">Fases do método</h1>
      <p className="c-dica">
        As etapas pelas quais suas pacientes passam, na sua ordem e com os seus nomes. Não
        existe lista pronta aqui — o método é seu. Cada mudança de fase fica registrada com
        a data, então dá para responder depois quanto tempo alguém ficou em cada etapa.
      </p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}
      {aviso && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}

      <div className="c-duas-colunas">
        <Campo rotulo="Nova fase" dica="Exemplo: Avaliação, Restrição, Reintrodução, Manutenção.">
          <Texto valor={novoNome} aoMudar={definirNovoNome} placeholder="Nome da fase" />
        </Campo>
        <Campo rotulo=" ">
          <button
            type="button"
            className="c-botao c-botao-secundario"
            disabled={!novoNome.trim()}
            onClick={() => void acrescentar()}
          >
            Acrescentar
          </button>
        </Campo>
      </div>

      {carregando && <p className="c-contagem">Carregando…</p>}

      {!carregando && lista.length === 0 && (
        <p className="c-dica">
          Nenhuma fase ainda. Escreva a primeira etapa do seu acompanhamento acima — você
          pode reordenar e renomear depois.
        </p>
      )}

      {lista.map((fase, i) => (
        <BlocoDaFase
          key={fase.id}
          fase={fase}
          primeira={i === 0}
          ultima={i === lista.length - 1}
          aoMover={(passo) => void mover(i, passo)}
          aoExcluir={() => void excluir(fase)}
          aoSalvar={carregar}
          aoErrar={definirErro}
        />
      ))}
    </>
  );
}

function BlocoDaFase({
  fase,
  primeira,
  ultima,
  aoMover,
  aoExcluir,
  aoSalvar,
  aoErrar,
}: {
  fase: Fase;
  primeira: boolean;
  ultima: boolean;
  aoMover: (passo: -1 | 1) => void;
  aoExcluir: () => void;
  aoSalvar: () => void | Promise<void>;
  aoErrar: (m: string) => void;
}) {
  const [nome, definirNome] = useState(fase.nome);
  const [descricao, definirDescricao] = useState(fase.descricao ?? "");
  const [salvando, definirSalvando] = useState(false);
  const [salvo, definirSalvo] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      aoErrar("A fase precisa de um nome.");
      return;
    }
    definirSalvando(true);
    try {
      await repositorio.salvarFase(fase.id, nome.trim(), descricao.trim() || null, fase.ordem, fase.ativa);
      definirSalvo(true);
      await aoSalvar();
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  async function alternarAtiva() {
    try {
      await repositorio.salvarFase(fase.id, fase.nome, fase.descricao, fase.ordem, !fase.ativa);
      await aoSalvar();
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : "Não consegui mudar.");
    }
  }

  return (
    <div className="c-bloco">
      <div className="c-bloco-topo">
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="c-lista-item-nome">{fase.nome}</span>
          <span className="c-lista-item-apoio">
            {fase.pacientes === 0
              ? "nenhuma paciente nesta fase agora"
              : `${fase.pacientes} ${fase.pacientes === 1 ? "paciente" : "pacientes"} agora`}
            {fase.temHistorico && " · tem histórico"}
          </span>
        </span>
        <span className="c-acoes-refeicao">
          <button type="button" className="c-link" disabled={primeira} onClick={() => aoMover(-1)}>
            ↑
          </button>
          <button type="button" className="c-link" disabled={ultima} onClick={() => aoMover(1)}>
            ↓
          </button>
        </span>
      </div>

      {!fase.ativa && (
        <p className="c-dica">
          Desativada: não aparece para colocar ninguém novo. Quem está nela continua vendo,
          porque desativar quer dizer “não coloco mais ninguém aqui”, e não “quem está some”.
        </p>
      )}

      <Campo rotulo="Nome">
        <Texto
          valor={nome}
          aoMudar={(v) => {
            definirNome(v);
            definirSalvo(false);
          }}
        />
      </Campo>
      <Campo rotulo="O que caracteriza esta fase" dica="Aparece para a paciente. Opcional.">
        <AreaTexto
          valor={descricao}
          aoMudar={(v) => {
            definirDescricao(v);
            definirSalvo(false);
          }}
          linhas={2}
        />
      </Campo>

      <div className="c-chips">
        <button type="button" className="c-chip" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : salvo ? "Salvo" : "Salvar"}
        </button>
        <button type="button" className="c-chip" onClick={() => void alternarAtiva()}>
          {fase.ativa ? "Desativar" : "Reativar"}
        </button>
        <button type="button" className="c-chip" onClick={aoExcluir}>
          {/* O rótulo diz a verdade ANTES do clique: com histórico, excluir
              desativa. Um botão "Excluir" que desativa seria mentira. */}
          {fase.temHistorico ? "Excluir (vai desativar)" : "Excluir"}
        </button>
      </div>
    </div>
  );
}
