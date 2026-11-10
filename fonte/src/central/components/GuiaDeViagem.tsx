import { useMemo, useState } from "react";
import type {
  BlocoDoGuia,
  CamposDoDiario,
  FichaDeViagem,
  GuiaDeViagem,
  ItemDoGuia,
} from "@/central/types/viagem";
import type { EstadoDeEnvio } from "@/central/hooks/useDiarioDeViagem";
import { camposDe, temAlgoPreenchido, type DiarioLocal } from "@/central/utils/diarioDeViagem";
import {
  diasDaViagem,
  normalizarParaBusca,
  secoesDaBarra,
  trechosDeTexto,
  type DiaDaViagem,
} from "@/central/utils/guiaViagem";

/**
 * O Rota Viagem na tela.
 *
 * Este componente não sabe nada de paciente nenhuma: recebe o guia (que a
 * nutricionista escreveu e está no banco) e desenha bloco por bloco. É o
 * mesmo na tela da paciente e na ficha, onde a nutricionista lê exatamente o
 * que a paciente vê.
 */

/** O diário como a tela o recebe: o que está preenchido e como anda o envio. */
export interface DiarioDaTela {
  valores: DiarioLocal;
  estados: Record<string, EstadoDeEnvio>;
  /** Ausente = só leitura (a nutricionista lendo o diário da paciente). */
  anotar?: (dia: string, campo: keyof CamposDoDiario, valor: string) => void;
  /** Falso quando o que é digitado fica só no aparelho (conta da nutricionista). */
  envia: boolean;
}

const EM_BRANCO = "_______________";

interface Contexto {
  ficha: FichaDeViagem | null;
  diario: DiarioDaTela;
  dias: DiaDaViagem[];
}

