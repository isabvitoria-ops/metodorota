import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";
import type { Cobranca } from "@/central/types/financeiro";
import type { PacienteQueEsfriou } from "@/central/types/quemEsfriou";
import { linkDoWhatsapp, mensagemDeCobranca } from "@/central/utils/cobranca";
import {
  assinaturaDoOi,
  mensagemDeOi,
  motivos,
  precisaDeOi,
  separarResolvidos,
  textoDoUltimoRegistro,
  type ComoResolveu,
  type MarcaDoOi,
} from "@/central/utils/quemEsfriou";
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

/**
 * As marcas de "Feito" e "Ignorar" moram no banco (0108, só dela), para
 * valerem no computador e no celular. Na primeira versão elas ficavam no
 * navegador, nesta chave: o que estiver aqui sobe para o banco uma vez e
 * sai do navegador.
 */
const CHAVE_ANTIGA = "marvia-quem-esfriou-marcas";

function marcasAntigas(): Record<string, MarcaDoOi> {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_ANTIGA) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, MarcaDoOi>) : {};
  } catch {
    return {};
  }
}

async function carregarMarcas(): Promise<Record<string, MarcaDoOi>> {
  const doBanco = await repositorio.marcasQuemEsfriou();
  const antigas = marcasAntigas();
  const faltam = Object.entries(antigas).filter(([id]) => !doBanco[id]);
  for (const [id, marca] of faltam) {
    await repositorio.marcarQuemEsfriou(id, marca);
    doBanco[id] = marca;
  }
  try {
    localStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    /* nada a limpar */
  }
  return doBanco;
}

export function QuemEsfriou() {
  const { configuracoes } = useSessao();
  const [lista, definirLista] = useState<PacienteQueEsfriou[] | null>(null);
  const [verSemRetorno, definirVerSemRetorno] = useState(false);
  const [marcas, definirMarcas] = useState<Record<string, MarcaDoOi>>({});
  const [verResolvidos, definirVerResolvidos] = useState(false);
  const [avisoDaMarca, definirAvisoDaMarca] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    repositorio
      .quemEsfriou()
      .then((l) => vivo && definirLista(l))
      .catch(() => vivo && definirLista([]));
    carregarMarcas()
      .then((m) => vivo && definirMarcas(m))
      .catch(() => vivo && definirAvisoDaMarca("Não consegui carregar o que você marcou como feito ou ignorado."));
    return () => {
      vivo = false;
    };
  }, []);

  if (!lista) return null;
  const hoje = hojeSaoPaulo();
  const { pendentes: oi, resolvidos } = separarResolvidos(lista.filter(precisaDeOi), marcas);
  const semRetorno = lista.filter((p) => p.semRetorno);
  if (oi.length === 0 && resolvidos.length === 0 && semRetorno.length === 0) return null;

  // A tela muda na hora; se o banco recusar, volta como estava e avisa.
  function trocar(id: string, marca: MarcaDoOi | null) {
    const antes = marcas;
    const novas = { ...marcas };
    if (marca) novas[id] = marca;
    else delete novas[id];
    definirMarcas(novas);
    definirAvisoDaMarca(null);
    repositorio.marcarQuemEsfriou(id, marca).catch(() => {
      definirMarcas(antes);
      definirAvisoDaMarca("Não consegui guardar. Confira a internet e tente de novo.");
    });
  }

  const marcar = (p: PacienteQueEsfriou, como: ComoResolveu) =>
    trocar(p.id, { assinatura: assinaturaDoOi(p), como, em: hoje });
  const desfazer = (id: string) => trocar(id, null);

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
      {avisoDaMarca && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{avisoDaMarca}</span>
        </div>
      )}
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
                    <button type="button" className="c-chip" onClick={() => marcar(p, "feito")} title="Já cuidei disso">
                      Feito
                    </button>
                    <button type="button" className="c-chip" onClick={() => marcar(p, "ignorado")} title="Deixar para depois">
                      Ignorar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {oi.length === 0 && resolvidos.length > 0 && (
        <h2 className="c-esfriou-titulo">Precisa de um oi · 0</h2>
      )}

      {resolvidos.length > 0 && (
        <div className="c-esfriou-retorno">
          <button type="button" className="c-link" aria-expanded={verResolvidos} onClick={() => definirVerResolvidos((v) => !v)}>
            Feitos e ignorados · {resolvidos.length} {verResolvidos ? "(esconder)" : "(ver quem)"}
          </button>
          <p className="c-dica">Voltam para a lista sozinhos se aparecer um motivo novo.</p>
          {verResolvidos && (
            <ul className="c-esfriou-nomes">
              {resolvidos.map(({ paciente: p, marca }) => (
                <li key={p.id}>
                  <Link to={rotas.adminProntuario(p.id)}>{p.nome}</Link>
                  <small> · {marca.como === "feito" ? "feito" : "ignorado"} em {ddmm(marca.em)} </small>
                  <button type="button" className="c-link" onClick={() => desfazer(p.id)}>
                    Voltar para a lista
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
