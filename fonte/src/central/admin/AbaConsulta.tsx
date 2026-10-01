import { useEffect, useRef, useState } from "react";
import type { Consulta } from "@/central/types/consulta";
import { repositorio } from "@/central/dados/repositorio";
import { AreaTexto, Campo } from "@/central/admin/componentes/Campos";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import { apagarRascunho, chaveDoRascunho, guardarRascunho, lerRascunho } from "@/central/utils/rascunho";
import {
  anotacaoDeHoje,
  comNovaAnotacao,
  consultasAnteriores,
  dataEHora,
  horaSaoPaulo,
} from "@/central/utils/consultas";

const SITUACAO: Record<Consulta["status"], string | null> = {
  concluida: null,
  agendada: "agendada",
  faltou: "faltou",
  cancelada: "cancelada",
};

/**
 * Anotar a consulta enquanto ela acontece.
 *
 * Um campo e um botão: data e hora saem do relógio, e o tipo sai do
 * histórico (a primeira é "primeira", as outras são retorno). Quem quiser
 * mudar data, tipo ou situação faz isso no Histórico, onde está o editor
 * completo.
 */
export function AbaConsulta({
  pacienteId,
  consultas,
  aoMudar,
}: {
  pacienteId: string;
  consultas: Consulta[];
  aoMudar: () => Promise<void>;
}) {
  const hoje = hojeSaoPaulo();
  const chave = chaveDoRascunho("consulta", pacienteId);
  const guarda = typeof window === "undefined" ? null : window.localStorage;
  // O que ela digitou e não salvou volta sozinho: fechar a aba no meio não perde a anotação.
  const recuperado = useRef(lerRascunho(guarda, chave));
  const [texto, definirTexto] = useState(recuperado.current);
  const [avisoRecuperado, definirAvisoRecuperado] = useState(recuperado.current.trim() !== "");
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const anteriores = consultasAnteriores(consultas, hoje);

  // Rascunho automático: meio segundo depois da última tecla.
  useEffect(() => {
    const espera = window.setTimeout(() => guardarRascunho(guarda, chave, texto), 500);
    return () => window.clearTimeout(espera);
  }, [texto, chave, guarda]);

  // Se há texto não salvo, o navegador pergunta antes de fechar ou recarregar.
  useEffect(() => {
    if (!texto.trim()) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [texto]);

  async function salvar() {
    if (!texto.trim()) return;
    definirSalvando(true);
    definirAviso(null);
    try {
      const { id, dados } = anotacaoDeHoje(consultas, texto, hoje, horaSaoPaulo());
      await repositorio.salvarConsulta(id, pacienteId, dados);
      apagarRascunho(guarda, chave);
      definirTexto("");
      definirAvisoRecuperado(false);
      await aoMudar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <>
      <section className="c-bloco c-anotar-consulta">
        <h2 className="c-secao-titulo">Anotar consulta / atendimento</h2>
        <Campo
          rotulo="Observações da consulta"
          dica={
            texto.trim()
              ? "Só você vê. Rascunho guardado automaticamente neste aparelho até você salvar."
              : "Só você vê. A paciente não alcança estas anotações."
          }
        >
          <AreaTexto
            valor={texto}
            aoMudar={definirTexto}
            linhas={5}
            placeholder="Registre as observações do atendimento: evolução, ajustes na dieta, queixas, orientações…"
          />
        </Campo>

        {avisoRecuperado && (
          <div className="c-aviso" role="status">
            <span>Recuperei o que você tinha digitado e não salvou. Confira e salve quando quiser.</span>
          </div>
        )}

        {aviso && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>{aviso}</span>
          </div>
        )}

        <div className="c-barra-acoes" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="c-botao c-botao-pequeno"
            disabled={salvando || !texto.trim()}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando…" : "Salvar consulta"}
          </button>
        </div>
      </section>

      <section className="c-secao">
        <h2 className="c-secao-titulo">Consultas anteriores</h2>
        {anteriores.length === 0 ? (
          <p className="c-dica">Nenhuma consulta registrada ainda.</p>
        ) : (
          <div className="c-lista-consultas">
            {anteriores.map((c) => (
              <CartaoDeConsulta key={c.id} consulta={c} pacienteId={pacienteId} aoMudar={aoMudar} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function CartaoDeConsulta({
  consulta,
  pacienteId,
  aoMudar,
}: {
  consulta: Consulta;
  pacienteId: string;
  aoMudar: () => Promise<void>;
}) {
  const [editando, definirEditando] = useState(false);
  const [texto, definirTexto] = useState(consulta.observacoes ?? "");
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const situacao = SITUACAO[consulta.status];

  async function salvar() {
    definirSalvando(true);
    definirAviso(null);
    try {
      await repositorio.salvarConsulta(consulta.id, pacienteId, comNovaAnotacao(consulta, texto));
      definirEditando(false);
      await aoMudar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <article className="c-bloco c-cartao-consulta">
      <header className="c-cartao-consulta-topo">
        <span>
          {dataEHora(consulta)}
          {situacao && <span className="c-evento-marca" style={{ marginLeft: 8 }}>{situacao}</span>}
        </span>
        {!editando && (
          <button
            type="button"
            className="c-icone-botao"
            aria-label="Editar anotação"
            title="Editar anotação"
            onClick={() => {
              definirTexto(consulta.observacoes ?? "");
              definirEditando(true);
            }}
          >
            ✎
          </button>
        )}
      </header>

      {consulta.resumo && <p className="c-cartao-consulta-resumo">{consulta.resumo}</p>}

      {editando ? (
        <>
          <AreaTexto valor={texto} aoMudar={definirTexto} linhas={4} />
          {aviso && (
            <div className="c-aviso c-aviso-erro" role="alert">
              <span>{aviso}</span>
            </div>
          )}
          <div className="c-barra-acoes" style={{ justifyContent: "flex-end", alignItems: "center" }}>
            <button
              type="button"
              className="c-icone-botao"
              aria-label="Cancelar"
              title="Cancelar"
              disabled={salvando}
              onClick={() => definirEditando(false)}
            >
              ✕
            </button>
            <button
              type="button"
              className="c-botao c-botao-pequeno"
              disabled={salvando}
              onClick={() => void salvar()}
            >
              {salvando ? "Salvando…" : "✓ Salvar"}
            </button>
          </div>
        </>
      ) : consulta.observacoes ? (
        <p className="c-cartao-consulta-texto">{consulta.observacoes}</p>
      ) : (
        <p className="c-dica">Sem anotação.</p>
      )}
    </article>
  );
}
