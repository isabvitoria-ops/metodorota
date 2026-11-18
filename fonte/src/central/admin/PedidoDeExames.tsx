/**
 * Mais → Pedido de exames.
 *
 * Ela escolhe a paciente, marca os exames e baixa o PDF com o cabeçalho, a
 * assinatura e o CRN dela. Nada é gravado: o pedido é um documento, não um
 * registro clínico (os resultados, quando chegam, vão em Exames).
 *
 * A lista de exames é um ponto de partida que ela edita — marcar, desmarcar
 * e acrescentar "outro exame" com o nome que quiser. Nenhum vem marcado.
 */
import { useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { BotaoPdf } from "@/central/components/BotaoPdf";
import { DocumentoExames, type GrupoDeExames } from "@/central/components/DocumentosNovos";
import type { Paciente } from "@/central/types";

const LISTA: GrupoDeExames[] = [
  { grupo: "Hemograma e ferro", exames: ["Hemograma completo", "Ferritina", "Ferro sérico", "Transferrina", "Índice de saturação de transferrina"] },
  { grupo: "Glicemia", exames: ["Glicemia de jejum", "Insulina de jejum", "Hemoglobina glicada (HbA1c)"] },
  { grupo: "Perfil lipídico", exames: ["Colesterol total e frações", "Triglicerídeos"] },
  { grupo: "Tireoide", exames: ["TSH", "T4 livre", "T3 livre", "Anti-TPO"] },
  { grupo: "Vitaminas e minerais", exames: ["Vitamina D (25-OH)", "Vitamina B12", "Ácido fólico", "Zinco", "Magnésio"] },
  { grupo: "Fígado e rim", exames: ["TGO (AST)", "TGP (ALT)", "Gama-GT", "Creatinina", "Ureia", "Ácido úrico"] },
  { grupo: "Inflamação", exames: ["Proteína C reativa (PCR)"] },
];

const ORIENTACAO_PADRAO = "Siga o preparo que o laboratório indicar. Leve este pedido e um documento com foto.";

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isoParaBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : iso);

export function PedidoDeExames() {
  const { configuracoes } = useSessao();
  const [pacientes, definirPacientes] = useState<Paciente[] | null>(null);
  const [pacienteId, definirPacienteId] = useState("");
  const [data, definirData] = useState(hojeIso());
  const [marcados, definirMarcados] = useState<string[]>([]);
  const [outros, definirOutros] = useState<string[]>([]);
  const [novo, definirNovo] = useState("");
  const [orientacao, definirOrientacao] = useState(ORIENTACAO_PADRAO);
  const [erro, definirErro] = useState(false);

  useEffect(() => {
    repositorio
      .listarPacientes()
      .then((p) => definirPacientes([...p].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))))
      .catch(() => definirErro(true));
  }, []);

  const paciente = pacientes?.find((p) => p.id === pacienteId) ?? null;
  const grupos = useMemo(() => {
    const g = LISTA.map((x) => ({ grupo: x.grupo, exames: x.exames.filter((e) => marcados.includes(e)) })).filter((x) => x.exames.length);
    const extras = outros.filter((e) => marcados.includes(e));
    return extras.length ? [...g, { grupo: "Outros", exames: extras }] : g;
  }, [marcados, outros]);
  const total = grupos.reduce((t, g) => t + g.exames.length, 0);

  function alternar(e: string) {
    definirMarcados((m) => (m.includes(e) ? m.filter((x) => x !== e) : [...m, e]));
  }
  function acrescentar() {
    const nome = novo.trim();
    if (!nome) return;
    if (!outros.includes(nome)) definirOutros([...outros, nome]);
    if (!marcados.includes(nome)) definirMarcados([...marcados, nome]);
    definirNovo("");
  }

  return (
    <div className="c-px">
      <h1 className="c-titulo">Pedido de exames</h1>
      <p className="c-subtitulo">Marque os exames e baixe o PDF com a sua assinatura e o CRN. Nada fica gravado.</p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          Não consegui carregar as pacientes. Recarregue a página.
        </div>
      )}

      <div className="c-bloco c-px-topo">
        <label className="c-campo">
          <span className="c-rotulo">Paciente</span>
          <select className="c-select" value={pacienteId} onChange={(e) => definirPacienteId(e.target.value)}>
            <option value="">Escolha…</option>
            {(pacientes ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="c-campo">
          <span className="c-rotulo">Data do pedido</span>
          <input className="c-input" type="date" value={data} onChange={(e) => definirData(e.target.value)} />
        </label>
      </div>

      <div className="c-px-grupos">
        {LISTA.map((g) => (
          <fieldset key={g.grupo} className="c-bloco c-px-grupo">
            <legend className="c-cz-secao c-cz-secao--dentro">{g.grupo}</legend>
            {g.exames.map((e) => (
              <label key={e} className="c-px-exame">
                <input type="checkbox" checked={marcados.includes(e)} onChange={() => alternar(e)} />
                <span>{e}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <fieldset className="c-bloco c-px-grupo">
          <legend className="c-cz-secao c-cz-secao--dentro">Outros</legend>
          {outros.map((e) => (
            <label key={e} className="c-px-exame">
              <input type="checkbox" checked={marcados.includes(e)} onChange={() => alternar(e)} />
              <span>{e}</span>
            </label>
          ))}
          <div className="c-px-novo">
            <input
              className="c-input"
              value={novo}
              placeholder="Outro exame"
              aria-label="Nome de outro exame"
              onChange={(e) => definirNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  acrescentar();
                }
              }}
            />
            <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={acrescentar}>
              Acrescentar
            </button>
          </div>
        </fieldset>
      </div>

      <label className="c-campo c-px-orientacao">
        <span className="c-rotulo">No dia da coleta (aparece no PDF)</span>
        <input className="c-input" value={orientacao} onChange={(e) => definirOrientacao(e.target.value)} />
      </label>

      <div className="c-px-rodape">
        <p className="c-dica">
          {!paciente
            ? "Escolha a paciente para montar o PDF."
            : total === 0
              ? "Marque pelo menos um exame."
              : `${total} ${total === 1 ? "exame marcado" : "exames marcados"} para ${paciente.nome}.`}
        </p>
        <BotaoPdf
          titulo={`Pedido de exames — ${paciente?.nome ?? ""}`}
          desligado={!paciente || total === 0}
          documento={
            paciente ? (
              <DocumentoExames
                paciente={paciente.nome}
                data={isoParaBr(data)}
                grupos={grupos}
                orientacao={orientacao}
                nutricionista={configuracoes.nomeNutricionista || "Isabela Marçal"}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
