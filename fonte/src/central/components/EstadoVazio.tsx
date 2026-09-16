import type { ReactNode } from "react";
import { Icone, type NomeIcone } from "./Icone";

/**
 * Tela vazia (§34, item 11).
 *
 * Em vários pontos a Central ainda não tem conteúdo — e isso é esperado,
 * porque o conteúdo é da nutricionista. O estado vazio explica o que vai
 * aparecer ali, em vez de parecer um erro ou uma tela quebrada.
 */
export function EstadoVazio({
  icone = "info",
  titulo,
  descricao,
  children,
}: {
  icone?: NomeIcone;
  titulo: string;
  descricao?: string;
  children?: ReactNode;
}) {
  return (
    <div className="c-vazio">
      <div className="c-vazio-icone">
        <Icone nome={icone} tamanho={24} />
      </div>
      <h3>{titulo}</h3>
      {descricao && <p>{descricao}</p>}
      {children}
    </div>
  );
}
