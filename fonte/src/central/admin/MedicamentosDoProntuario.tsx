import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";
import { BotaoPdf } from "@/central/components/BotaoPdf";
import { DocumentoMedicamentos } from "@/central/components/DocumentosNovos";
import type { EntradaDaBase, MedicamentoDaPaciente, TipoDeMedicamento } from "@/central/types/medicamentos";
import { TIPOS_DE_MEDICAMENTO } from "@/central/types/medicamentos";
import { entradasDoMedicamento, montarPdfDeMedicamentos } from "@/central/utils/medicamentos";
import { Modal } from "./componentes/Modal";

/**
 * Aba Medicamentos do prontuário (N31, aprovado em 23/11/2026).
 *
 * Remédios, suplementos e fitoterápicos da paciente, com a anotação DELA.
 * O que acompanhar vem da base que ela mesma confere (Configurações); o que
 * ainda está "para conferir" aparece só como aviso para ela, e não entra no
 * PDF nem no lembrete do pedido de exames. Nada aqui é escrito por IA e nada
 * aparece para a paciente.
 */
const rotuloDoTipo = (t: TipoDeMedicamento) => TIPOS_DE_MEDICAMENTO.find((x) => x.chave === t)?.rotulo ?? t;
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

type Rascunho = Omit<MedicamentoDaPaciente, "id"> & { id?: string };

