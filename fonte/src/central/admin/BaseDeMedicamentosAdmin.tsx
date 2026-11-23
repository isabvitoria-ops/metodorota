/**
 * Configurações → Sua base de medicamentos (N31).
 *
 * Medicamento ou classe → nutrientes a acompanhar, cada um com a fonte. A
 * base de partida veio só com fontes publicadas e entrou PARA CONFERIR: só
 * vale para o lembrete do pedido de exames e para o PDF depois que ela marca
 * que conferiu. Nada aqui é escrito por IA; ela edita tudo.
 */
import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { EntradaDaBase } from "@/central/types/medicamentos";
import { hojeSaoPaulo } from "@/central/utils/situacao";

type Rascunho = Omit<EntradaDaBase, "id"> & { id?: string; termosTexto: string; chave: string };

const paraRascunho = (e: EntradaDaBase): Rascunho => ({ ...e, termosTexto: e.termos.join(", "), chave: e.id });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function BaseDeMedicamentosAdmin() {
  const [lista, definirLista] = useState<Rascunho[] | null>(null);
  const [recado, definirRecado] = useState<string | null>(null);
  const [apagando, definirApagando] = useState<string | null>(null);

  useEffect(() => {
    void repositorio
      .baseDeMedicamentos()
      .then((b) => definirLista(b.map(paraRascunho)))
      .catch(() => definirLista([]));
  }, []);
  if (!lista) return null;

  const mudar = (chave: string, parte: Partial<Rascunho>) =>
    definirLista((l) => l?.map((e) => (e.chave === chave ? { ...e, ...parte } : e)) ?? l);

  async function salvar(e: Rascunho) {
    const nutrientes = e.nutrientes.filter((n) => n.nutriente.trim() || n.fonte.trim());
    if (!e.nome.trim()) return definirRecado("Escreva o nome da entrada.");
    if (nutrientes.some((n) => !n.nutriente.trim() || !n.fonte.trim()))
      return definirRecado("Cada nutriente precisa do nome e da fonte. Sem fonte, não entra.");
    try {
      const { termosTexto, chave, ...resto } = e;
      const gravada = await repositorio.salvarEntradaDaBase({
        ...resto,
        nutrientes,
        termos: termosTexto.split(",").map((t) => t.trim()).filter(Boolean),
      });
      definirLista((l) => l?.map((x) => (x.chave === chave ? paraRascunho(gravada) : x)) ?? l);
      definirRecado(`"${gravada.nome}" salva${gravada.conferidoEm ? ", conferida por você" : ", ainda para conferir"}.`);
    } catch (erro) {
      definirRecado(erro instanceof Error ? erro.message : "Não consegui salvar.");
    }
  }

  async function apagar(e: Rascunho) {
    try {
      if (e.id) await repositorio.apagarEntradaDaBase(e.id);
      definirLista((l) => l?.filter((x) => x.chave !== e.chave) ?? l);
      definirRecado(`"${e.nome || "Entrada"}" apagada.`);
    } catch (erro) {
      definirRecado(erro instanceof Error ? erro.message : "Não consegui apagar.");
    } finally {
      definirApagando(null);
    }
  }

  return (
    <div className="c-bloco" id="base-de-medicamentos">
      <h2>Sua base de medicamentos</h2>
      <p className="c-dica">
        Medicamento ou classe e os nutrientes a acompanhar, cada um com a fonte. A base veio com fontes publicadas, marcada como
        para conferir. Só depois que você marca que conferiu ela vale no prontuário, no lembrete do pedido de exames e no PDF. A
        paciente não vê nada disto.
      </p>
      {recado && (
        <p className="c-dica" role="status">
          {recado}
        </p>
      )}
      {lista.map((e) => (
        <details key={e.chave} className="c-tour-adm c-base-med">
          <summary>
            <strong>{e.nome || "Nova entrada"}</strong>
            <span className={`c-selo ${e.conferidoEm ? "melhor" : "neutro"}`}>
              {e.conferidoEm ? `Conferida em ${dataBr(e.conferidoEm)}` : "Para conferir"}
            </span>
          </summary>
          <label className="c-campo">
            <span className="c-rotulo">Nome</span>
            <input className="c-input" value={e.nome} maxLength={80} onChange={(x) => mudar(e.chave, { nome: x.target.value })} />
          </label>
          <label className="c-campo">
            <span className="c-rotulo">Nomes que casam com o que a paciente usa (separados por vírgula)</span>
            <input className="c-input" value={e.termosTexto} onChange={(x) => mudar(e.chave, { termosTexto: x.target.value })} />
          </label>
          <p className="c-rotulo" style={{ marginTop: 10 }}>
            Nutrientes a acompanhar
          </p>
          {e.nutrientes.map((n, i) => (
            <div key={i} className="c-base-med-nutriente">
              <input
                className="c-input"
                aria-label="Nutriente"
                placeholder="Nutriente"
                value={n.nutriente}
                onChange={(x) => mudar(e.chave, { nutrientes: e.nutrientes.map((y, j) => (j === i ? { ...y, nutriente: x.target.value } : y)) })}
              />
              <textarea
                className="c-textarea"
                aria-label="Fonte"
                placeholder="Fonte: autor, título, revista, ano, doi"
                rows={2}
                value={n.fonte}
                onChange={(x) => mudar(e.chave, { nutrientes: e.nutrientes.map((y, j) => (j === i ? { ...y, fonte: x.target.value } : y)) })}
              />
              <button
                type="button"
                className="c-botao c-botao-secundario c-botao-pequeno"
                onClick={() => mudar(e.chave, { nutrientes: e.nutrientes.filter((_, j) => j !== i) })}
              >
                Tirar
              </button>
            </div>
          ))}
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            onClick={() => mudar(e.chave, { nutrientes: [...e.nutrientes, { nutriente: "", fonte: "" }] })}
          >
            + Nutriente
          </button>
          <label className="c-campo">
            <span className="c-rotulo">Sua anotação (só você vê)</span>
            <textarea className="c-textarea" rows={2} maxLength={2000} value={e.anotacao ?? ""} onChange={(x) => mudar(e.chave, { anotacao: x.target.value || null })} />
          </label>
          <label className="c-chip" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={Boolean(e.conferidoEm)}
              onChange={(x) => mudar(e.chave, { conferidoEm: x.target.checked ? hojeSaoPaulo() : null })}
            />
            Conferi os nutrientes e as fontes
          </label>
          <div className="c-acoes" style={{ marginTop: 10 }}>
            <button type="button" className="c-botao c-botao-pequeno" onClick={() => void salvar(e)}>
              Salvar
            </button>
            {apagando === e.chave ? (
              <button type="button" className="c-botao c-botao-perigo c-botao-pequeno" onClick={() => void apagar(e)}>
                Apagar de vez
              </button>
            ) : (
              <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={() => definirApagando(e.chave)}>
                Apagar
              </button>
            )}
          </div>
        </details>
      ))}
      <button
        type="button"
        className="c-botao c-botao-secundario c-botao-pequeno"
        style={{ marginTop: 10 }}
        onClick={() =>
          definirLista((l) => [
            ...(l ?? []),
            { nome: "", termos: [], termosTexto: "", nutrientes: [{ nutriente: "", fonte: "" }], conferidoEm: null, anotacao: null, chave: `novo-${Date.now()}` },
          ])
        }
      >
        + Nova entrada
      </button>
    </div>
  );
}
