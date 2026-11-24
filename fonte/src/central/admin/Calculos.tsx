/**
 * Cálculos — a bancada da nutricionista dentro da MARVIA: dieta com as
 * tabelas (TACO, IBGE, USDA, os alimentos dela e a TBCA), composição corporal
 * com gasto energético, e macros.
 *
 * Reescrita no visual do app a partir da ferramenta que vivia em /nutri/. As
 * CONTAS são os mesmos arquivos de lá (src/central/calculos/motor/, com os
 * testes), e as fichas são as mesmas: a mesma gaveta do navegador, o mesmo
 * formato. Uma ficha salva lá abre aqui igual. Os dados das pacientes
 * continuam só neste navegador — não sobem para servidor nenhum.
 */
import { useRef, useState } from "react";
import { useFicha } from "@/central/calculos/estado";
import { AbaDieta } from "@/central/calculos/AbaDieta";
import { AbaCorpo } from "@/central/calculos/AbaCorpo";
import { AbaMacros } from "@/central/calculos/AbaMacros";
import { BotaoConfirmar } from "@/central/calculos/ui";
import { ColinhaDeMedidas } from "./ColinhaDeMedidas";

type Aba = "dieta" | "corpo" | "macros";
const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "dieta", rotulo: "Dieta" },
  { chave: "corpo", rotulo: "Composição corporal" },
  { chave: "macros", rotulo: "Macros e gasto" },
];

export function Calculos() {
  const f = useFicha();
  const [aba, definirAba] = useState<Aba>("dieta");
  const [geracao, definirGeracao] = useState(0);
  const arquivo = useRef<HTMLInputElement>(null);

  return (
    <div className="c-calculos">
      <div className="c-calculos-cabeca">
        <div>
          <h1 className="c-titulo" style={{ fontSize: 28 }}>
            Cálculos
          </h1>
          <p className="c-subtitulo" style={{ marginTop: 4 }}>
            Dieta, composição corporal, macros e gasto. As fichas ficam guardadas neste navegador.
          </p>
        </div>
        {/* A ferramenta antiga continua no ar, lendo as mesmas fichas, enquanto
            esta é conferida no dia a dia. Sai quando ela aprovar. */}
        <div className="c-calculos-cabeca-acoes">
          <ColinhaDeMedidas />
          <a className="c-link" href={`${import.meta.env.BASE_URL}nutri/`} target="_blank" rel="noreferrer">
            Versão anterior
          </a>
        </div>
      </div>

      <section className="c-calc-secao c-cx-fichas" aria-label="Ficha da paciente">
        <div className="c-cx-fichas-linha">
          <label className="c-campo c-cx-fichas-nome">
            <span className="c-rotulo">Paciente desta ficha</span>
            <input className="c-input" placeholder="Nome da paciente" value={f.aberta.nome} onChange={(e) => f.mudarNome(e.target.value)} />
          </label>
          <label className="c-campo c-cx-fichas-lista">
            <span className="c-rotulo">Fichas salvas</span>
            <select
              className="c-select"
              value={f.salva ? f.aberta.id : ""}
              onChange={(e) => {
                if (e.target.value) {
                  f.abrir(e.target.value);
                  definirGeracao((g) => g + 1);
                }
              }}
            >
              <option value="">{f.fichas.length ? `Abrir ficha salva… (${f.fichas.length})` : "Nenhuma ficha salva ainda"}</option>
              {f.fichas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome || "sem nome"}
                  {x.atualizadoEm ? ` — ${new Date(x.atualizadoEm).toLocaleDateString("pt-BR")}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="c-cx-linha c-cx-fichas-acoes">
          <button
            type="button"
            className="c-botao c-botao-pequeno"
            onClick={() => {
              f.nova();
              definirGeracao((g) => g + 1);
            }}
          >
            + Nova ficha
          </button>
          <BotaoConfirmar
            rotulo="Apagar esta ficha"
            pergunta="Apagar mesmo? Não volta atrás."
            aoConfirmar={() => {
              f.apagar();
              definirGeracao((g) => g + 1);
            }}
          />
          <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={f.baixarBackup}>
            Baixar backup
          </button>
          <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={() => arquivo.current?.click()}>
            Restaurar backup
          </button>
          <input
            ref={arquivo}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Arquivo de backup das fichas"
            onChange={(e) => {
              const a = e.target.files?.[0];
              e.target.value = "";
              if (a) void f.restaurar(a, () => definirGeracao((g) => g + 1));
            }}
          />
        </div>
        <p className={`c-calc-dica${f.estado.alerta ? " c-cx-erro" : ""}`} role="status" style={{ marginTop: 10 }}>
          {f.estado.texto}
        </p>
        {f.lembrete && (
          <div className="c-aviso c-cx-aviso" role="status">
            <span>
              {f.lembrete.quantas} {f.lembrete.quantas === 1 ? "ficha está guardada" : "fichas estão guardadas"} só neste navegador
              {f.lembrete.dias === null ? ", e ainda não há backup" : `, e o último backup foi há ${f.lembrete.dias} dias`}. Se os
              dados do navegador forem limpos, {f.lembrete.quantas === 1 ? "ela some" : "elas somem"}. Toque em “Baixar backup” e
              guarde o arquivo fora do computador.
            </span>
          </div>
        )}
      </section>

      <div className="c-admin-abas c-cx-abas" role="tablist" aria-label="Partes do cálculo">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            aria-selected={aba === a.chave}
            className={`c-admin-aba ${aba === a.chave ? "ativo" : ""}`}
            onClick={() => definirAba(a.chave)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div key={geracao}>
        {aba === "dieta" && <AbaDieta nome={f.aberta.nome} dieta={f.aberta.dieta} mudarDieta={f.mudarDieta} />}
        {aba === "corpo" && <AbaCorpo corpo={f.aberta.corpo} mudar={f.mudarCorpo} />}
        {aba === "macros" && <AbaMacros macros={f.aberta.macros} mudar={f.mudarMacros} />}
      </div>
    </div>
  );
}
