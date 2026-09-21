import { useState } from "react";
import type { CardioSessao } from "@/central/types/treino";
import { repositorio } from "@/central/dados/repositorio";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * O cardio: ela anda, ela anota.
 *
 * O aplicativo NÃO prescreve cardio, não sugere duração e não define
 * intensidade. Registra o que aconteceu.
 *
 * DISTÂNCIA E INTENSIDADE SÃO OPCIONAIS, e ficam nulas quando em branco: a
 * bicicleta da academia não dá distância, e nem toda paciente tem zona de
 * intensidade definida. Zero diria que ela andou zero quilômetro, que é
 * afirmação diferente de "não dá para medir aqui".
 */
const TIPOS = ["Caminhada", "Corrida", "Bike", "Esteira", "Elíptico", "Natação", "Dança", "Outro"];

export function RegistroDeCardio({
  sessoes,
  somenteLeitura,
  aoMudar,
}: {
  sessoes: CardioSessao[];
  /** Na tela da nutricionista, ela lê o histórico e não registra por aqui. */
  somenteLeitura?: boolean;
  aoMudar: () => Promise<void>;
}) {
  const [aberto, definirAberto] = useState(false);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Cardio</h2>

      {!somenteLeitura && !aberto && (
        <button type="button" className="c-botao" onClick={() => definirAberto(true)}>
          Registrar cardio
        </button>
      )}

      {aberto && (
        <Formulario
          aoFechar={() => definirAberto(false)}
          aoSalvar={async () => {
            definirAberto(false);
            await aoMudar();
          }}
        />
      )}

      {sessoes.length === 0 ? (
        <p className="c-dica" style={{ marginTop: 10 }}>
          {somenteLeitura ? "Ela ainda não registrou cardio." : "Nada registrado ainda."}
        </p>
      ) : (
        <div className="c-bloco" style={{ marginTop: 12 }}>
          {sessoes.map((c) => (
            <div className="c-item-protocolo" key={c.id}>
              <div className="c-item-protocolo-linha">
                <span className="c-item-protocolo-nome">{c.tipo}</span>
                <span className="c-item-protocolo-quantidade">{dataBonita(c.data)}</span>
              </div>
              <p className="c-item-protocolo-trocas">{resumo(c)}</p>
              {c.observacao && <p className="c-nota-protocolo">{c.observacao}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** "30 min · 3,2 km · leve" — só o que existe, sem travessão de enfeite. */
function resumo(c: CardioSessao): string {
  const partes: string[] = [];
  if (c.duracaoMin !== null) partes.push(`${c.duracaoMin} min`);
  if (c.distanciaKm !== null) {
    partes.push(`${c.distanciaKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`);
  }
  if (c.intensidade) partes.push(c.intensidade.toLowerCase());
  return partes.join(" · ") || "Registrado.";
}

function Formulario({
  aoFechar,
  aoSalvar,
}: {
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const hoje = hojeSaoPaulo();
  const [data, definirData] = useState(hoje);
  const [tipo, definirTipo] = useState(TIPOS[0]!);
  const [duracao, definirDuracao] = useState("");
  const [distancia, definirDistancia] = useState("");
  const [intensidade, definirIntensidade] = useState("");
  const [observacao, definirObservacao] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  async function salvar() {
    // Sem duração não há o que somar na meta de minutos, e um registro sem
    // ela viraria uma linha que não conta para nada.
    if (duracao.trim() === "") {
      definirAviso("Escreva quantos minutos você fez.");
      return;
    }
    definirSalvando(true);
    definirAviso(null);
    try {
      await repositorio.registrarCardio(
        null,
        null,
        data,
        tipo,
        duracao,
        distancia,
        intensidade,
        observacao,
      );
      await aoSalvar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui registrar.");
      definirSalvando(false);
    }
  }

  return (
    <div className="c-bloco" style={{ marginTop: 12 }}>
      <div className="c-duas-colunas">
        <label className="c-campo">
          <span>Data</span>
          {/* `max` de hoje: o banco recusa data futura, e é melhor o
              calendário nem oferecer do que a mensagem de erro depois. */}
          <input type="date" value={data} max={hoje} onChange={(e) => definirData(e.target.value)} />
        </label>
        <label className="c-campo">
          <span>O que você fez</span>
          <select value={tipo} onChange={(e) => definirTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="c-duas-colunas">
        <label className="c-campo">
          <span>Minutos</span>
          <input
            type="text"
            inputMode="numeric"
            value={duracao}
            onChange={(e) => definirDuracao(e.target.value)}
          />
        </label>
        <label className="c-campo">
          <span>Distância em km (se souber)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={distancia}
            onChange={(e) => definirDistancia(e.target.value)}
          />
        </label>
      </div>

      <label className="c-campo">
        <span>Como foi a intensidade? (opcional)</span>
        <select value={intensidade} onChange={(e) => definirIntensidade(e.target.value)}>
          <option value="">Não vou marcar</option>
          <option value="Leve">Leve</option>
          <option value="Moderada">Moderada</option>
          <option value="Forte">Forte</option>
        </select>
      </label>

      <label className="c-campo">
        <span>Alguma observação? (opcional)</span>
        <textarea rows={2} value={observacao} onChange={(e) => definirObservacao(e.target.value)} />
      </label>

      {aviso && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso}</span>
        </div>
      )}

      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Registrando…" : "Registrar"}
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
