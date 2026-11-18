import type { ReactNode } from "react";
import { Marca } from "./Marca";

/**
 * O topo comum dos documentos novos (receita, pedido de exames, lista de
 * compras, trocas): o mesmo do PDF do plano (classes `doc-pa-*` em
 * documentos-marca.css), sem a faixa do dia, que é só do plano.
 *
 * Um topo só para todos é o que faz três materiais diferentes parecerem da
 * mesma marca sem ninguém precisar corrigir um por um.
 */
export function CabecalhoDoDocumento({
  sobretitulo,
  titulo,
  paciente,
  data,
  children,
}: {
  sobretitulo: string;
  titulo: string;
  /** Nulo: material sem paciente (receita geral). */
  paciente: string | null;
  data?: string;
  children?: ReactNode;
}) {
  return (
    <header className="doc-pa-topo">
      <Marca variante="horizontal" altura={30} className="doc-pa-marca" />
      <div className="doc-pa-titulos">
        <div>
          <p className="doc-pa-sobretitulo">{sobretitulo}</p>
          <h1 className="doc-pa-titulo doc-novo-titulo">{titulo}</h1>
        </div>
        {(paciente || data) && (
          <div className="doc-pa-paciente">
            {paciente && (
              <>
                <span className="doc-pa-rotulo">Paciente</span>
                <strong>{paciente}</strong>
              </>
            )}
            {data && <span className="doc-pa-data">{data}</span>}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
