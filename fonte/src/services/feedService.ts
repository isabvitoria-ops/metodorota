import type { DestinoPost, PostFeed, TipoPost } from "@/types";
import { feedRepository } from "@/repositories";

export interface ItemFeed {
  post: PostFeed;
  curtidas: number;
  /** Verdade do servidor — a tela não guarda "eu curti" em estado local (some ao trocar de aba). */
  curtidoPorMim: boolean;
}

export async function listarFeed(pacienteId: string): Promise<ItemFeed[]> {
  const posts = await feedRepository.listarPosts();
  return Promise.all(
    posts.map(async (post) => ({
      post,
      curtidas: await feedRepository.contarCurtidas(post.id),
      curtidoPorMim: await feedRepository.curtidoPor(post.id, pacienteId),
    })),
  );
}

/** Lista para o painel da nutricionista — sem estado de curtida por paciente. */
export async function listarPostsPublicados(): Promise<{ post: PostFeed; curtidas: number }[]> {
  const posts = await feedRepository.listarPosts();
  return Promise.all(
    posts.map(async (post) => ({ post, curtidas: await feedRepository.contarCurtidas(post.id) })),
  );
}

export async function alternarCurtida(postId: string, pacienteId: string): Promise<number> {
  return feedRepository.alternarCurtida(postId, pacienteId);
}

/** Regra §13: só a nutricionista publica; garantido aqui pela assinatura (sem `pacienteId` autor). */
export async function publicarPost(
  nutricionistaId: string,
  tipo: TipoPost,
  titulo: string,
  texto: string,
  destino: DestinoPost,
  corId: string,
): Promise<PostFeed> {
  if (!titulo.trim()) throw new Error("Título é obrigatório.");
  return feedRepository.publicarPost(nutricionistaId, tipo, titulo, texto, destino, corId);
}
