import type { FormEvent, ReactNode } from "react";
import { Icone } from "@/central/components/Icone";
import { useSessao } from "./SessaoContexto";

/**
 * Moldura das telas de conta (entrar, definir senha, recuperar).
 *
 * Uma tela só de verdade, com bastante ar: quem chega aqui está com o
 * celular na mão, muitas vezes pela primeira vez, e não deve ter dúvida do
 * que fazer.
 */
export function TelaConta({
  titulo,
  descricao,
  aoEnviar,
  children,
  rodape,
  erro,
  aviso,
}: {
  titulo: string;
  descricao?: string;
  aoEnviar: (evento: FormEvent) => void;
  children: ReactNode;
  rodape?: ReactNode;
  erro?: string | null;
  aviso?: string | null;
}) {
  const { configuracoes } = useSessao();

  return (
    <div className="central">
      <div className="c-conta">
        <div className="c-conta-caixa">
          <p className="c-marca">{configuracoes.nomeCentral}</p>
          <h1 className="c-titulo" style={{ fontSize: 28, marginTop: 10 }}>
            {titulo}
          </h1>
          {descricao && <p className="c-subtitulo">{descricao}</p>}

          <form onSubmit={aoEnviar} style={{ marginTop: 22 }}>
            {children}
          </form>

          {erro && (
            <div className="c-aviso c-aviso-erro" role="alert">
              <Icone nome="alerta" tamanho={19} />
              <span>{erro}</span>
            </div>
          )}
          {aviso && (
            <div className="c-aviso c-aviso-ok" role="status">
              <Icone nome="info" tamanho={19} />
              <span>{aviso}</span>
            </div>
          )}

          {rodape && <div className="c-conta-rodape">{rodape}</div>}
        </div>
      </div>
    </div>
  );
}

export function CampoTexto({
  id,
  rotulo,
  tipo = "text",
  valor,
  aoMudar,
  placeholder,
  autoComplete,
  dica,
}: {
  id: string;
  rotulo: string;
  tipo?: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  dica?: string;
}) {
  return (
    <div className="c-campo">
      <label className="c-rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <input
        id={id}
        className="c-input"
        type={tipo}
        value={valor}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={tipo === "email" ? "email" : undefined}
        onChange={(e) => aoMudar(e.target.value)}
      />
      {dica && <p className="c-dica">{dica}</p>}
    </div>
  );
}
