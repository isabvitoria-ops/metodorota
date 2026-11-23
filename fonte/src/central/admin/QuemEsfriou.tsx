import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";
import type { Cobranca } from "@/central/types/financeiro";
import type { PacienteQueEsfriou } from "@/central/types/quemEsfriou";
import { linkDoWhatsapp, mensagemDeCobranca } from "@/central/utils/cobranca";
import { mensagemDeOi, motivos, precisaDeOi, textoDoUltimoRegistro } from "@/central/utils/quemEsfriou";
import { hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * Quem esfriou (lote 3, regras dela em 23/11/2026), no topo de Pacientes.
 *
 * "Precisa de um oi": check-in com prazo vencido, reintrodução parada e
 * cobrança vencida, cada um com o WhatsApp aberto na mensagem certa (ela
 * revisa e envia; nada sai sozinho). "Sem retorno marcado" é só um aviso
 * para ela, sem botão de mensagem: nem toda paciente precisa de consulta
 * todo mês.
 */
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function QuemEsfriou() {
  const { configuracoes } = useSessao();
  const [lista, definirLista] = useState<PacienteQueEsfriou[] | null>(null);
  const [verSemRetorno, definirVerSemRetorno] = useState(false);

  useEffect(() => {
    let vivo = true;
    repositorio
      .quemEsfriou()
      .then((l) => vivo && definirLista(l))
      .catch(() => vivo && definirLista([]));
    return () => {
      vivo = false;
    };
  }, []);

  if (!lista) return null;
  const hoje = hojeSaoPaulo();
  const oi = lista.filter(precisaDeOi);
  const semRetorno = lista.filter((p) => p.semRetorno);
  if (oi.length === 0 && semRetorno.length === 0) return null;

  const linkDaCobranca = (p: PacienteQueEsfriou) => {
    const c = p.cobrancas[0];
    if (!c) return null;
    const cobranca = { paciente: p.nome, competencia: c.competencia, valor: c.valor, vencimento: c.vencimento } as Cobranca;
    return linkDoWhatsapp(
      p.telefone,
      mensagemDeCobranca(cobranca, { nomeCentral: configuracoes.nomeCentral, chavePix: configuracoes.chavePix }),
    );
  };

  return (
    <section className="c-esfriou" aria-label="Quem esfriou">
      {oi.length > 0 && (
        <>
          <h2 className="c-esfriou-titulo">Precisa de um oi · {oi.length}</h2>
          <ul className="c-esfriou-lista">
            {oi.map((p) => {
              const temOi = p.checkins.length > 0 || p.reintroducao !== null;
              const linkOi = temOi ? linkDoWhatsapp(p.telefone, mensagemDeOi()) : null;
              const linkCobrar = linkDaCobranca(p);
              return (
                <li key={p.id}>
                  <strong>{p.nome}</strong>
                  {motivos(p).map((m) => (
                    <small key={m}>{m}</small>
                  ))}
                  <small>Último registro: {textoDoUltimoRegistro(p.ultimoRegistro, hoje)}</small>
                  <div className="c-esfriou-acoes">
                    {linkOi && (
                      <a className="c-chip" href={linkOi} target="_blank" rel="noreferrer">
                        Mandar mensagem
                      </a>
                    )}
                    {linkCobrar && (
                      <a className="c-chip" href={linkCobrar} target="_blank" rel="noreferrer">
                        Cobrar no WhatsApp
                      </a>
                    )}
                    {!p.telefone && <small className="c-esfriou-falta">Falta o telefone no cadastro.</small>}
                    <Link className="c-chip" to={rotas.adminProntuario(p.id)}>
                      Abrir ficha
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {semRetorno.length > 0 && (
        <div className="c-esfriou-retorno">
          <button type="button" className="c-link" aria-expanded={verSemRetorno} onClick={() => definirVerSemRetorno((v) => !v)}>
            Sem retorno marcado · {semRetorno.length} {verSemRetorno ? "(esconder)" : "(ver quem)"}
          </button>
          {verSemRetorno && (
            <ul className="c-esfriou-nomes">
              {semRetorno.map((p) => (
                <li key={p.id}>
                  <Link to={rotas.adminProntuario(p.id)}>{p.nome}</Link>
                  <small>
                    {p.ultimaConsulta ? ` · última consulta em ${ddmm(p.ultimaConsulta)}` : " · nenhuma consulta concluída"}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
