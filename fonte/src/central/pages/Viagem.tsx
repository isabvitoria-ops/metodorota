import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icone } from "@/central/components/Icone";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";

export function Viagem() {
  const navegar = useNavigate();
  const { configuracoes } = useSessao();
  const [destino, definirDestino] = useState("");
  const [ida, definirIda] = useState("");
  const [volta, definirVolta] = useState("");
  const [obs, definirObs] = useState("");
  const [enviado, definirEnviado] = useState(false);

  const whatsapp = configuracoes.whatsapp.replace(/\D/g, "");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!destino.trim() || !ida) return;

    const partes = [
      "Oi! Quero avisar sobre uma viagem:",
      `Destino: ${destino.trim()}`,
      `Ida: ${ida.split("-").reverse().join("/")}`,
    ];
    if (volta) partes.push(`Volta: ${volta.split("-").reverse().join("/")}`);
    if (obs.trim()) partes.push(`Observações: ${obs.trim()}`);

    const texto = encodeURIComponent(partes.join("\n"));

    if (whatsapp) {
      window.open(`https://wa.me/${whatsapp}?text=${texto}`, "_blank", "noopener");
    }

    definirEnviado(true);
  }

  if (enviado) {
    return (
      <main className="c-pagina">
        <div className="c-card-viagem-confirmacao">
          <span className="c-card-viagem-emoji" aria-hidden="true">✅</span>
          <h2>Mensagem preparada!</h2>
          <p>
            {whatsapp
              ? "O WhatsApp abriu com a mensagem pronta. É só enviar."
              : "Copie os dados abaixo e envie para sua nutricionista."}
          </p>
          <button type="button" className="c-botao" onClick={() => navegar(rotas.home)}>
            Voltar para o início
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="c-pagina">
      <header className="c-cabecalho-pagina">
        <button type="button" className="c-voltar" onClick={() => navegar(-1)} aria-label="Voltar">
          <Icone nome="voltar" tamanho={20} />
        </button>
        <h1>Viagem programada</h1>
      </header>

      <p className="c-subtitulo" style={{ marginBottom: 16 }}>
        Avise sua nutricionista com antecedência para que ela prepare
        orientações especiais para a viagem.
      </p>

      <form onSubmit={enviar} className="c-form-viagem">
        <label className="c-campo">
          <span className="c-campo-rotulo">Para onde você vai? *</span>
          <input
            type="text"
            className="c-campo-input"
            value={destino}
            onChange={(e) => definirDestino(e.target.value)}
            placeholder="Ex.: Florianópolis"
            required
          />
        </label>

        <label className="c-campo">
          <span className="c-campo-rotulo">Data de ida *</span>
          <input
            type="date"
            className="c-campo-input"
            value={ida}
            onChange={(e) => definirIda(e.target.value)}
            required
          />
        </label>

        <label className="c-campo">
          <span className="c-campo-rotulo">Data de volta</span>
          <input
            type="date"
            className="c-campo-input"
            value={volta}
            onChange={(e) => definirVolta(e.target.value)}
          />
        </label>

        <label className="c-campo">
          <span className="c-campo-rotulo">Observações</span>
          <textarea
            className="c-campo-input"
            value={obs}
            onChange={(e) => definirObs(e.target.value)}
            placeholder="Ex.: vou ficar na casa de parentes, não vou ter cozinha..."
            rows={3}
          />
        </label>

        <button type="submit" className="c-botao" disabled={!destino.trim() || !ida}>
          Enviar pelo WhatsApp
        </button>
      </form>
    </main>
  );
}
