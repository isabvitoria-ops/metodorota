/** A lista dos utensílios das medidas caseiras (os desenhos estão em components/Utensilios.tsx). */
import type { Utensilio } from "@/central/types/protocolo";

export const UTENSILIOS: { chave: Utensilio; nome: string; descricao: string }[] = [
  { chave: "colher_cafe", nome: "Colher de café", descricao: "A menor, de mexer o cafezinho." },
  { chave: "colher_cha", nome: "Colher de chá", descricao: "A pequena, de mexer o chá." },
  { chave: "colher_sobremesa", nome: "Colher de sobremesa", descricao: "A média, entre a de chá e a de sopa." },
  { chave: "colher_sopa", nome: "Colher de sopa", descricao: "A grande do faqueiro, de tomar sopa. Não é a de servir arroz." },
  { chave: "colher_servir", nome: "Colher de servir", descricao: "A de arroz, de servir na travessa." },
  { chave: "escumadeira", nome: "Escumadeira", descricao: "A redonda e chata, cheia de furinhos." },
  { chave: "concha", nome: "Concha", descricao: "A funda, de servir feijão e caldo." },
  { chave: "pegador", nome: "Pegador", descricao: "O de pegar macarrão e salada." },
  { chave: "copo_americano", nome: "Copo americano", descricao: "O de vidro com gominhos, de lanchonete." },
  { chave: "xicara", nome: "Xícara de chá", descricao: "A xícara grande de chá, não a de cafezinho." },
  { chave: "fatia", nome: "Fatia", descricao: "Uma fatia, como a de pão de forma." },
  { chave: "unidade", nome: "Unidade", descricao: "Uma unidade inteira." },
  { chave: "file", nome: "Filé", descricao: "Um filé, do tamanho dito no plano." },
  { chave: "pedaco", nome: "Pedaço", descricao: "Um pedaço, do tamanho dito no plano." },
];

export const nomeDoUtensilio = (u: Utensilio) => UTENSILIOS.find((x) => x.chave === u)?.nome ?? "Medida";

/** As colheres em fila, da menor para a maior (para comparar). */
export const COLHERES: Utensilio[] = ["colher_cafe", "colher_cha", "colher_sobremesa", "colher_sopa", "colher_servir"];

