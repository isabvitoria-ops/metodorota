import { exigirSupabase } from "@/central/supabase/cliente";
import { hojeSaoPaulo } from "@/central/utils/situacao";

export interface ChecklistDia {
  dia: string;
  intestino_regulou: boolean;
  sem_gases: boolean;
  dormiu_bem: boolean;
  barriga_desinchada: boolean;
  sem_compulsao: boolean;
  energia_boa: boolean;
  humor_estavel: boolean;
  notas: string | null;
}

export interface MetaSemanal {
  semana: number;
  agua_litros: number | null;
  sono_horas: number | null;
  musculacao_vezes: number | null;
  cardio_minutos: number | null;
  metas_extras: string[];
}

export const repositorioHotSlim = {
  async carregarChecklistHoje(): Promise<ChecklistDia | null> {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("hotslim_checklist")
      .select("*")
      .eq("dia", hojeSaoPaulo())
      .maybeSingle();
    if (error) throw error;
    return data as ChecklistDia | null;
  },

  async salvarChecklist(valores: Partial<ChecklistDia>): Promise<void> {
    const sb = exigirSupabase();
    const uid = (await sb.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { error } = await sb.from("hotslim_checklist").upsert(
      { participante_id: uid, dia: hojeSaoPaulo(), ...valores },
      { onConflict: "participante_id,dia" },
    );
    if (error) throw error;
  },

  async carregarHistoricoChecklist(): Promise<ChecklistDia[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("hotslim_checklist")
      .select("*")
      .order("dia", { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []) as ChecklistDia[];
  },

  async carregarMetas(semana: number): Promise<MetaSemanal | null> {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("hotslim_metas")
      .select("*")
      .eq("semana", semana)
      .maybeSingle();
    if (error) throw error;
    return data as MetaSemanal | null;
  },

  async salvarMetas(semana: number, valores: Partial<MetaSemanal>): Promise<void> {
    const sb = exigirSupabase();
    const uid = (await sb.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { error } = await sb.from("hotslim_metas").upsert(
      { participante_id: uid, semana, ...valores },
      { onConflict: "participante_id,semana" },
    );
    if (error) throw error;
  },
};
