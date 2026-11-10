import { useCallback, useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { GuiaDeViagemVisao } from "@/central/components/GuiaDeViagem";
import { EditorDoGuiaDeViagem } from "./EditorDoGuiaDeViagem";
import type {
  DiaDoDiarioDeViagem,
  FichaDeViagem,
  GuiaDeViagem,
  GuiaParaCopiar,
  ViagemDoPaciente,
} from "@/central/types/viagem";
import { camposDoServidor, type DiarioLocal } from "@/central/utils/diarioDeViagem";
import { guiaEmBranco, normalizarFicha, normalizarGuia } from "@/central/utils/guiaViagem";

/**
 * O Rota Viagem de uma paciente, visto pela nutricionista.
 *
 * Três coisas num lugar só:
 *   - o DIÁRIO, que é por onde ela acompanha a paciente durante a viagem;
 *   - o GUIA como a paciente vê, com a ficha de saúde preenchida;
 *   - o EDITOR, onde o guia é escrito — do zero, ou copiado de outra paciente.
 *
 * SALVAR E LIBERAR SÃO DOIS GESTOS. Salvar guarda o texto; a paciente só vê
 * depois de "Ligar". Assim ela pode montar o guia aos poucos, e um guia
 * copiado de outra pessoa nunca aparece para a nova paciente antes de revisto.
 */

type Modo = "diario" | "guia" | "editar";

interface Rascunho {
  guia: GuiaDeViagem;
  ficha: FichaDeViagem;
}

const FICHA_VAZIA: FichaDeViagem = { nome: null, nascimento: null, diagnosticos: null };
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function rotuloDoDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} (${SEMANA[d.getUTCDay()] ?? ""})`;
}

function quando(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ViagemDoProntuario({
  pacienteId,
  nome,
  inicial,
  aoMudar,
}: {
  pacienteId: string;
  nome: string;
  inicial: ViagemDoPaciente;
  /** A ficha de fora decide se a aba aparece: precisa saber quando o guia nasce ou é ligado. */
  aoMudar: (dados: ViagemDoPaciente) => void;
}) {
  const [dados, definirDados] = useState<ViagemDoPaciente>(inicial);
  // Sem guia, a única coisa a fazer aqui é montar um.
  const [modo, definirModo] = useState<Modo>(inicial.guia ? "diario" : "editar");
  const [rascunho, definirRascunho] = useState<Rascunho | null>(null);
  const [sujo, definirSujo] = useState(false);
  const [ocupado, definirOcupado] = useState<"salvar" | "ligar" | "atualizar" | "copiar" | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [origens, definirOrigens] = useState<GuiaParaCopiar[]>([]);
  const [origem, definirOrigem] = useState("");

  const receber = useCallback(
    (novos: ViagemDoPaciente) => {
      definirDados(novos);
      aoMudar(novos);
    },
    [aoMudar],
  );

  // Quem já tem guia, para oferecer como ponto de partida.
  useEffect(() => {
    let ativo = true;
    void repositorio
      .guiasDeViagemParaCopiar()
      .then((lista) => {
        if (ativo) definirOrigens(lista.filter((g) => g.pacienteId !== pacienteId));
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [pacienteId]);

  // Fechar a aba com o guia pela metade perderia o que ela escreveu.
  useEffect(() => {
    if (!sujo) return;
    const segurar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [sujo]);

  const atualizar = useCallback(async () => {
    definirOcupado("atualizar");
    try {
      receber(await repositorio.viagemDoPaciente(pacienteId));
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui atualizar.");
    } finally {
      definirOcupado(null);
    }
  }, [pacienteId, receber]);

  function abrirEditor() {
    if (!rascunho && dados.guia) {
      definirRascunho({ guia: structuredClone(dados.guia), ficha: dados.ficha ?? FICHA_VAZIA });
    }
    definirAviso(null);
    definirModo("editar");
  }

  function comecarEmBranco() {
    definirRascunho({ guia: guiaEmBranco(), ficha: dados.ficha ?? FICHA_VAZIA });
    definirSujo(true);
    definirAviso(null);
  }

  async function copiarDe(origemId: string) {
    const de = origens.find((g) => g.pacienteId === origemId);
    if (!de) return;
    definirOcupado("copiar");
    definirErro(null);
    try {
      const fonte = await repositorio.viagemDoPaciente(origemId);
      if (!fonte.guia) throw new Error("Esse guia não existe mais.");
      // Só o texto do guia: a ficha de saúde da outra paciente fica com ela.
      definirRascunho({ guia: structuredClone(fonte.guia), ficha: dados.ficha ?? FICHA_VAZIA });
      definirSujo(true);
      definirAviso(
        `Copiei o guia de ${de.nome}. Nada foi gravado ainda: revise os textos, as datas e a ficha de saúde, e só então salve.`,
      );
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui copiar o guia.");
    } finally {
      definirOcupado(null);
    }
  }

  async function salvar() {
    if (!rascunho) return;
    // A mesma fronteira por onde o guia passa ao ser lido: o que ela não
    // preencheu (item em branco, linha vazia) sai antes de gravar.
    const guia = normalizarGuia(JSON.parse(JSON.stringify(rascunho.guia)));
    if (!guia || guia.secoes.length === 0) {
      definirErro("O guia precisa de pelo menos uma seção.");
      return;
    }
    definirOcupado("salvar");
    definirErro(null);
    try {
      await repositorio.salvarGuiaDeViagem(pacienteId, guia, normalizarFicha(rascunho.ficha));
      const novos = await repositorio.viagemDoPaciente(pacienteId);
      receber(novos);
      definirRascunho(novos.guia ? { guia: structuredClone(novos.guia), ficha: novos.ficha ?? FICHA_VAZIA } : null);
      definirSujo(false);
      definirAviso(
        novos.liberado
          ? "Salvo. Ela já vê a versão nova ao abrir o guia."
          : "Salvo. Ela ainda não vê: o guia está desligado. Quando estiver pronto, toque em Ligar.",
      );
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui salvar o guia.");
    } finally {
      definirOcupado(null);
    }
  }

  function descartar() {
    if (!window.confirm("Descartar o que você mudou desde a última vez que salvou?")) return;
    definirRascunho(dados.guia ? { guia: structuredClone(dados.guia), ficha: dados.ficha ?? FICHA_VAZIA } : null);
    definirSujo(false);
    definirAviso(null);
  }

  async function alternar() {
    definirOcupado("ligar");
    definirErro(null);
    try {
      const liberado = await repositorio.definirViagemDoPaciente(pacienteId, !dados.liberado);
      receber({ ...dados, liberado });
      definirAviso(liberado ? "Ligado. O card Rota Viagem já aparece no início dela." : "Desligado. O guia saiu do aplicativo dela.");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui mudar.");
    } finally {
      definirOcupado(null);
    }
  }

  // O mais recente primeiro: é o dia que ela quer ler ao abrir a aba.
  const dias = useMemo(() => [...dados.diario].sort((a, b) => b.dia.localeCompare(a.dia)), [dados.diario]);

  const diarioDaTela = useMemo(() => {
    const valores: DiarioLocal = {};
    for (const dia of dados.diario) valores[dia.dia] = camposDoServidor(dia);
    return { valores, estados: {}, envia: false };
  }, [dados.diario]);

  // Na prévia vale o que ela está editando, para conferir antes de salvar.
  const guiaDaPrevia = sujo && rascunho ? rascunho.guia : dados.guia;
  const fichaDaPrevia = sujo && rascunho ? normalizarFicha(rascunho.ficha) : dados.ficha;

  return (
    <>
      <section className="c-secao">
        <h2 className="c-secao-titulo">Rota Viagem</h2>
        <div className="c-bloco">
          <div className="c-acesso-linha">
            <span className="c-acesso-texto">
              <strong>{dados.liberado ? "Ligado" : "Desligado"}</strong>
              <span>
                {!dados.guia
                  ? "Esta paciente ainda não tem guia. Monte e salve um para poder ligar."
                  : dados.liberado
                    ? "Ela vê o guia no aplicativo e pode preencher o diário."
                    : "O guia está salvo, mas ela não vê. Ligue quando estiver pronto."}
                {dados.guiaAtualizadoEm ? ` Guia salvo em ${quando(dados.guiaAtualizadoEm)}.` : ""}
              </span>
            </span>
            <button
              type="button"
              className={`c-botao c-botao-pequeno ${dados.liberado ? "c-botao-secundario" : ""}`}
              disabled={ocupado !== null || (!dados.guia && !dados.liberado)}
              onClick={() => void alternar()}
            >
              {dados.liberado ? "Desligar" : "Ligar"}
            </button>
          </div>
        </div>

        <div className="c-chips c-vg-nutri-modos" role="group" aria-label="O que ver do Rota Viagem">
          <button type="button" className="c-chip" aria-pressed={modo === "diario"} onClick={() => definirModo("diario")}>
            Diário{dias.length > 0 ? ` (${dias.length})` : ""}
          </button>
          <button type="button" className="c-chip" aria-pressed={modo === "guia"} onClick={() => definirModo("guia")}>
            Como ela vê
          </button>
          <button type="button" className="c-chip" aria-pressed={modo === "editar"} onClick={abrirEditor}>
            {dados.guia ? "Editar o guia" : "Montar o guia"}
            {sujo ? " •" : ""}
          </button>
        </div>

        {aviso && (
          <div className="c-aviso" role="status">
            <span>{aviso}</span>
          </div>
        )}
        {erro && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>{erro}</span>
          </div>
        )}
      </section>

      {modo === "diario" && (
        <section className="c-secao">
          <div className="c-vg-nutri-topo">
            <h2 className="c-secao-titulo">Diário da viagem</h2>
            <button
              type="button"
              className="c-botao c-botao-pequeno c-botao-secundario"
              disabled={ocupado !== null}
              onClick={() => void atualizar()}
            >
              {ocupado === "atualizar" ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
          <p className="c-subtitulo">O que ela preenche no guia aparece aqui, do dia mais recente para o mais antigo.</p>
          {dias.length === 0 ? (
            <EstadoVazio
              icone="info"
              titulo="Ela ainda não preencheu nenhum dia"
              descricao="Assim que ela anotar um dia no diário do guia, ele aparece aqui."
            />
          ) : (
            <div className="c-vg-nutri-dias">
              {dias.map((dia) => (
                <DiaDoDiario key={dia.dia} dia={dia} />
              ))}
            </div>
          )}
        </section>
      )}

      {modo === "guia" && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">O guia como ela vê</h2>
          {guiaDaPrevia ? (
            <>
              <p className="c-subtitulo">
                {sujo
                  ? "Prévia do que você está editando. Ainda não foi salvo: ela continua vendo a versão anterior."
                  : "É a mesma tela do aplicativo dela, com a ficha de saúde preenchida e o que ela já anotou no diário."}
              </p>
              <div className="c-vg-previa">
                <GuiaDeViagemVisao
                  guia={guiaDaPrevia}
                  nome={fichaDaPrevia?.nome ?? nome}
                  ficha={fichaDaPrevia}
                  diario={diarioDaTela}
                  comNavegacao={false}
                />
              </div>
            </>
          ) : (
            <EstadoVazio icone="info" titulo="Esta paciente ainda não tem guia" descricao='Toque em "Montar o guia" para começar.' />
          )}
        </section>
      )}

      {modo === "editar" && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">{dados.guia ? "Editar o guia" : "Montar o guia"}</h2>
          {rascunho ? (
            <>
              <EditorDoGuiaDeViagem
                guia={rascunho.guia}
                ficha={rascunho.ficha}
                aoMudar={(guia, ficha) => {
                  definirRascunho({ guia, ficha });
                  definirSujo(true);
                }}
              />
              <div className="c-vg-ed-barra">
                <span>{sujo ? "Há mudanças que ainda não foram salvas." : "Tudo salvo."}</span>
                {sujo && (
                  <button type="button" className="c-botao-texto" disabled={ocupado !== null} onClick={descartar}>
                    Descartar
                  </button>
                )}
                <button type="button" className="c-botao c-botao-pequeno" disabled={!sujo || ocupado !== null} onClick={() => void salvar()}>
                  {ocupado === "salvar" ? "Salvando…" : "Salvar guia"}
                </button>
              </div>
            </>
          ) : (
            <div className="c-bloco">
              <p className="c-vg-ed-dica">
                O guia é escrito por você, para esta paciente. Comece das seções de sempre, em branco, ou parta do guia de outra
                paciente e adapte.
              </p>
              <button type="button" className="c-botao c-botao-pequeno" onClick={comecarEmBranco}>
                Começar em branco
              </button>
              {origens.length > 0 && (
                <div className="c-vg-ed-copiar">
                  <label className="c-campo c-vg-ed-campo">
                    <span>Ou copiar o guia de</span>
                    <select value={origem} onChange={(e) => definirOrigem(e.target.value)}>
                      <option value="">Escolha a paciente…</option>
                      {origens.map((g) => (
                        <option key={g.pacienteId} value={g.pacienteId}>
                          {g.nome}
                          {g.destinos ? ` — ${g.destinos}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="c-botao c-botao-pequeno c-botao-secundario"
                    disabled={!origem || ocupado !== null}
                    onClick={() => void copiarDe(origem)}
                  >
                    {ocupado === "copiar" ? "Copiando…" : "Copiar e adaptar"}
                  </button>
                  <p className="c-vg-ed-dica">
                    Vem só o texto do guia. A ficha de saúde e o diário da outra paciente não são copiados.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function DiaDoDiario({ dia }: { dia: DiaDoDiarioDeViagem }) {
  const medida = (rotulo: string, valor: number | null, sufixo = "") => (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor === null ? "—" : `${valor}${sufixo}`}</dd>
    </div>
  );
  return (
    <article className="c-vg-nutri-dia">
      <header>
        <strong>
          {rotuloDoDia(dia.dia)}
          {dia.onde ? ` · ${dia.onde}` : ""}
        </strong>
        {dia.atualizadoEm && <span>preenchido em {quando(dia.atualizadoEm)}</span>}
      </header>
      <dl>
        {medida("Inchaço", dia.inchaco, "/10")}
        {medida("Dor", dia.dor, "/10")}
        {medida("Azia/amargo", dia.azia, "/10")}
        {medida("Evacuações", dia.evacuacoes)}
        {medida("Bristol", dia.bristol)}
      </dl>
      {dia.observacoes && <p>{dia.observacoes}</p>}
    </article>
  );
}
