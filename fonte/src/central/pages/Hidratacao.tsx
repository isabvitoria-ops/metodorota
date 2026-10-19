import { useCallback, useEffect, useState } from "react";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";
import { repositorio } from "@/central/dados/repositorio";
import type { MinhaHidratacao, RegistroHidratacao, TipoLiquido } from "@/central/types/hidratacao";
import { Esqueleto } from "@/central/components/Esqueleto";

const COPOS: { ml: number; rotulo: string; emoji: string }[] = [
  { ml: 150, rotulo: "150 mL", emoji: "🥤" },
  { ml: 200, rotulo: "200 mL", emoji: "🥤" },
  { ml: 250, rotulo: "250 mL", emoji: "🥛" },
  { ml: 300, rotulo: "300 mL", emoji: "🥛" },
  { ml: 500, rotulo: "500 mL", emoji: "🧴" },
];

const TIPOS: { valor: TipoLiquido; rotulo: string }[] = [
  { valor: "agua", rotulo: "Água" },
  { valor: "cha", rotulo: "Chá" },
  { valor: "suco", rotulo: "Suco" },
  { valor: "outro", rotulo: "Outro" },
];

function porcentagem(atual: number, meta: number): number {
  if (meta <= 0) return 0;
  return Math.min(Math.round((atual / meta) * 100), 100);
}

function horario(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function tipoRotulo(tipo: TipoLiquido): string {
  const m: Record<TipoLiquido, string> = { agua: "Água", cha: "Chá", suco: "Suco", outro: "Outro" };
  return m[tipo] ?? tipo;
}

export function Hidratacao() {
  const [dados, definirDados] = useState<MinhaHidratacao | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [tipo, definirTipo] = useState<TipoLiquido>("agua");
  const [salvando, definirSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const d = await repositorio.minhaHidratacao();
      definirDados(d);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const registrar = async (ml: number) => {
    if (salvando) return;
    definirSalvando(true);
    try {
      await repositorio.registrarHidratacao(ml, tipo);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Erro ao registrar.");
    } finally {
      definirSalvando(false);
    }
  };

  const desfazer = async (id: string) => {
    try {
      await repositorio.desfazerHidratacao(id);
      await carregar();
    } catch {
      /* silêncio: desfazer não é crítico */
    }
  };

  const totalHoje = dados?.hoje.reduce((s, r) => s + r.ml, 0) ?? 0;
  const meta = dados?.metaMl ?? 0;
  const pct = meta > 0 ? porcentagem(totalHoje, meta) : 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Hidratação"
        descricao="Registre o que você bebeu ao longo do dia."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        {carregando ? (
          <Esqueleto linhas={6} />
        ) : erro ? (
          <p className="c-erro">{erro}</p>
        ) : (
          <>
            {/* Progresso circular */}
            <div className="c-hidrata-progresso">
              <svg viewBox="0 0 120 120" className="c-hidrata-anel">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dashoffset 0.4s ease" }}
                />
              </svg>
              <div className="c-hidrata-centro">
                <span className="c-hidrata-total">{totalHoje}</span>
                <span className="c-hidrata-unidade">mL</span>
                {meta > 0 && (
                  <span className="c-hidrata-meta">de {meta} mL</span>
                )}
              </div>
            </div>

            {meta > 0 && (
              <p className="c-hidrata-pct" aria-live="polite">
                {pct >= 100
                  ? "Meta atingida! 🎉"
                  : `${pct}% da meta de hoje`}
              </p>
            )}

            {meta === 0 && (
              <p className="c-dica" style={{ textAlign: "center", marginTop: 8 }}>
                Sua nutricionista ainda não definiu uma meta de hidratação.
                Registre normalmente — ela ajusta quando quiser.
              </p>
            )}

            {/* Tipo de líquido */}
            <div className="c-hidrata-tipos">
              {TIPOS.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  className="c-chip"
                  aria-pressed={tipo === t.valor}
                  onClick={() => definirTipo(t.valor)}
                >
                  {t.rotulo}
                </button>
              ))}
            </div>

            {/* Botões rápidos */}
            <div className="c-hidrata-copos">
              {COPOS.map((c) => (
                <button
                  key={c.ml}
                  type="button"
                  className="c-hidrata-copo"
                  disabled={salvando}
                  onClick={() => void registrar(c.ml)}
                >
                  <span className="c-hidrata-copo-emoji" aria-hidden="true">{c.emoji}</span>
                  <span className="c-hidrata-copo-ml">{c.rotulo}</span>
                </button>
              ))}
            </div>

            {/* Registros de hoje */}
            {dados && dados.hoje.length > 0 && (
              <section className="c-secao" aria-label="Registros de hoje">
                <h2 className="c-secao-titulo">Hoje</h2>
                <ul className="c-hidrata-registros">
                  {dados.hoje.map((r: RegistroHidratacao) => (
                    <li key={r.id} className="c-hidrata-registro">
                      <span className="c-hidrata-registro-info">
                        <strong>{r.ml} mL</strong>
                        <span className="c-hidrata-registro-tipo">{tipoRotulo(r.tipo)}</span>
                        <span className="c-hidrata-registro-hora">{horario(r.criadoEm)}</span>
                      </span>
                      <button
                        type="button"
                        className="c-hidrata-desfazer"
                        aria-label={`Desfazer ${r.ml} mL`}
                        onClick={() => void desfazer(r.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Histórico recente */}
            {dados && dados.historico.length > 0 && (
              <section className="c-secao" aria-label="Últimos 30 dias">
                <h2 className="c-secao-titulo">Últimos dias</h2>
                <div className="c-hidrata-historico">
                  {dados.historico.map((d) => {
                    const pctDia = meta > 0 ? porcentagem(d.totalMl, meta) : 0;
                    return (
                      <div key={d.data} className="c-hidrata-dia">
                        <div
                          className="c-hidrata-barra"
                          style={{ height: `${meta > 0 ? Math.max(pctDia, 4) : 50}%` }}
                          title={`${d.totalMl} mL`}
                        />
                        <span className="c-hidrata-dia-label">
                          {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
