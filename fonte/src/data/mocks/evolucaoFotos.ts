import type { SessaoFoto } from "@/types";
import { NUTRICIONISTA_ID, PACIENTE_MARINA_ID } from "./ids";
import { dataMenos, paraISODate } from "@/utils/datas";

/**
 * Portado do protótipo (constante `SESSOES_SEED`). `storagePathPorPose`
 * aponta para paths de um bucket privado fictício — a UI real resolveria
 * cada um para uma URL assinada de vida curta na hora de exibir (regra #11).
 */
export const SESSOES_FOTO_MARINA: SessaoFoto[] = [
  {
    id: "s1", nutricionistaId: NUTRICIONISTA_ID,
    criadoEm: `${paraISODate(dataMenos(56))}T09:00:00.000Z`,
    atualizadoEm: `${paraISODate(dataMenos(56))}T09:00:00.000Z`,
    pacienteId: PACIENTE_MARINA_ID,
    data: paraISODate(dataMenos(56)),
    storagePathPorPose: {
      frente: "fotos-evolucao/p1/s1/frente.jpg",
      lado: "fotos-evolucao/p1/s1/lado.jpg",
      costas: "fotos-evolucao/p1/s1/costas.jpg",
      abdomen: "fotos-evolucao/p1/s1/abdomen.jpg",
    },
  },
  {
    id: "s2", nutricionistaId: NUTRICIONISTA_ID,
    criadoEm: `${paraISODate(dataMenos(28))}T09:00:00.000Z`,
    atualizadoEm: `${paraISODate(dataMenos(28))}T09:00:00.000Z`,
    pacienteId: PACIENTE_MARINA_ID,
    data: paraISODate(dataMenos(28)),
    storagePathPorPose: {
      frente: "fotos-evolucao/p1/s2/frente.jpg",
      lado: "fotos-evolucao/p1/s2/lado.jpg",
      abdomen: "fotos-evolucao/p1/s2/abdomen.jpg",
    },
  },
];
