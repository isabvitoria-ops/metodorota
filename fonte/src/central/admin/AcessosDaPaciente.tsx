import { useCallback, useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";

/**
 * O que a paciente alcança — os interruptores num lugar só.
 *
 * O pedido era "controle de acesso uniforme, módulo a módulo". Ao levantar
 * quais módulos precisavam de interruptor, a conta deu DOIS (rastreio e
 * treino) mais um novo (desafio): protocolo, avaliação e metas já se
 * escondem sozinhos pela existência do conteúdo, e um interruptor em cima
 * disso daria dois lugares para desligar a mesma coisa.
 *
 * Então o que faltava não era mais interruptor: era ver os que existem
 * JUNTOS, em vez de um enterrado na tela de rastreabilidade e outro na de
 * treino. Os dois continuam existindo lá; aqui ela vê o mapa.
 *
 * ESTADO E INTERRUPTOR SÃO MOSTRADOS DIFERENTE, e a tela diz qual é qual.
 * "Protocolo: não publicado" com um botão ao lado prometeria um controle
 * que não existe.
 */
interface Acessos {
  rastreio: boolean;
  treino: boolean;
  desafio: boolean;
  protocolo: boolean;
  avaliacao: boolean;
  metas: boolean;
}

export function AcessosDaPaciente({ pacienteId }: { pacienteId: string }) {
  const [acessos, definirAcessos] = useState<Acessos | null>(null);
  const [ocupado, definirOcupado] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      definirAcessos(await repositorio.acessosDoPaciente(pacienteId));
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar os acessos.");
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!acessos) {
    return erro ? (
      <div className="c-aviso c-aviso-erro" role="alert">
        <span>{erro}</span>
      </div>
    ) : null;
  }

  async function alternar(qual: "treino" | "desafio", valor: boolean) {
    definirOcupado(qual);
    definirErro(null);
    try {
      // O que volta é o estado GRAVADO, não o que o clique pediu.
      const gravado =
        qual === "treino"
          ? await repositorio.definirTreinoDoPaciente(pacienteId, valor)
          : await repositorio.definirDesafioDoPaciente(pacienteId, valor);
      definirAcessos((antes) => (antes ? { ...antes, [qual]: gravado } : antes));
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui mudar.");
    } finally {
      definirOcupado(null);
    }
  }

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">O que ela vê no aplicativo</h2>

      <div className="c-bloco">
        <Interruptor
          nome="Treino"
          ligado={acessos.treino}
          ocupado={ocupado === "treino"}
          apoio={
            acessos.treino
              ? "Ela registra treino e cardio, e vê a evolução."
              : "A área não existe para ela — nem digitando o endereço."
          }
          aoMudar={() => void alternar("treino", !acessos.treino)}
        />

        <Interruptor
          nome="Desafio"
          ligado={acessos.desafio}
          ocupado={ocupado === "desafio"}
          apoio={
            acessos.desafio
              ? "Ela participa da pontuação e aparece no ranking."
              : "O desafio some da tela dela, sem aviso de que ficou de fora."
          }
          aoMudar={() => void alternar("desafio", !acessos.desafio)}
        />

        {/* Rastreio continua sendo ligado na tela de Rastreabilidade, junto
            da lista de alimentos: ligar sem montar a lista deixaria a
            paciente com uma tela vazia esperando. Aqui ele aparece só para
            ela enxergar o estado. */}
        <Estado
          nome="Rastreabilidade"
          ligado={acessos.rastreio}
          apoio={
            acessos.rastreio
              ? "Ligada. Você liga e desliga na aba Rastreabilidade."
              : "Desligada. Você liga na aba Rastreabilidade, junto com a lista dela."
          }
        />

        <Estado
          nome="Protocolo"
          ligado={acessos.protocolo}
          apoio={acessos.protocolo ? "Publicado." : "Nenhum publicado — a porta não aparece."}
        />
        <Estado
          nome="Avaliação"
          ligado={acessos.avaliacao}
          apoio={acessos.avaliacao ? "Publicada." : "Nenhuma publicada — a porta não aparece."}
        />
        <Estado
          nome="Metas"
          ligado={acessos.metas}
          apoio={acessos.metas ? "Tem metas." : "Nenhuma meta — a porta não aparece."}
        />
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
    </section>
  );
}

function Interruptor({
  nome,
  ligado,
  apoio,
  ocupado,
  aoMudar,
}: {
  nome: string;
  ligado: boolean;
  apoio: string;
  ocupado: boolean;
  aoMudar: () => void;
}) {
  return (
    <div className="c-acesso-linha">
      <span className="c-acesso-texto">
        <strong>{nome}</strong>
        <span>{apoio}</span>
      </span>
      <button
        type="button"
        className={`c-botao c-botao-pequeno ${ligado ? "c-botao-secundario" : ""}`}
        disabled={ocupado}
        onClick={aoMudar}
      >
        {ligado ? "Desligar" : "Ligar"}
      </button>
    </div>
  );
}

function Estado({ nome, ligado, apoio }: { nome: string; ligado: boolean; apoio: string }) {
  return (
    <div className="c-acesso-linha">
      <span className="c-acesso-texto">
        <strong>{nome}</strong>
        <span>{apoio}</span>
      </span>
      {/* Sem botão: é estado, não interruptor. Um botão desligado ao lado
          prometeria um controle que não existe. */}
      <span className={`c-selo-status ${ligado ? "c-selo-em-dia" : "c-selo-sem-acesso"}`}>
        {ligado ? "aparece" : "não aparece"}
      </span>
    </div>
  );
}
