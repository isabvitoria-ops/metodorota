import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { Esqueleto } from "@/central/components/Esqueleto";
import { Icone, IconeCoracaoCheio } from "@/central/components/Icone";
import type { FotoDoFeed } from "@/central/types/notificacao";
import { rotuloDaRefeicao } from "@/central/utils/diarioDeFotos";
import { nomeCurto, quandoCurto } from "@/central/utils/notificacoes";

/**
 * As fotos do diário de TODAS as pacientes, da mais nova para a mais velha
 * (0098). Ela pediu um lugar só, como um feed, para não abrir ficha por ficha.
 * O nome leva para o diário daquela paciente.
 */
const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "3 meses" },
];

export function FeedDeFotos() {
  const [dias, definirDias] = useState(7);
  const [fotos, definirFotos] = useState<FotoDoFeed[] | null>(null);
  const [erroCarga, definirErroCarga] = useState(false);
  const [paciente, definirPaciente] = useState("");

  const carregar = useCallback(async () => {
    definirFotos(null);
    try {
      definirFotos(await repositorio.diarioDeTodas(dias));
      definirErroCarga(false);
    } catch {
      definirErroCarga(true);
      definirFotos([]);
    }
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const pacientes = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fotos ?? []) m.set(f.pacienteId, f.pacienteNome);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [fotos]);

  const visiveis = (fotos ?? []).filter((f) => !paciente || f.pacienteId === paciente);

  async function curtir(foto: FotoDoFeed) {
    const curtida = await repositorio.curtirFoto(foto.id, !foto.curtida).catch(() => foto.curtida);
    definirFotos((l) => l?.map((f) => (f.id === foto.id ? { ...f, curtida } : f)) ?? l);
  }

  return (
    <div className="c-feed">
      <div>
        <h1 className="c-titulo">Daily dos pacientes</h1>
        <p className="c-subtitulo">O diário de fotos de todos, da mais nova para a mais antiga.</p>
      </div>

      <div className="c-feed-filtros">
        <div className="c-chips" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              className="c-chip"
              aria-pressed={dias === p.dias}
              onClick={() => definirDias(p.dias)}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        {pacientes.length > 1 && (
          <select
            className="c-campo c-feed-paciente"
            value={paciente}
            onChange={(e) => definirPaciente(e.target.value)}
            aria-label="Filtrar por paciente"
          >
            <option value="">Todos os pacientes</option>
            {pacientes.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {erroCarga && (
        <div className="c-aviso c-aviso-erro" role="alert">
          Não consegui carregar as fotos. Recarregue a página.
        </div>
      )}

      {fotos === null ? (
        <Esqueleto linhas={6} />
      ) : visiveis.length === 0 && !erroCarga ? (
        <p className="c-dica">Nenhuma foto nesse período.</p>
      ) : (
        <div className="c-feed-grade">
          {visiveis.map((f) => (
            <CartaoDoFeed key={f.id} foto={f} aoCurtir={() => void curtir(f)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoDoFeed({ foto, aoCurtir }: { foto: FotoDoFeed; aoCurtir: () => void }) {
  const [endereco, definirEndereco] = useState<string | null>(null);
  const [falhou, definirFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    repositorio
      .enderecoDaFoto(foto.caminho)
      .then((e) => ativo && definirEndereco(e))
      .catch(() => ativo && definirFalhou(true));
    return () => {
      ativo = false;
    };
  }, [foto.caminho]);

  return (
    <article className="c-feed-cartao">
      <header className="c-feed-topo">
        <span className="c-feed-inicial" aria-hidden="true">
          {foto.pacienteNome.trim().charAt(0).toUpperCase()}
        </span>
        <div className="c-feed-quem">
          <Link to={`${rotas.adminProntuario(foto.pacienteId)}?aba=diario`} className="c-feed-nome">
            {nomeCurto(foto.pacienteNome)}
          </Link>
          <span className="c-feed-quando">
            {rotuloDaRefeicao(foto.refeicao)} · {quandoCurto(foto.criadoEm)}
          </span>
        </div>
      </header>
      {endereco ? (
        <img className="c-feed-foto" src={endereco} alt={`${rotuloDaRefeicao(foto.refeicao)} de ${foto.pacienteNome}`} loading="lazy" />
      ) : (
        <div className="c-feed-foto c-feed-foto-vazia">{falhou ? "Não consegui abrir esta foto." : "Carregando…"}</div>
      )}
      <div className="c-feed-corpo">
        <button type="button" className="c-chip c-diario-curtir" aria-pressed={foto.curtida} onClick={aoCurtir}>
          {foto.curtida ? <IconeCoracaoCheio tamanho={16} /> : <Icone nome="coracao" tamanho={16} />}
          {foto.curtida ? "Curtida" : "Curtir"}
        </button>
        {foto.legenda && <p className="c-feed-legenda">{foto.legenda}</p>}
      </div>
    </article>
  );
}
