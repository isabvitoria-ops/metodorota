import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { Esqueleto } from "@/central/components/Esqueleto";
import { Icone } from "@/central/components/Icone";
import type { Notificacao, TipoDeNotificacao } from "@/central/types/notificacao";
import { destino, frase, ICONE_DO_TIPO, quandoCurto } from "@/central/utils/notificacoes";

/**
 * O que as pacientes fizeram, numa lista só (0098): rastreio, foto, check-in,
 * treino, cardio, meta, mensagem, desafio, exame, viagem. Abrir a tela marca
 * tudo como visto; o que era novo continua destacado até ela sair.
 */
const FILTROS: { rotulo: string; tipos: TipoDeNotificacao[] | null }[] = [
  { rotulo: "Tudo", tipos: null },
  { rotulo: "Rastreio", tipos: ["rastreio"] },
  { rotulo: "Fotos", tipos: ["foto"] },
  { rotulo: "Check-in", tipos: ["checkin"] },
  { rotulo: "Treino", tipos: ["treino", "cardio"] },
  { rotulo: "Mensagens", tipos: ["mensagem"] },
  { rotulo: "Outros", tipos: ["meta", "desafio", "exame", "viagem"] },
];

export function Notificacoes() {
  const [lista, definirLista] = useState<Notificacao[] | null>(null);
  const [erroCarga, definirErroCarga] = useState(false);
  const [filtro, definirFiltro] = useState(0);

  const carregar = useCallback(async () => {
    try {
      definirLista(await repositorio.notificacoesDaNutri(14));
      definirErroCarga(false);
      await repositorio.marcarNotificacoesVistas();
      window.dispatchEvent(new Event("central:notificacoes-vistas"));
    } catch {
      definirErroCarga(true);
      definirLista([]);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const tipos = FILTROS[filtro]?.tipos ?? null;
  const visiveis = (lista ?? []).filter((n) => !tipos || tipos.includes(n.tipo));
  const novas = (lista ?? []).filter((n) => n.nova).length;

  return (
    <div className="c-notif">
      <div>
        <h1 className="c-titulo">Notificações</h1>
        <p className="c-subtitulo">
          O que as pacientes fizeram nos últimos 14 dias.
          {novas > 0 && ` ${novas === 1 ? "1 novidade" : `${novas} novidades`} desde a última vez.`}
        </p>
      </div>

      <div className="c-chips" role="group" aria-label="Filtrar">
        {FILTROS.map((f, i) => (
          <button key={f.rotulo} type="button" className="c-chip" aria-pressed={filtro === i} onClick={() => definirFiltro(i)}>
            {f.rotulo}
          </button>
        ))}
      </div>

      {erroCarga && (
        <div className="c-aviso c-aviso-erro" role="alert">
          Não consegui carregar as notificações. Recarregue a página.
        </div>
      )}

      {lista === null ? (
        <Esqueleto linhas={6} />
      ) : visiveis.length === 0 && !erroCarga ? (
        <p className="c-dica">Nada por aqui nos últimos 14 dias.</p>
      ) : (
        <ul className="c-notif-lista">
          {visiveis.map((n, i) => (
            <li key={`${n.tipo}-${n.pacienteId}-${n.quando}-${i}`}>
              <Link to={destino(n)} className={`c-notif-item ${n.nova ? "c-notif-nova" : ""}`}>
                <span className="c-notif-icone" aria-hidden="true">
                  <Icone nome={ICONE_DO_TIPO[n.tipo]} tamanho={18} />
                </span>
                <span className="c-notif-texto">
                  {frase(n)}
                  <span className="c-notif-quando">{quandoCurto(n.quando)}</span>
                </span>
                {n.nova && <span className="c-notif-ponto" aria-label="Nova" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
