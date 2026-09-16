import { useRef, useState } from "react";
import { Logo } from "@/central/components/Logo";
import { LADO_MAXIMO, prepararLogo } from "@/central/utils/logo";

/**
 * Envio da logo de uma marca.
 *
 * A imagem não vai para servidor nenhum: ela é reduzida aqui mesmo, no
 * navegador, e guardada como texto junto do cadastro. Assim a logo também
 * aparece na versão de arquivo único, que roda sem rede.
 */
export function CampoLogo({
  nome,
  logo,
  aoMudar,
}: {
  nome: string;
  logo: string | null;
  aoMudar: (logo: string | null) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    definirErro(null);
    definirOcupado(true);
    const resultado = await prepararLogo(arquivo);
    definirOcupado(false);
    if (resultado.ok) aoMudar(resultado.dataUri);
    else definirErro(resultado.erro);
    if (entrada.current) entrada.current.value = "";
  }

  return (
    <div style={{ marginTop: 14 }}>
      <span className="c-rotulo">Logo</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
        <Logo nome={nome || "?"} logo={logo} tamanho={48} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            onClick={() => entrada.current?.click()}
            disabled={ocupado}
          >
            {ocupado ? "Preparando…" : logo ? "Trocar" : "Enviar logo"}
          </button>
          {logo && (
            <button type="button" className="c-link" onClick={() => aoMudar(null)}>
              Remover
            </button>
          )}
        </div>
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(e) => void escolher(e.target.files?.[0])}
      />
      <p className="c-dica">
        PNG, JPG, WEBP ou SVG. A imagem é reduzida para {LADO_MAXIMO} px e guardada junto do
        cadastro. Sem logo, aparece a inicial do nome.
      </p>
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert" style={{ marginTop: 8 }}>
          <span>{erro}</span>
        </div>
      )}
    </div>
  );
}
