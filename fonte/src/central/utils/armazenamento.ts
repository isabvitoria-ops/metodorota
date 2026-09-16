/**
 * Persistência local (§23, §24, §30).
 *
 * Uma interface minúscula na frente do localStorage. Os hooks só conhecem
 * `ler`/`escrever`; no dia em que os favoritos forem para o Supabase, troca-se
 * a implementação aqui (devolvendo `Promise`) sem mexer em tela nenhuma.
 *
 * A chave carrega versão (`central:favoritos:v1`) para que uma mudança de
 * formato no futuro não quebre o app de quem já tem dado salvo no aparelho.
 */
export interface Armazenamento<T> {
  ler(): T[];
  escrever(itens: T[]): void;
}

export function armazenamentoLocal<T>(chave: string): Armazenamento<T> {
  return {
    ler(): T[] {
      // Navegação privada e storage bloqueado lançam no acesso: o app segue
      // funcionando sem histórico em vez de quebrar na primeira tela.
      try {
        const bruto = window.localStorage.getItem(chave);
        if (!bruto) return [];
        const dados: unknown = JSON.parse(bruto);
        return Array.isArray(dados) ? (dados as T[]) : [];
      } catch {
        return [];
      }
    },
    escrever(itens: T[]): void {
      try {
        window.localStorage.setItem(chave, JSON.stringify(itens));
      } catch {
        /* cota cheia ou storage indisponível — o dado desta sessão se perde, o app não. */
      }
    },
  };
}
