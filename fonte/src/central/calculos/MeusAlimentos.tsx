/**
 * O que nenhuma tabela traz: os alimentos dela (whey de uma marca, pão da
 * padaria), as medidas caseiras, os grupos que ela mais usa e a TBCA que ela
 * carrega do computador. Tudo guardado neste navegador, nas mesmas chaves da
 * ferramenta antiga (ver nutri/meusAlimentos.mjs e nutri/tabelaImportada.mjs).
 */
import { useRef, useState } from "react";
import { opcaoAtiva } from "./motor/dieta.mjs";
import { excluirAlimento, excluirGrupo, listarAlimentos, listarGrupos, salvarAlimento, salvarGrupo } from "./motor/meusAlimentos.mjs";
import { apagarTabela, importarTabela, lerTabela } from "./motor/tabelaImportada.mjs";
import type { Dieta } from "./estado";
import { base, mostrar, type ItemDaDieta } from "./tabela";
import { Avisos, BotaoConfirmar, CampoSelecao, CampoTexto, Grade, Secao } from "./ui";

type Meu = {
  id: string;
  nome: string;
  energia_kcal: number | null;
  carboidrato: number | null;
  proteina: number | null;
  lipideos: number | null;
  fibra_alimentar: number | null;
  medidas: { nome: string; gramas: number }[];
};
type Grupo = { id: string; nome: string; itens: ItemDaDieta[] };

const CAMPOS: [keyof Meu, string][] = [
  ["energia_kcal", "Calorias (kcal)"],
  ["carboidrato", "Carboidrato (g)"],
  ["proteina", "Proteína (g)"],
  ["lipideos", "Gordura (g)"],
  ["fibra_alimentar", "Fibra (g)"],
];