function irParaSecao(id: string) {
  document.getElementById(`vg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** `**negrito**` e `*itálico*`; quebra de linha vira parágrafo quem decide é quem chama. */
function TextoRico({ texto }: { texto: string }) {
  return (
    <>
      {trechosDeTexto(texto).map((t, i) =>
        t.negrito ? <strong key={i}>{t.texto}</strong> : t.italico ? <em key={i}>{t.texto}</em> : <span key={i}>{t.texto}</span>,
      )}
    </>
  );
}

/** Texto com parágrafos (uma linha em branco separa). */
function Paragrafos({ texto, titulo }: { texto: string; titulo?: string }) {
  const partes = texto.split(/\n+/).filter((p) => p.trim() !== "");
  if (partes.length === 0 && titulo) partes.push("");
  return (
    <>
      {partes.map((p, i) => (
        <p key={i}>
          {i === 0 && titulo && (
            <>
              <strong>{titulo}</strong>{" "}
            </>
          )}
          <TextoRico texto={p} />
        </p>
      ))}
    </>
  );
}

function Item({ item }: { item: ItemDoGuia }) {
  return (
    <>
      {item.titulo && (
        <>
          <strong>{item.titulo}</strong>{" "}
        </>
      )}
      <TextoRico texto={item.texto} />
    </>
  );
}

export function GuiaDeViagemVisao({
  guia,
  nome,
  ficha,
  diario,
  comNavegacao = true,
}: {
  guia: GuiaDeViagem;
  nome: string | null;
  ficha: FichaDeViagem | null;
  diario: DiarioDaTela;
  comNavegacao?: boolean;
}) {
  const primeiroNome = nome?.trim().split(" ")[0] || null;
  const dias = useMemo(() => diasDaViagem(guia.dataInicio, guia.dataFim), [guia.dataInicio, guia.dataFim]);
  const contexto: Contexto = { ficha, diario, dias };
  const barra = secoesDaBarra(guia);

  return (
    <>
      <div className="c-vg-hero">
        <p className="c-vg-hero-tag">Módulo exclusivo</p>
        {guia.chamada && <p className="c-vg-hero-tagline">{guia.chamada}</p>}
        <p className="c-vg-hero-meta">
          <strong>{primeiroNome ? `Guia personalizado para ${primeiroNome}` : "Guia personalizado"}</strong>
        </p>
        {guia.destinos && <p className="c-vg-hero-meta">{guia.destinos}</p>}
        {guia.periodo && <p className="c-vg-hero-meta">{guia.periodo}</p>}
      </div>

      {comNavegacao && barra.length > 1 && (
        <nav className="c-vg-nav" aria-label="Seções do guia">
          {barra.map((s) => (
            <button key={s.id} type="button" className="c-vg-nav-link" onClick={() => irParaSecao(s.id)}>
              {s.rotulo}
            </button>
          ))}
        </nav>
      )}

      {guia.secoes.map((secao) => (
        <section key={secao.id} id={`vg-${secao.id}`} className="c-vg-secao">
          {secao.titulo && <h2 className="c-vg-secao-titulo">{secao.titulo}</h2>}
          <Blocos blocos={secao.blocos} contexto={contexto} />
        </section>
      ))}

      <footer className="c-vg-rodape">
        Isabela Marçal · Nutricionista · CRN-9 37597
        <br />
        @belamarcall · (31) 99450-3318
        <br />
        <br />
        Material individual, feito com base no seu quadro atual e no seu cardápio.
        <br />
        Não substitui orientação médica.
        <br />
        Em caso de sinais de alerta, procure atendimento. Não espere resposta por mensagem.
      </footer>
    </>
  );
}

function Blocos({ blocos, contexto }: { blocos: BlocoDoGuia[]; contexto: Contexto }) {
  return (
    <>
      {blocos.map((bloco, i) => (
        <Bloco key={i} bloco={bloco} contexto={contexto} />
      ))}
    </>
  );
}

function Bloco({ bloco, contexto }: { bloco: BlocoDoGuia; contexto: Contexto }) {
  switch (bloco.tipo) {
    case "texto":
      return (
        <div className="c-vg-texto">
          <Paragrafos texto={bloco.texto} />
        </div>
      );
    case "subtitulo":
      return <h3 className="c-vg-sub">{bloco.texto}</h3>;
    case "destaque":
      return <Destaque bloco={bloco} />;
    case "lista":
      return <Lista bloco={bloco} />;
    case "semaforo":
      return <Semaforo bloco={bloco} />;
    case "abas":
      return <Abas bloco={bloco} contexto={contexto} />;
    case "cartao":
      return (
        <div className="c-vg-cartao-garcom">
          <TextoRico texto={bloco.texto} />
          {bloco.destaques.map((d, i) => (
            <strong key={i}>{d}</strong>
          ))}
        </div>
      );
    case "tabela":
      return (
        <div className="c-vg-tabela-rolagem">
          <table className="c-vg-tabela">
            <thead>
              <tr>
                {bloco.colunas.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha, i) => (
                <tr key={i}>
                  {linha.map((celula, j) => (
                    <td key={j}>{celula}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "ficha":
      return <Ficha ficha={contexto.ficha} />;
    case "diario":
      return <Diario dias={contexto.dias} diario={contexto.diario} />;
    case "produto":
      return <Produto bloco={bloco} />;
  }
}

function Destaque({ bloco }: { bloco: Extract<BlocoDoGuia, { tipo: "destaque" }> }) {
  if (bloco.tom === "alerta") {
    return (
      <div className="c-vg-alerta-vermelho">
        {bloco.titulo && <h3>{bloco.titulo}</h3>}
        {bloco.texto && <Paragrafos texto={bloco.texto} />}
        {bloco.itens && (
          <ul>
            {bloco.itens.map((item, i) => (
              <li key={i}>
                <TextoRico texto={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  const classe = bloco.tom === "atencao" ? "c-vg-alerta-amarelo" : bloco.tom === "neutro" ? "c-vg-card" : "c-vg-dica";
  return (
    <div className={classe}>
      {(bloco.texto || bloco.titulo) && <Paragrafos texto={bloco.texto ?? ""} titulo={bloco.titulo} />}
      {bloco.itens?.map((item, i) => (
        <p key={i}>
          <TextoRico texto={item} />
        </p>
      ))}
    </div>
  );
}

function Lista({ bloco }: { bloco: Extract<BlocoDoGuia, { tipo: "lista" }> }) {
  if (bloco.itens.length === 0) return null;
  if (bloco.estilo === "numerada") {
    return (
      <ol className="c-vg-estrategias">
        {bloco.itens.map((item, i) => (
          <li key={i} className="c-vg-estrategia">
            <span className="c-vg-estrategia-num">{i + 1}</span>
            <span>
              <Item item={item} />
            </span>
          </li>
        ))}
      </ol>
    );
  }
  if (bloco.estilo === "cartoes") {
    return (
      <div className="c-vg-refeicoes">
        {bloco.itens.map((item, i) => (
          <div key={i} className="c-vg-refeicao">
            {item.titulo && <span className="c-vg-refeicao-label">{item.titulo}</span>}
            <span>
              <TextoRico texto={item.texto} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="c-vg-checklist">
      {bloco.itens.map((item, i) => (
        <li key={i}>
          <Item item={item} />
        </li>
      ))}
    </ul>
  );
}

function Semaforo({ bloco }: { bloco: Extract<BlocoDoGuia, { tipo: "semaforo" }> }) {
  const [busca, definirBusca] = useState("");
  const termo = normalizarParaBusca(busca.trim());
  const grupos = bloco.grupos
    .map((g) => ({
      ...g,
      itens:
        termo.length < 2
          ? g.itens
          : g.itens.filter((i) => normalizarParaBusca(`${i.titulo ?? ""} ${i.texto}`).includes(termo)),
    }))
    .filter((g) => g.itens.length > 0);

  return (
    <>
      <input
        type="search"
        className="c-vg-busca"
        placeholder="Pesquise um alimento..."
        aria-label="Pesquisar um alimento no guia"
        value={busca}
        onChange={(e) => definirBusca(e.target.value)}
      />
      {grupos.length === 0 && termo.length >= 2 && (
        <p className="c-vg-sem-resultado" role="status">
          Não achei "{busca.trim()}" no guia. Na dúvida, me pergunte antes de comer.
        </p>
      )}
      {grupos.map((g) => (
        <div key={g.cor} className="c-vg-sem-grupo">
          <div className={`c-vg-sem-label c-vg-sem-label--${g.cor}`}>{g.titulo}</div>
          <div className={`c-vg-sem-corpo c-vg-sem-corpo--${g.cor}`}>
            {g.itens.map((item, i) => (
              <div key={i} className="c-vg-sem-item">
                {item.titulo && <strong>{item.titulo}</strong>}
                <span>
                  <TextoRico texto={item.texto} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function Abas({ bloco, contexto }: { bloco: Extract<BlocoDoGuia, { tipo: "abas" }>; contexto: Contexto }) {
  const [ativa, definirAtiva] = useState(0);
  const aba = bloco.abas[Math.min(ativa, bloco.abas.length - 1)];
  if (!aba) return null;
  return (
    <>
      <div className="c-vg-abas">
        {bloco.abas.map((a, i) => (
          <button
            key={i}
            type="button"
            className={`c-vg-aba ${a === aba ? "c-vg-aba--ativo" : ""}`}
            aria-pressed={a === aba}
            onClick={() => definirAtiva(i)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <Blocos blocos={aba.blocos} contexto={contexto} />
    </>
  );
}

function Produto({ bloco }: { bloco: Extract<BlocoDoGuia, { tipo: "produto" }> }) {
  const miolo = (
    <>
      {bloco.imagem && <img src={bloco.imagem} alt={bloco.titulo} loading="lazy" />}
      <span>
        {bloco.titulo && <strong>{bloco.titulo}</strong>}
        <TextoRico texto={bloco.texto} />
      </span>
    </>
  );
  return bloco.link ? (
    <a className="c-vg-produto" href={bloco.link} target="_blank" rel="noopener noreferrer">
      {miolo}
    </a>
  ) : (
    <div className="c-vg-produto">{miolo}</div>
  );
}

function Ficha({ ficha }: { ficha: FichaDeViagem | null }) {
  const linhas: [string, string][] = [
    ["Name", ficha?.nome ?? EM_BRANCO],
    ["Date of birth", ficha?.nascimento ?? EM_BRANCO],
    ["Diagnoses", ficha?.diagnosticos ?? EM_BRANCO],
    ["Allergies", EM_BRANCO],
    ["Current medicines", EM_BRANCO],
    ["Doctor / phone", EM_BRANCO],
  ];
  return (
    <div className="c-vg-ficha">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="c-vg-ficha-linha">
          <span className="c-vg-ficha-label">{rotulo}</span>
          <span>{valor}</span>
        </div>
      ))}
    </div>
  );
}

function Diario({ dias, diario }: { dias: DiaDaViagem[]; diario: DiarioDaTela }) {
  const anotar = diario.anotar;
  return (
    <>
      {dias.map((dia) => {
        const d = camposDe(diario.valores[dia.data]);
        const preenchido = temAlgoPreenchido(diario.valores[dia.data]);
        const estado = diario.estados[dia.data];
        const mudar = (campo: keyof CamposDoDiario) => (e: { target: { value: string } }) =>
          anotar?.(dia.data, campo, e.target.value);
        const escala = (rotulo: string, campo: "inchaco" | "dor" | "azia") => (
          <label className="c-vg-diario-campo">
            <span>{rotulo}</span>
            <input
              type="number"
              inputMode="numeric"
              className="c-input"
              min={0}
              max={10}
              value={d[campo]}
              disabled={!anotar}
              onChange={mudar(campo)}
            />
          </label>
        );
        return (
          <details key={dia.data} className="c-vg-diario-dia">
            <summary className="c-vg-diario-resumo">
              Dia {dia.numero} — {dia.rotulo} ({dia.semana})
              {preenchido && <span className="c-vg-diario-marca">preenchido</span>}
            </summary>
            <div className="c-vg-diario-campos">
              <label className="c-vg-diario-campo">
                <span>Onde estou</span>
                <input
                  type="text"
                  className="c-input"
                  placeholder="Cidade"
                  maxLength={120}
                  value={d.onde}
                  disabled={!anotar}
                  onChange={mudar("onde")}
                />
              </label>
              {escala("Inchaço 0-10", "inchaco")}
              {escala("Dor 0-10", "dor")}
              {escala("Azia/amargo 0-10", "azia")}
              <label className="c-vg-diario-campo">
                <span>Evacuações (nº)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  className="c-input"
                  min={0}
                  max={30}
                  value={d.evacuacoes}
                  disabled={!anotar}
                  onChange={mudar("evacuacoes")}
                />
              </label>
              <label className="c-vg-diario-campo">
                <span>Bristol</span>
                <select className="c-select" value={d.bristol} disabled={!anotar} onChange={mudar("bristol")}>
                  <option value="">-</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="c-vg-diario-campo c-vg-diario-campo--full">
                <span>O que comi de diferente, gatilhos, observações</span>
                <textarea
                  className="c-textarea"
                  rows={2}
                  maxLength={2000}
                  value={d.observacoes}
                  disabled={!anotar}
                  onChange={mudar("observacoes")}
                />
              </label>
              {anotar && preenchido && (
                <p className={`c-vg-diario-estado ${estado === "falhou" ? "c-vg-diario-estado--falhou" : ""}`} role="status">
                  {!diario.envia
                    ? "Na conta da nutricionista o diário fica só neste aparelho."
                    : estado === "falhou"
                      ? "Sem conexão agora. Fica guardado no seu celular e chega pra mim assim que a internet voltar."
                      : estado === "salvando" || diario.valores[dia.data]?.pendente
                        ? "Salvando…"
                        : "Salvo. Já chegou pra mim."}
                </p>
              )}
            </div>
          </details>
        );
      })}
    </>
  );
}
