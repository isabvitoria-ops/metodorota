import type { CheckIn } from "@/types";
import { NUTRICIONISTA_ID, PACIENTE_MARINA_ID } from "./ids";
import { dataMenos, paraISODate } from "@/utils/datas";
import type { BristolTipo, Intensidade } from "@/types";

/**
 * Histórico dos últimos 14 dias de Marina, portado do protótipo
 * (constante `HISTORICO_SEED`). O check-in de hoje não está aqui —
 * o protótipo sempre inicia com `feitoHoje: null` (ninguém fez o
 * check-in de hoje ainda ao abrir o app).
 */
const BRISTOL_14_DIAS: BristolTipo[] = [4, 3, 4, 2, 1, 2, 3, 4, 4, 5, 3, 4, 6, 4];
const DOR_14_DIAS: Intensidade[] = [1, 1, 2, 3, 3, 3, 2, 1, 1, 2, 1, 1, 2, 1];

export const HISTORICO_CHECKINS_MARINA: CheckIn[] = BRISTOL_14_DIAS.map((bristol, i) => {
  const data = paraISODate(dataMenos(14 - i));
  return {
    id: `checkin-marina-${data}`,
    nutricionistaId: NUTRICIONISTA_ID,
    criadoEm: `${data}T08:00:00.000Z`,
    atualizadoEm: `${data}T08:00:00.000Z`,
    pacienteId: PACIENTE_MARINA_ID,
    data,
    evacuou: true,
    bristol,
    flags: [],
    sintomas: DOR_14_DIAS[i] ? { dor: DOR_14_DIAS[i] } : {},
    mapaDor: {},
    sono: null,
    movimento: null,
    humor: 3,
    gerouAlertaClinico: false,
  };
});
