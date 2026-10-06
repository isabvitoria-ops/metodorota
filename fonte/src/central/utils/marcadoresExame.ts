import type { MarcadorParaSalvar } from "@/central/types/exame";

export interface CatalogoMarcador {
  codigo: string;
  nome: string;
  unidade: string;
  refMin: number | null;
  refMax: number | null;
  grupo: string;
}

export const CATALOGO_MARCADORES: CatalogoMarcador[] = [
  // Hemograma
  { codigo: "HB", nome: "Hemoglobina", unidade: "g/dL", refMin: 12, refMax: 16, grupo: "Hemograma" },
  { codigo: "HT", nome: "Hematócrito", unidade: "%", refMin: 36, refMax: 46, grupo: "Hemograma" },
  { codigo: "VCM", nome: "VCM", unidade: "fL", refMin: 80, refMax: 100, grupo: "Hemograma" },
  { codigo: "LEUC", nome: "Leucócitos", unidade: "/mm³", refMin: 4000, refMax: 11000, grupo: "Hemograma" },
  { codigo: "PLAQ", nome: "Plaquetas", unidade: "mil/mm³", refMin: 150, refMax: 400, grupo: "Hemograma" },

  // Ferro e ferritina
  { codigo: "FE", nome: "Ferro sérico", unidade: "µg/dL", refMin: 50, refMax: 170, grupo: "Ferro" },
  { codigo: "FERR", nome: "Ferritina", unidade: "ng/mL", refMin: 20, refMax: 200, grupo: "Ferro" },
  { codigo: "TRANS", nome: "Transferrina", unidade: "mg/dL", refMin: 200, refMax: 360, grupo: "Ferro" },

  // Vitaminas
  { codigo: "B12", nome: "Vitamina B12", unidade: "pg/mL", refMin: 200, refMax: 900, grupo: "Vitaminas" },
  { codigo: "FOL", nome: "Ácido fólico", unidade: "ng/mL", refMin: 3, refMax: 17, grupo: "Vitaminas" },
  { codigo: "VITD", nome: "Vitamina D (25-OH)", unidade: "ng/mL", refMin: 30, refMax: 100, grupo: "Vitaminas" },

  // Tireoide
  { codigo: "TSH", nome: "TSH", unidade: "mUI/L", refMin: 0.4, refMax: 4, grupo: "Tireoide" },
  { codigo: "T4L", nome: "T4 livre", unidade: "ng/dL", refMin: 0.8, refMax: 1.8, grupo: "Tireoide" },

  // Glicemia e metabolismo
  { codigo: "GLIC", nome: "Glicemia de jejum", unidade: "mg/dL", refMin: 70, refMax: 99, grupo: "Metabolismo" },
  { codigo: "HBA1C", nome: "Hemoglobina glicada", unidade: "%", refMin: null, refMax: 5.7, grupo: "Metabolismo" },
  { codigo: "INS", nome: "Insulina basal", unidade: "µUI/mL", refMin: 2.6, refMax: 24.9, grupo: "Metabolismo" },
  { codigo: "HOMA", nome: "HOMA-IR", unidade: "", refMin: null, refMax: 2.71, grupo: "Metabolismo" },

  // Lipídios
  { codigo: "CT", nome: "Colesterol total", unidade: "mg/dL", refMin: null, refMax: 190, grupo: "Lipídios" },
  { codigo: "HDL", nome: "HDL", unidade: "mg/dL", refMin: 40, refMax: null, grupo: "Lipídios" },
  { codigo: "LDL", nome: "LDL", unidade: "mg/dL", refMin: null, refMax: 130, grupo: "Lipídios" },
  { codigo: "TG", nome: "Triglicerídeos", unidade: "mg/dL", refMin: null, refMax: 150, grupo: "Lipídios" },

  // Função hepática
  { codigo: "TGO", nome: "TGO (AST)", unidade: "U/L", refMin: null, refMax: 32, grupo: "Fígado" },
  { codigo: "TGP", nome: "TGP (ALT)", unidade: "U/L", refMin: null, refMax: 33, grupo: "Fígado" },
  { codigo: "GGT", nome: "GGT", unidade: "U/L", refMin: null, refMax: 38, grupo: "Fígado" },

  // Função renal
  { codigo: "CREAT", nome: "Creatinina", unidade: "mg/dL", refMin: 0.6, refMax: 1.1, grupo: "Renal" },
  { codigo: "UREIA", nome: "Ureia", unidade: "mg/dL", refMin: 15, refMax: 40, grupo: "Renal" },

  // Intestino / inflamação
  { codigo: "CALP", nome: "Calprotectina fecal", unidade: "µg/g", refMin: null, refMax: 50, grupo: "Intestino" },
  { codigo: "PCR", nome: "PCR (proteína C reativa)", unidade: "mg/L", refMin: null, refMax: 3, grupo: "Inflamação" },
  { codigo: "VHS", nome: "VHS", unidade: "mm/h", refMin: null, refMax: 20, grupo: "Inflamação" },

  // Minerais
  { codigo: "ZINC", nome: "Zinco", unidade: "µg/dL", refMin: 70, refMax: 120, grupo: "Minerais" },
  { codigo: "MG", nome: "Magnésio", unidade: "mg/dL", refMin: 1.7, refMax: 2.2, grupo: "Minerais" },
  { codigo: "CA", nome: "Cálcio total", unidade: "mg/dL", refMin: 8.6, refMax: 10.2, grupo: "Minerais" },
];

export function marcadorDoCatalogo(codigo: string): CatalogoMarcador | undefined {
  return CATALOGO_MARCADORES.find((m) => m.codigo === codigo);
}

export function gruposDoCatalogo(): { grupo: string; marcadores: CatalogoMarcador[] }[] {
  const mapa = new Map<string, CatalogoMarcador[]>();
  for (const m of CATALOGO_MARCADORES) {
    const lista = mapa.get(m.grupo);
    if (lista) lista.push(m);
    else mapa.set(m.grupo, [m]);
  }
  return Array.from(mapa.entries()).map(([grupo, marcadores]) => ({ grupo, marcadores }));
}

export function montarMarcadorParaSalvar(
  codigo: string,
  valor: number,
  nomePersonalizado?: string,
  unidadePersonalizada?: string,
  refMinPersonalizado?: number | null,
  refMaxPersonalizado?: number | null,
): MarcadorParaSalvar {
  const catalogo = marcadorDoCatalogo(codigo);
  return {
    codigo,
    nome: nomePersonalizado ?? catalogo?.nome ?? codigo,
    valor,
    unidade: unidadePersonalizada ?? catalogo?.unidade ?? "",
    refMin: refMinPersonalizado !== undefined ? refMinPersonalizado : (catalogo?.refMin ?? null),
    refMax: refMaxPersonalizado !== undefined ? refMaxPersonalizado : (catalogo?.refMax ?? null),
  };
}

export function classificarValor(
  valor: number,
  refMin: number | null,
  refMax: number | null,
): "baixo" | "normal" | "alto" | "desconhecido" {
  if (refMin == null && refMax == null) return "desconhecido";
  if (refMin != null && valor < refMin) return "baixo";
  if (refMax != null && valor > refMax) return "alto";
  return "normal";
}
