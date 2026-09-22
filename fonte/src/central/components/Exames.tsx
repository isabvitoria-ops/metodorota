import { useCallback, useEffect, useRef, useState } from "react";
import type { Exame } from "@/central/types/exame";
import { repositorio } from "@/central/dados/repositorio";
import { porQueNaoServe, tamanhoBonito, TIPOS_ACEITOS } from "@/central/utils/exames";

/**
 * Exames guardados — o mesmo componente dos dois lados.
 *
 * `pacienteId` nulo quer dizer "sou a paciente, são os meus". Preenchido,
 * é a nutricionista olhando a ficha de alguém.
 *
 * UM COMPONENTE SÓ porque a lista é a mesma coisa vista por duas pessoas.
 * Dois desenhos para a mesma lista acabariam discordando — e aqui discordar
 * significaria uma das duas não ver um exame que existe.
 *
 * O QUE MUDA ENTRE OS DOIS LADOS não é o desenho, é o que cada uma pode
 * apagar: a paciente desfaz o próprio envio (mandar o arquivo errado
 * acontece, e às vezes é o arquivo de outra pessoa), mas não apaga o que a
 * nutricionista guardou, que é registro clínico. Quem decide isso é o
 * banco; a tela só não mostra o botão que seria recusado.
 */
function diaCurto(iso: string | null, alternativa: string): string {
  const base = iso ?? alternativa.slice(0, 10);
  const [ano, mes, dia] = base.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : base;
}

export function Exames({ pacienteId }: { pacienteId: string | null }) {
  const souNutricionista = pacienteId !== null;
  const [lista, definirLista] = useState<Exame[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [enviando, definirEnviando] = useState(false);
  const [data, definirData] = useState("");
  const [descricao, definirDescricao] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    definirCarregando(true);
    try {
      definirLista(
        pacienteId === null
          ? await repositorio.meusExames()
          : await repositorio.examesDoPaciente(pacienteId),
      );
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar os exames.");
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar(arquivo: File) {
    // A tela recusa cedo e explica; o balde recusa de novo do outro lado.
    // A daqui é cortesia, a de lá é a fechadura.
    const recusa = porQueNaoServe(arquivo);
    if (recusa) {
      definirErro(recusa);
      return;
    }
    definirEnviando(true);
    definirErro(null);
    try {
      await repositorio.enviarExame(pacienteId, arquivo, data || null, descricao.trim() || null);
      definirData("");
      definirDescricao("");
      if (campoArquivo.current) campoArquivo.current.value = "";
      definirAviso("Exame guardado.");
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui enviar.");
    } finally {
      definirEnviando(false);
    }
  }

  async function abrir(exame: Exame) {
    try {
      const endereco = await repositorio.enderecoDoExame(exame.caminho);
      window.open(endereco, "_blank", "noopener,noreferrer");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui abrir.");
    }
  }

  async function apagar(exame: Exame) {
    try {
      await repositorio.apagarExame(exame.id);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui apagar.");
    }
  }

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Exames</h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        {souNutricionista
          ? "Os exames desta paciente, os que ela mandou e os que você guardou. Ficam numa pasta privada: o endereço do arquivo expira em poucos minutos."
          : "Seus exames ficam guardados aqui, numa pasta privada que só você e sua nutricionista abrem. Melhor do que perder no meio do WhatsApp."}
      </p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}
      {aviso && !erro && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}

      <div className="c-duas-colunas">
        <label className="c-campo-rotulo">
          Data do exame (opcional)
          <input
            className="c-campo"
            type="date"
            value={data}
            onChange={(e) => definirData(e.target.value)}
          />
          <span className="c-dica">
            A data da coleta, que costuma ser diferente do dia em que você manda.
          </span>
        </label>
        <label className="c-campo-rotulo">
          O que é (opcional)
          <input
            className="c-campo"
            type="text"
            value={descricao}
            onChange={(e) => definirDescricao(e.target.value)}
            placeholder="Hemograma, vitamina D…"
          />
        </label>
      </div>

      <label className="c-campo-rotulo">
        Arquivo
        <input
          ref={campoArquivo}
          className="c-campo"
          type="file"
          accept={TIPOS_ACEITOS.join(",")}
          disabled={enviando}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void enviar(arquivo);
          }}
        />
        <span className="c-dica">PDF ou foto, até 10 MB.</span>
      </label>

      {enviando && <p className="c-contagem">Enviando…</p>}
      {carregando && <p className="c-contagem">Carregando…</p>}

      {!carregando && lista.length === 0 && (
        <p className="c-dica">
          {souNutricionista
            ? "Nenhum exame guardado para esta paciente ainda."
            : "Você ainda não guardou nenhum exame aqui."}
        </p>
      )}

      {lista.map((exame) => {
        // A paciente só apaga o que ELA mandou. O botão some em vez de
        // aparecer e ser recusado depois do clique.
        const podeApagar = souNutricionista || exame.origem === "paciente";
        return (
          <div className="c-bloco" key={exame.id}>
            <div className="c-bloco-topo">
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="c-lista-item-nome">{exame.descricao ?? exame.nome}</span>
                <span className="c-lista-item-apoio">
                  {diaCurto(exame.data, exame.criadoEm)}
                  {exame.data === null && " (data do envio)"} · {tamanhoBonito(exame.tamanho)}
                  {souNutricionista &&
                    (exame.origem === "paciente" ? " · ela mandou" : " · você guardou")}
                </span>
              </span>
            </div>
            <div className="c-chips">
              <button type="button" className="c-chip" onClick={() => void abrir(exame)}>
                Abrir
              </button>
              {podeApagar && (
                <button type="button" className="c-chip" onClick={() => void apagar(exame)}>
                  Apagar
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