export function MedicamentosDoProntuario({ pacienteId, pacienteNome }: { pacienteId: string; pacienteNome: string }) {
  const { configuracoes } = useSessao();
  const [meds, definirMeds] = useState<MedicamentoDaPaciente[] | null>(null);
  const [base, definirBase] = useState<EntradaDaBase[]>([]);
  const [erro, definirErro] = useState(false);
  const [editando, definirEditando] = useState<Rascunho | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [m, b] = await Promise.all([repositorio.medicamentosDaPaciente(pacienteId), repositorio.baseDeMedicamentos()]);
      definirMeds(m);
      definirBase(b);
      definirErro(false);
    } catch {
      definirErro(true);
      definirMeds([]);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const fechar = useCallback(() => definirEditando(null), []);
  const novo = (): Rascunho => ({
    pacienteId,
    nome: "",
    tipo: "medicamento",
    dose: null,
    horario: null,
    desde: null,
    prescritoPor: null,
    anotacao: null,
    ativo: true,
  });

  if (!meds) return <p className="c-contagem">Carregando os medicamentos…</p>;
  const pdf = montarPdfDeMedicamentos(meds, base, rotuloDoTipo);
  const ativos = meds.filter((m) => m.ativo);

  return (
    <section className="c-secao c-med">
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          Não consegui carregar os medicamentos. Recarregue a página.
        </div>
      )}
      <div className="c-med-topo">
        <h2 className="c-secao-titulo">Medicamentos e suplementos · {ativos.length}</h2>
        <button type="button" className="c-botao c-botao-pequeno" onClick={() => definirEditando(novo())}>
          + Medicamento ou suplemento
        </button>
      </div>

      {meds.length === 0 ? (
        <p className="c-dica">Nenhum medicamento ou suplemento anotado.</p>
      ) : (
        <ul className="c-med-lista">
          {meds.map((m) => {
            const casadas = entradasDoMedicamento(m.nome, base);
            const conferidas = casadas.filter((e) => e.conferidoEm);
            const nutrientes = [...new Set(conferidas.flatMap((e) => e.nutrientes.map((n) => n.nutriente)))];
            const uso = [m.dose && !m.nome.includes(m.dose) ? m.dose : null, m.horario, m.desde ? `desde ${m.desde}` : null, m.prescritoPor ? (/^por conta/i.test(m.prescritoPor) ? m.prescritoPor : `prescrito por: ${m.prescritoPor}`) : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={m.id}>
                <button type="button" className={`c-med-item ${m.ativo ? "" : "c-med-parou"}`} onClick={() => definirEditando(m)}>
                  <span className="c-med-texto">
                    <strong>
                      {m.nome}
                      {m.tipo !== "medicamento" && <small> ({rotuloDoTipo(m.tipo).toLowerCase()})</small>}
                    </strong>
                    {uso && <small>{uso}</small>}
                    <small>
                      {!m.ativo
                        ? "Parou de usar."
                        : nutrientes.length
                          ? `Acompanhar: ${nutrientes.join(", ")}`
                          : casadas.length
                            ? "Está na sua base, ainda para conferir."
                            : "Fora da sua base."}
                    </small>
                  </span>
                  {m.ativo && conferidas.length > 0 && <span className="c-selo melhor">Conferido por você</span>}
                  {m.ativo && conferidas.length === 0 && casadas.length > 0 && <span className="c-selo neutro">Para conferir</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="c-med-rodape">
        <p className="c-dica">
          Nada desta aba aparece para a paciente. O que acompanhar vem da <Link to={`${rotas.adminConfiguracoes}#base-de-medicamentos`}>sua base</Link>, e
          só entra no PDF o que você já conferiu.
        </p>
        <BotaoPdf
          titulo={`Medicamentos e nutrientes — ${pacienteNome}`}
          classe="c-botao c-botao-secundario c-botao-pequeno"
          desligado={pdf.linhas.length === 0}
          documento={
            <DocumentoMedicamentos
              paciente={pacienteNome}
              linhas={pdf.linhas}
              fontes={pdf.fontes}
              nutricionista={configuracoes.nomeNutricionista || "Isabela Marçal"}
            />
          }
        />
      </div>

      {editando && (
        <EditorDoMedicamento
          inicial={editando}
          base={base}
          aoFechar={fechar}
          aoMudar={async () => {
            fechar();
            await carregar();
          }}
        />
      )}
    </section>
  );
}

function EditorDoMedicamento({
  inicial,
  base,
  aoFechar,
  aoMudar,
}: {
  inicial: Rascunho;
  base: EntradaDaBase[];
  aoFechar: () => void;
  aoMudar: () => Promise<void>;
}) {
  const [m, definirM] = useState<Rascunho>(inicial);
  const [salvando, definirSalvando] = useState(false);
  const [confirmarApagar, definirConfirmarApagar] = useState(false);
  const [falha, definirFalha] = useState<string | null>(null);
  const mudar = (parte: Partial<Rascunho>) => definirM((x) => ({ ...x, ...parte }));
  const casadas = m.nome.trim() ? entradasDoMedicamento(m.nome, base) : [];

  async function salvar() {
    if (!m.nome.trim()) return definirFalha("Escreva o nome.");
    definirSalvando(true);
    try {
      await repositorio.salvarMedicamentoDaPaciente(m);
      await aoMudar();
    } catch (e) {
      definirFalha(e instanceof Error ? e.message : "Não consegui salvar.");
      definirSalvando(false);
    }
  }
  async function apagar() {
    if (!m.id) return;
    definirSalvando(true);
    try {
      await repositorio.apagarMedicamentoDaPaciente(m.id);
      await aoMudar();
    } catch (e) {
      definirFalha(e instanceof Error ? e.message : "Não consegui apagar.");
      definirSalvando(false);
    }
  }
  const campo = (rotulo: string, chave: "dose" | "horario" | "desde" | "prescritoPor", dica: string) => (
    <label className="c-campo">
      <span className="c-rotulo">{rotulo}</span>
      <input className="c-input" value={m[chave] ?? ""} placeholder={dica} maxLength={120} onChange={(e) => mudar({ [chave]: e.target.value || null })} />
    </label>
  );

  return (
    <Modal titulo={m.id ? m.nome || "Medicamento" : "Novo medicamento ou suplemento"} aoFechar={aoFechar}>
      <label className="c-campo">
        <span className="c-rotulo">Nome</span>
        <input className="c-input" value={m.nome} maxLength={120} placeholder="Ex.: Omeprazol 20 mg" onChange={(e) => mudar({ nome: e.target.value })} />
      </label>
      <div className="c-med-tipos" role="group" aria-label="Tipo">
        {TIPOS_DE_MEDICAMENTO.map((t) => (
          <button key={t.chave} type="button" className="c-chip" aria-pressed={m.tipo === t.chave} onClick={() => mudar({ tipo: t.chave })}>
            {t.rotulo}
          </button>
        ))}
      </div>
      <div className="c-med-campos">
        {campo("Dose", "dose", "Ex.: 20 mg")}
        {campo("Horário", "horario", "Ex.: 1 vez ao dia, em jejum")}
        {campo("Desde quando", "desde", "Ex.: 03/2026")}
        {campo("Quem prescreveu", "prescritoPor", "Ex.: gastro, por conta própria")}
      </div>

      {casadas.length > 0 && (
        <div className="c-med-base">
          {casadas.map((e) => (
            <div key={e.id}>
              <p className="c-rotulo">
                Na sua base: {e.nome} ·{" "}
                {e.conferidoEm ? `conferido por você em ${dataBr(e.conferidoEm)}` : "ainda para conferir (não entra no PDF)"}
              </p>
              <ul>
                {e.nutrientes.map((n, i) => (
                  <li key={i}>
                    <strong>{n.nutriente}</strong>
                    <small>{n.fonte}</small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <label className="c-campo">
        <span className="c-rotulo">Sua anotação (sai no PDF)</span>
        <textarea className="c-textarea" rows={3} maxLength={2000} value={m.anotacao ?? ""} onChange={(e) => mudar({ anotacao: e.target.value || null })} />
      </label>
      <label className="c-chip" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={!m.ativo} onChange={(e) => mudar({ ativo: !e.target.checked })} />
        Parou de usar
      </label>

      {falha && (
        <p className="c-aviso c-aviso-erro" role="alert">
          {falha}
        </p>
      )}
      <div className="c-modal-acoes">
        {m.id &&
          (confirmarApagar ? (
            <button type="button" className="c-botao c-botao-perigo" disabled={salvando} onClick={() => void apagar()}>
              Apagar de vez
            </button>
          ) : (
            <button type="button" className="c-botao c-botao-secundario" disabled={salvando} onClick={() => definirConfirmarApagar(true)}>
              Apagar
            </button>
          ))}
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
