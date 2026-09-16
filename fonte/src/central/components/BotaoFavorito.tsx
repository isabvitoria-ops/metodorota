import { Icone, IconeCoracaoCheio } from "./Icone";
import { useEstaSalvo, useFavoritos, type NovoFavorito } from "@/central/hooks/useFavoritos";

/**
 * Botão de salvar (§23). Serve para qualquer tipo de conteúdo — alimento,
 * troca, categoria, opção, guia — porque o favorito é só uma referência
 * (tipo + id + rota), não uma cópia do conteúdo.
 */
export function BotaoFavorito({ item, classe = "c-favoritar" }: { item: NovoFavorito; classe?: string }) {
  const salvo = useEstaSalvo(item.tipo, item.refId);
  const alternar = useFavoritos((estado) => estado.alternar);

  return (
    <button
      type="button"
      className={classe}
      aria-pressed={salvo}
      aria-label={salvo ? `Remover ${item.titulo} dos salvos` : `Salvar ${item.titulo}`}
      onClick={(evento) => {
        evento.stopPropagation();
        evento.preventDefault();
        alternar(item);
      }}
    >
      {salvo ? <IconeCoracaoCheio tamanho={18} /> : <Icone nome="salvos" tamanho={18} />}
      {classe !== "c-favoritar" && <span>{salvo ? "Salvo" : "Salvar"}</span>}
    </button>
  );
}
