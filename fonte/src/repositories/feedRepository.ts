import type { DestinoPost, PostFeed, TipoPost } from "@/types";
import { agoraISO, atraso, db, gerarId } from "./mockDb";

export async function listarPosts(): Promise<PostFeed[]> {
  await atraso();
  return [...db.posts].sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
}

export async function contarCurtidas(postId: string): Promise<number> {
  return db.curtidas[postId] ?? 0;
}

/** Se este paciente já curtiu o post — a verdade mora no banco, não no estado local da tela. */
export async function curtidoPor(postId: string, pacienteId: string): Promise<boolean> {
  return db.curtidasPorPaciente[pacienteId]?.has(postId) ?? false;
}

export async function alternarCurtida(postId: string, pacienteId: string): Promise<number> {
  await atraso(120);
  const curtidos = db.curtidasPorPaciente[pacienteId] ?? new Set<string>();
  db.curtidasPorPaciente[pacienteId] = curtidos;
  const atual = db.curtidas[postId] ?? 0;
  if (curtidos.has(postId)) {
    curtidos.delete(postId);
    db.curtidas[postId] = atual - 1;
  } else {
    curtidos.add(postId);
    db.curtidas[postId] = atual + 1;
  }
  return db.curtidas[postId]!;
}

/** Regra §13: só a nutricionista publica. */
export async function publicarPost(
  nutricionistaId: string,
  tipo: TipoPost,
  titulo: string,
  texto: string,
  destino: DestinoPost,
  corId: string,
): Promise<PostFeed> {
  await atraso(300);
  const post: PostFeed = {
    id: gerarId("post"),
    nutricionistaId,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    autorTipo: "nutricionista",
    tipo,
    titulo,
    texto,
    destino,
    corId,
    publicadoEm: agoraISO(),
  };
  db.posts.unshift(post);
  db.curtidas[post.id] = 0;
  return post;
}
