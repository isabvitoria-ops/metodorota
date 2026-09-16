import { Icone } from "@/central/components/Icone";
import { dataBonita } from "@/central/utils/situacao";
import { useSessao } from "./SessaoContexto";

/**
 * A tela de quem está autenticado mas sem acesso liberado (§30 do briefing).
 *
 * O tom importa: o paciente não fez nada de errado, o período dele acabou.
 * A tela diz o que aconteceu, quando aconteceu, e dá o caminho para
 * resolver, que é falar com a nutricionista.
 *
 * Nenhum conteúdo protegido está por trás dela — e não é porque a tela
 * esconde: é porque o banco não entrega. Trocar a URL na barra de endereço
 * traz esta mesma tela.
 */
const MENSAGENS: Record<string, { titulo: string; texto: string }> = {
  expirado: {
    titulo: "Seu acesso terminou",
    texto: "Seu período de acompanhamento chegou ao fim. Fale com sua nutricionista para renovar.",
  },
  suspenso: {
    titulo: "Seu acesso está pausado",
    texto: "Sua nutricionista pausou temporariamente o seu acesso. Fale com ela para retomar.",
  },
  nao_iniciado: {
    titulo: "Seu acesso ainda não começou",
    texto: "Tudo certo com o seu cadastro. Volte aqui na data de início combinada.",
  },
  convite_pendente: {
    titulo: "Falta um passo",
    texto: "Seu cadastro existe, mas ainda não foi vinculado a esta conta. Fale com sua nutricionista.",
  },
  sem_cadastro: {
    titulo: "Acesso não liberado",
    texto:
      "Esta conta foi criada, mas ainda não está ligada a um acompanhamento. Se você é paciente, fale com sua nutricionista.",
  },
};

export function SemAcesso() {
  const { acesso, configuracoes, sair } = useSessao();

  const chave = String(acesso.situacao);
  const mensagem = MENSAGENS[chave] ?? MENSAGENS.sem_cadastro!;
  const mostrarFim = chave === "expirado" && acesso.dataFim;

  const whatsapp = configuracoes.whatsapp.replace(/\D/g, "");
  const texto = encodeURIComponent(
    `Olá! Sou ${acesso.nome ?? "paciente"} e gostaria de renovar meu acesso à ${configuracoes.nomeCentral}.`,
  );

  return (
    <div className="central">
      <div className="c-conta">
        <div className="c-conta-caixa" style={{ textAlign: "center" }}>
          <div className="c-vazio-icone" style={{ margin: "0 auto 18px" }}>
            <Icone nome="relogio" tamanho={24} />
          </div>
          <h1 className="c-titulo" style={{ fontSize: 27 }}>
            {mensagem.titulo}
          </h1>
          <p className="c-subtitulo" style={{ margin: "10px auto 0" }}>
            {mensagem.texto}
          </p>

          {mostrarFim && (
            <p className="c-dica" style={{ marginTop: 14 }}>
              Período: {dataBonita(acesso.dataInicio)} a {dataBonita(acesso.dataFim)}
              {acesso.plano ? ` · plano ${acesso.plano}` : ""}
            </p>
          )}

          <div style={{ marginTop: 26, display: "grid", gap: 10 }}>
            {whatsapp ? (
              <a className="c-botao" href={`https://wa.me/${whatsapp}?text=${texto}`} target="_blank" rel="noreferrer">
                Falar no WhatsApp
              </a>
            ) : (
              <p className="c-dica">
                Sua nutricionista ainda não cadastrou um WhatsApp de contato.
              </p>
            )}
            <button type="button" className="c-link" onClick={() => void sair()}>
              Sair desta conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
