import { useCallback, useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type {
  RestricaoAlimentar,
  TipoRestricao,
  GravidadeRestricao,
} from "@/central/types/restricao";
import { Campo, Texto, Selecao, AreaTexto } from "@/central/admin/componentes/Campos";

interface Props {
  pacienteId: string;
}

const TIPOS: { valor: TipoRestricao; rotulo: string }[] = [
  { valor: "alergia", rotulo: "Alergia" },
  { valor: "intolerancia", rotulo: "Intolerância" },
  { valor: "sensibilidade", rotulo: "Sensibilidade" },
  { valor: "preferencia", rotulo: "Preferência" },
];

const GRAVIDADES: { valor: GravidadeRestricao; rotulo: string }[] = [
  { valor: "grave", rotulo: "Grave" },
  { valor: "moderada", rotulo: "Moderada" },
  { valor: "leve", rotulo: "Leve" },
];

const VAZIO: RestricaoForm = {
  id: null,
  tipo: "alergia",
  alimento: "",
  gravidade: "moderada",
  notas: "",
};

interface RestricaoForm {
  id: string | null;
  tipo: TipoRestricao;
  alimento: string;
  gravidade: GravidadeRestricao;
  notas: string;
}

function seloGravidade(g: GravidadeRestricao): string {
  const m: Record<GravidadeRestricao, string> = {
    grave: "c-restricao-selo c-restricao-selo-grave",
    moderada: "c-restricao-selo c-restricao-selo-moderada",
    leve: "c-restricao-selo c-restricao-selo-leve",
  };
  return m[g];
}

function rotuloTipo(t: TipoRestricao): string {
  const m: Record<TipoRestricao, string> = {
    alergia: "Alergia",
    intolerancia: "Intolerância",
    sensibilidade: "Sensibilidade",
    preferencia: "Preferência",
  };
  return m[t];
}

function rotuloGravidade(g: GravidadeRestricao): string {
  const m: Record<GravidadeRestricao, string> = {
    grave: "Grave",
    moderada: "Moderada",
    leve: "Leve",
  };
  return m[g];
}

export function RestricoesDoProntuario({ pacienteId }: Props) {
  const [lista, definirLista] = useState<RestricaoAlimentar[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [form, definirForm] = useState<RestricaoForm>({ ...VAZIO });
  const [aberto, definirAberto] = useState(false);
  const [salvando, definirSalvando] = useState(false);
  const [mensagem, definirMensagem] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await repositorio.restricoesDoPaciente(pacienteId);
      definirLista(r);
    } catch {
      /* silencioso */
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirNovo() {
    definirForm({ ...VAZIO });
    definirAberto(true);
    definirMensagem(null);
  }

  function editar(r: RestricaoAlimentar) {
    definirForm({
      id: r.id,
      tipo: r.tipo,
      alimento: r.alimento,
      gravidade: r.gravidade,
      notas: r.notas ?? "",
    });
    definirAberto(true);
    definirMensagem(null);
  }

  async function salvar() {
    if (!form.alimento.trim()) {
      definirMensagem("Informe o alimento.");
      return;
    }
    definirSalvando(true);
    definirMensagem(null);
    try {
      await repositorio.salvarRestricao(
        pacienteId,
        form.id,
        form.tipo,
        form.alimento.trim(),
        form.gravidade,
        form.notas.trim() || null,
      );
      definirAberto(false);
      definirForm({ ...VAZIO });
      await carregar();
    } catch (e) {
      definirMensagem(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta restrição?")) return;
    try {
      await repositorio.excluirRestricao(id);
      await carregar();
    } catch (e) {
      definirMensagem(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  if (carregando) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">
        Restrições alimentares
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          style={{ marginLeft: "auto" }}
          onClick={abrirNovo}
        >
          + Adicionar
        </button>
      </h2>

      {aberto && (
        <div className="c-restricao-form">
          <div className="c-linha-campos">
            <Campo rotulo="Alimento">
              <Texto
                valor={form.alimento}
                aoMudar={(v) => definirForm((f) => ({ ...f, alimento: v }))}
                placeholder="Ex.: Leite de vaca"
              />
            </Campo>
          </div>

          <div className="c-linha-campos">
            <Campo rotulo="Tipo">
              <Selecao<TipoRestricao>
                valor={form.tipo}
                aoMudar={(v) => definirForm((f) => ({ ...f, tipo: v }))}
                opcoes={TIPOS}
              />
            </Campo>
            <Campo rotulo="Gravidade">
              <Selecao<GravidadeRestricao>
                valor={form.gravidade}
                aoMudar={(v) => definirForm((f) => ({ ...f, gravidade: v }))}
                opcoes={GRAVIDADES}
              />
            </Campo>
          </div>

          <Campo rotulo="Notas (opcional)">
            <AreaTexto
              valor={form.notas}
              aoMudar={(v) => definirForm((f) => ({ ...f, notas: v }))}
              placeholder="Detalhes, sintomas, observações..."
              linhas={2}
            />
          </Campo>

          {mensagem && <p className="c-msg c-msg-erro">{mensagem}</p>}

          <div className="c-linha-campos" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="c-botao c-botao-fantasma"
              onClick={() => definirAberto(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="c-botao"
              disabled={salvando}
              onClick={salvar}
            >
              {salvando ? "Salvando..." : form.id ? "Atualizar" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {lista.length === 0 && !aberto && (
        <p className="c-dica" style={{ marginTop: 16 }}>
          Nenhuma restrição cadastrada. Clique em &quot;+ Adicionar&quot; para registrar alergias,
          intolerâncias ou preferências.
        </p>
      )}

      {lista.length > 0 && (
        <div className="c-restricao-lista">
          {lista.map((r) => (
            <div key={r.id} className="c-restricao-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>{r.alimento}</strong>
                <span className={seloGravidade(r.gravidade)}>{rotuloGravidade(r.gravidade)}</span>
                <span className="c-restricao-tipo">{rotuloTipo(r.tipo)}</span>
              </div>
              {r.notas && <p className="c-texto-muted" style={{ margin: "4px 0 0" }}>{r.notas}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="c-botao c-botao-pequeno c-botao-fantasma"
                  onClick={() => editar(r)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="c-botao c-botao-pequeno c-botao-fantasma c-botao-perigo"
                  onClick={() => excluir(r.id)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