function FormularioDeAlimento({ existente, aoFechar }: { existente: Meu | null; aoFechar: (salvou: boolean) => void }) {
  const texto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
  const [nome, definirNome] = useState(existente?.nome ?? "");
  const [valores, definirValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS.map(([k]) => [k, texto(existente?.[k] as number | null)])),
  );
  const [medidas, definirMedidas] = useState((existente?.medidas ?? []).map((m) => `${m.nome} = ${String(m.gramas).replace(".", ",")}`).join("\n"));
  const [erro, definirErro] = useState<string | null>(null);
  return (
    <div className="c-cx-formulario">
      <h4 className="c-calc-subtitulo">{existente ? `Editar ${existente.nome}` : "Cadastrar alimento"}</h4>
      <Grade>
        <CampoTexto rotulo="Nome do alimento" numero={false} valor={nome} aoMudar={definirNome} />
      </Grade>
      <p className="c-calc-dica" style={{ marginTop: 10 }}>
        Valores por 100 g, como nas tabelas. Campo em branco fica desconhecido, não zero.
      </p>
      <Grade>
        {CAMPOS.map(([k, rotulo]) => (
          <CampoTexto key={k} rotulo={rotulo} valor={valores[k] ?? ""} aoMudar={(v) => definirValores((x) => ({ ...x, [k]: v }))} />
        ))}
      </Grade>
      <label className="c-campo" style={{ display: "block", marginTop: 14 }}>
        <span className="c-rotulo">Medidas caseiras, uma por linha</span>
        <textarea className="c-textarea" rows={3} placeholder={"scoop = 30\nunidade = 50"} value={medidas} onChange={(e) => definirMedidas(e.target.value)} />
        <span className="c-dica">O número é em gramas. Deixe em branco se não houver.</span>
      </label>
      {erro && <Avisos linhas={[erro]} tom="erro" />}
      <div className="c-cx-linha" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          onClick={() => {
            try {
              salvarAlimento({
                id: existente?.id,
                nome,
                grupo: "Meus alimentos",
                ...valores,
                medidas: medidas
                  .split("\n")
                  .map((l) => l.split("="))
                  .map(([n, g]) => ({ nome: (n ?? "").trim(), gramas: (g ?? "").trim() })),
              });
              aoFechar(true);
            } catch (e) {
              definirErro(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Salvar alimento
        </button>
        <button type="button" className="c-link" onClick={() => aoFechar(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function MeusAlimentos({ dieta, aoMudar }: { dieta: Dieta; aoMudar: () => void }) {
  const [, definirTique] = useState(0);
  const [editando, definirEditando] = useState<Meu | "novo" | null>(null);
  const [criandoGrupo, definirCriandoGrupo] = useState(false);
  const [deRefeicao, definirDeRefeicao] = useState("0");
  const [nomeGrupo, definirNomeGrupo] = useState("");
  const [aviso, definirAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const meus = listarAlimentos() as Meu[];
  const grupos = listarGrupos() as Grupo[];
  const tabela = lerTabela() as { alimentos: { medidas?: unknown[] }[]; fonte: { sigla: string; nome: string; citacao?: string; licenca?: string } } | null;
  const recarregar = () => {
    base.remontar();
    definirTique((t) => t + 1);
    aoMudar();
  };
  const comItens = dieta.refeicoes
    .map((r) => ({ nome: r.nome, itens: (opcaoAtiva(r) as { itens: ItemDaDieta[] }).itens }))
    .filter((r) => r.itens.length);

  return (
    <>
      <Secao
        numero={4}
        titulo="Meus alimentos e grupos"
        dica="O que nenhuma tabela traz: o whey de uma marca, o pão da padaria, a receita da casa. E os grupos que você mais usa, para acrescentar de uma vez."
      >
        <div className="c-cx-linha" style={{ marginTop: 12 }}>
          <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={() => definirEditando("novo")}>
            + Cadastrar alimento
          </button>
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            onClick={() => {
              if (!comItens.length) {
                definirAviso({ texto: "Monte uma refeição com os alimentos que você quer no grupo e toque aqui de novo." });
                return;
              }
              definirDeRefeicao("0");
              definirNomeGrupo(comItens[0]!.nome);
              definirCriandoGrupo(true);
            }}
          >
            + Criar grupo
          </button>
        </div>
        {aviso && <Avisos linhas={[aviso.texto]} tom={aviso.erro ? "erro" : "aviso"} />}

        {editando && (
          <FormularioDeAlimento
            existente={editando === "novo" ? null : editando}
            aoFechar={(salvou) => {
              definirEditando(null);
              if (salvou) recarregar();
            }}
          />
        )}

        {criandoGrupo && (
          <div className="c-cx-formulario">
            <h4 className="c-calc-subtitulo">Criar grupo a partir de uma refeição</h4>
            <Grade>
              <CampoSelecao
                rotulo="De qual refeição"
                valor={deRefeicao}
                aoMudar={(v) => {
                  definirDeRefeicao(v);
                  definirNomeGrupo(comItens[Number(v)]?.nome ?? "");
                }}
                opcoes={comItens.map((r, i) => ({ valor: String(i), rotulo: `${r.nome} (${r.itens.length})` }))}
              />
              <CampoTexto rotulo="Nome do grupo" numero={false} valor={nomeGrupo} aoMudar={definirNomeGrupo} />
            </Grade>
            <div className="c-cx-linha" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="c-botao c-botao-pequeno"
                onClick={() => {
                  const de = comItens[Number(deRefeicao)];
                  if (!de || !nomeGrupo.trim()) return;
                  try {
                    salvarGrupo({ nome: nomeGrupo, itens: de.itens });
                    definirCriandoGrupo(false);
                    definirAviso(null);
                    recarregar();
                  } catch (e) {
                    definirAviso({ texto: e instanceof Error ? e.message : String(e), erro: true });
                  }
                }}
              >
                Salvar grupo
              </button>
              <button type="button" className="c-link" onClick={() => definirCriandoGrupo(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <h4 className="c-calc-subtitulo">Meus alimentos</h4>
        {meus.length === 0 ? (
          <p className="c-calc-dica">Nenhum alimento seu ainda.</p>
        ) : (
          <ul className="c-cx-lista">
            {meus.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.nome}</strong>
                  <span className="c-calc-dica">
                    por 100 g: {mostrar(a.energia_kcal, 0)} kcal · CHO {mostrar(a.carboidrato, 1)} · PTN {mostrar(a.proteina, 1)} · LIP{" "}
                    {mostrar(a.lipideos, 1)} · Fibra {mostrar(a.fibra_alimentar, 1)}
                    {a.medidas.length ? ` · ${a.medidas.map((m) => `${m.nome} = ${mostrar(m.gramas, m.gramas % 1 ? 1 : 0)} g`).join(", ")}` : ""}
                  </span>
                </div>
                <div className="c-cx-lista-acoes">
                  <button type="button" className="c-link" onClick={() => definirEditando(a)}>
                    Editar
                  </button>
                  <BotaoConfirmar
                    classe="c-link"
                    rotulo="Apagar"
                    pergunta="Apagar mesmo?"
                    titulo="As dietas que já usam este alimento ficam sem ele."
                    aoConfirmar={() => {
                      excluirAlimento(a.id);
                      recarregar();
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <h4 className="c-calc-subtitulo">Meus grupos</h4>
        {grupos.length === 0 ? (
          <p className="c-calc-dica">Nenhum grupo ainda. Monte uma refeição e toque em “Criar grupo”.</p>
        ) : (
          <ul className="c-cx-lista">
            {grupos.map((g) => (
              <li key={g.id}>
                <div>
                  <strong>{g.nome}</strong>
                  <span className="c-cx-grupo-itens">
                    {g.itens.length === 0 && <span className="c-calc-dica">sem alimentos</span>}
                    {g.itens.map((item) => (
                      <button
                        key={item.codigo}
                        type="button"
                        className="c-cx-chip"
                        title={`Tirar ${item.nome} do grupo`}
                        onClick={() => {
                          salvarGrupo({ ...g, itens: g.itens.filter((i) => i.codigo !== item.codigo) });
                          recarregar();
                        }}
                      >
                        {item.nome} <span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </span>
                </div>
                <div className="c-cx-lista-acoes">
                  <BotaoConfirmar
                    classe="c-link"
                    rotulo="Apagar grupo"
                    pergunta="Apagar mesmo?"
                    aoConfirmar={() => {
                      excluirGrupo(g.id);
                      recarregar();
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        numero={5}
        titulo="Tabela da TBCA (arquivo seu)"
        dica={
          <>
            A TBCA não pode ser publicada dentro do site: a licença dela é <strong>CC BY-NC-ND</strong> — não comercial e sem
            redistribuição. Então o arquivo é <strong>seu</strong>: você o carrega aqui uma vez e ele fica guardado{" "}
            <strong>neste navegador</strong>. Nada é enviado. Carregando, os alimentos aparecem na busca com a etiqueta{" "}
            <strong>TBCA</strong>, já com as medidas caseiras da própria tabela.
          </>
        }
      >
        <p className="c-calc-dica" style={{ marginTop: 10 }}>
          {tabela ? (
            <>
              <strong>{tabela.alimentos.length}</strong> alimentos carregados
              {tabela.alimentos.filter((a) => (a.medidas ?? []).length).length
                ? `, ${tabela.alimentos.filter((a) => (a.medidas ?? []).length).length} com medida caseira`
                : ""}
              .<br />
              <small>{tabela.fonte.citacao || tabela.fonte.nome}</small>
              {tabela.fonte.licenca && (
                <>
                  <br />
                  <small>{tabela.fonte.licenca}</small>
                </>
              )}
            </>
          ) : (
            "Nenhuma tabela carregada neste navegador."
          )}
        </p>
        <div className="c-cx-linha" style={{ marginTop: 12 }}>
          <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={() => arquivo.current?.click()}>
            Carregar arquivo da tabela
          </button>
          {tabela && (
            <BotaoConfirmar
              rotulo="Apagar a tabela carregada"
              pergunta={`Apagar a ${tabela.fonte.sigla}?`}
              aoConfirmar={() => {
                apagarTabela();
                recarregar();
              }}
            />
          )}
          <input
            ref={arquivo}
            type="file"
            accept="application/json,.json"
            aria-label="Arquivo da tabela de alimentos"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const t = importarTabela(await f.text()) as { alimentos: unknown[]; fonte: { sigla: string } };
                recarregar();
                definirAviso({ texto: `Carreguei ${t.alimentos.length} alimentos da ${t.fonte.sigla}. Eles já aparecem na busca, com a etiqueta da tabela.` });
              } catch (err) {
                definirAviso({ texto: err instanceof Error ? err.message : String(err), erro: true });
              }
            }}
          />
        </div>
      </Secao>
    </>
  );
}
