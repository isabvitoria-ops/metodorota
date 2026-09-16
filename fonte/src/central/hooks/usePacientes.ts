import { create } from "zustand";
import type { EventoHistorico, NovoPaciente, Paciente, Plano } from "@/central/types";
import { repositorio, type AlteracaoPaciente } from "@/central/dados/repositorio";

/**
 * A lista de pacientes da área administrativa.
 *
 * Toda alteração recarrega a lista do servidor em vez de remendar o objeto
 * em memória. É deliberado: `situacao` e `dias_restantes` são calculados
 * pelo banco a partir das datas, então adivinhar o novo valor aqui seria
 * repetir a regra num segundo lugar e arriscar mostrar "ativo" para quem o
 * banco já considera vencido.
 */
interface EstadoPacientes {
  pacientes: Paciente[];
  planos: Plano[];
  carregando: boolean;
  erro: string | null;
  carregar(): Promise<void>;
  criar(dados: NovoPaciente): Promise<Paciente | null>;
  alterar(id: string, alteracao: AlteracaoPaciente): Promise<void>;
  excluir(id: string): Promise<void>;
  convidar(id: string, email: string): Promise<void>;
  historico(id: string): Promise<EventoHistorico[]>;
}

export const usePacientes = create<EstadoPacientes>((set, get) => ({
  pacientes: [],
  planos: [],
  carregando: false,
  erro: null,

  async carregar() {
    set({ carregando: true, erro: null });
    try {
      const [pacientes, planos] = await Promise.all([
        repositorio.listarPacientes(),
        repositorio.listarPlanos(),
      ]);
      set({ pacientes, planos, carregando: false });
    } catch (e) {
      set({ carregando: false, erro: mensagem(e) });
    }
  },

  async criar(dados) {
    try {
      const paciente = await repositorio.criarPaciente(dados);
      await get().carregar();
      return paciente;
    } catch (e) {
      set({ erro: mensagem(e) });
      return null;
    }
  },

  async alterar(id, alteracao) {
    try {
      await repositorio.alterarPaciente(id, alteracao);
      await get().carregar();
    } catch (e) {
      set({ erro: mensagem(e) });
    }
  },

  async excluir(id) {
    try {
      await repositorio.excluirPaciente(id);
      await get().carregar();
    } catch (e) {
      set({ erro: mensagem(e) });
    }
  },

  async convidar(id, email) {
    try {
      await repositorio.registrarConvite(id, email);
      await get().carregar();
    } catch (e) {
      set({ erro: mensagem(e) });
    }
  },

  async historico(id) {
    try {
      return await repositorio.historicoDoPaciente(id);
    } catch {
      return [];
    }
  },
}));

function mensagem(e: unknown): string {
  if (e instanceof Error) {
    if (e.message.includes("duplicate key") || e.message.includes("pacientes_email_key")) {
      return "Já existe um paciente cadastrado com este e-mail.";
    }
    return e.message;
  }
  return "Algo deu errado. Tente de novo.";
}
