import type { SintomaId, RegiaoAbdominal, FaixaSono, NivelMovimento } from "@/types";

export const SINTOMAS: { id: SintomaId; label: string }[] = [
  { id: "gases", label: "Gases" },
  { id: "distensao", label: "Distensão" },
  { id: "dor", label: "Dor abdominal" },
  { id: "azia", label: "Azia" },
  { id: "refluxo", label: "Refluxo" },
  { id: "nausea", label: "Náusea" },
  { id: "coceira", label: "Coceira" },
  { id: "urgencia", label: "Urgência" },
];

export const REGIOES_ABDOMINAIS: [RegiaoAbdominal, string][] = [
  ["hipocondrio_d", "Hipocôndrio direito"],
  ["epigastrio", "Epigástrio"],
  ["hipocondrio_e", "Hipocôndrio esquerdo"],
  ["flanco_d", "Flanco direito"],
  ["mesogastrio", "Umbigo"],
  ["flanco_e", "Flanco esquerdo"],
  ["fossa_d", "Fossa ilíaca direita"],
  ["hipogastrio", "Baixo ventre"],
  ["fossa_e", "Fossa ilíaca esquerda"],
];

export const FLAGS_EVACUACAO: { id: string; label: string; alerta?: boolean }[] = [
  { id: "muco", label: "Muco" },
  { id: "sangue", label: "Sangue", alerta: true },
  { id: "urgencia", label: "Urgência" },
  { id: "esforco", label: "Esforço para sair" },
  { id: "incompleto", label: "Sensação de não esvaziar" },
];

export const FAIXAS_SONO: FaixaSono[] = ["menos de 5 h", "5 a 6 h", "7 a 8 h", "mais de 8 h"];
export const NIVEIS_MOVIMENTO: NivelMovimento[] = ["Não", "Uma caminhada", "Treino"];
export const OPCOES_HUMOR: [string, number][] = [
  ["Difícil", 1],
  ["Pesado", 2],
  ["Normal", 3],
  ["Bom", 4],
  ["Ótimo", 5],
];

export const AVISO_SANGUE =
  "Sua nutricionista vai receber um aviso sobre isso hoje. Se o sangramento for intenso " +
  "ou vier com dor forte, procure atendimento médico — não espere a resposta aqui.";
