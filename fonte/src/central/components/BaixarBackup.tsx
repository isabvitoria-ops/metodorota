import { useState } from "react";
import { repositorio } from "@/central/dados/repositorio";

/**
 * Baixar um backup de tudo, num arquivo.
 *
 * NO PLANO GRATUITO O SUPABASE NÃO GUARDA CÓPIA DO BANCO. Se algo corromper
 * os dados, não existe volta — e o que está lá dentro é prontuário. Este
 * botão é a rede provisória até o plano com backup diário.
 *
 * E a tela DIZ ISSO em voz alta, inclusive a parte ruim: que é manual, que
 * ela precisa lembrar, e que o arquivo tem dado clínico e não pode ser
 * guardado em qualquer lugar. Um botão "Baixar backup" sem essas três
 * frases daria a ela uma sensação de segurança que o arquivo sozinho não
 * sustenta — e sensação errada de segurança é pior do que nenhuma.
 */
export function BaixarBackup() {
  const [baixando, definirBaixando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  async function baixar() {
    definirBaixando(true);
    definirAviso(null);
    definirErro(null);
    try {
      const dados = await repositorio.exportarTudo();

      // O nome do arquivo leva a DATA: baixando duas vezes no mesmo mês, o
      // navegador guardaria "backup (1).json" e ela não saberia qual é o
      // mais novo. Foi o que aconteceu com o `index (1).html` do site.
      const hoje = new Date().toISOString().slice(0, 10);
      const texto = JSON.stringify(dados, null, 2);
      const endereco = URL.createObjectURL(
        new Blob([texto], { type: "application/json" }),
      );

      const link = document.createElement("a");
      link.href = endereco;
      link.download = `central-do-paciente-${hoje}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      // Soltar o endereço depois do clique: soltando antes, o navegador
      // baixa um arquivo vazio.
      URL.revokeObjectURL(endereco);

      const tamanho = Math.max(1, Math.round(texto.length / 1024));
      definirAviso(
        `Backup baixado (${tamanho.toLocaleString("pt-BR")} KB). Guarde no Drive, não só no computador.`,
      );
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui gerar o backup.");
    } finally {
      definirBaixando(false);
    }
  }

  return (
    <section className="c-secao" style={{ maxWidth: 520 }}>
      <h2 className="c-secao-titulo">Backup</h2>

      <div className="c-bloco">
        <p className="c-item-protocolo-nome">Baixar uma cópia de tudo</p>
        <p className="c-dica" style={{ marginTop: 6 }}>
          Um arquivo com todas as pacientes, protocolos, avaliações, consultas, metas, treinos e
          registros. Serve para você não ficar sem nada se algo der errado no banco.
        </p>
        <p className="c-dica">
          <strong>É manual:</strong> só existe a cópia do dia em que você clicar. Vale fazer uma
          por semana. E o arquivo tem dado clínico das suas pacientes — guarde num lugar seu, como
          o Drive, e não mande por WhatsApp nem deixe em computador compartilhado.
        </p>

        <button
          type="button"
          className="c-botao"
          style={{ marginTop: 12 }}
          disabled={baixando}
          onClick={() => void baixar()}
        >
          {baixando ? "Gerando…" : "Baixar backup agora"}
        </button>

        {(aviso || erro) && (
          <div className={`c-aviso ${erro ? "c-aviso-erro" : "c-aviso-ok"}`} role="status">
            <span>{erro ?? aviso}</span>
          </div>
        )}
      </div>
    </section>
  );
}
