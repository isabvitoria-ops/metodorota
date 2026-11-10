import { useCallback, useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { GuiaDeViagemVisao } from "@/central/components/GuiaDeViagem";
import type { DiaDoDiarioDeViagem, ViagemDoPaciente } from "@/central/types/viagem";
import { camposDoServidor, type DiarioLocal } from "@/central/utils/diarioDeViagem";

/**
 * O Rota Viagem de uma paciente, visto pela nutricionista.
 *
 * Duas coisas, nesta ordem: o DIÁRIO (o que muda todo dia, e é por ele que
 * ela abre a aba durante a viagem) e o GUIA exatamente como a paciente vê,
 * com a ficha de saúde preenchida. Nada aqui é editável: o diário é da
 * paciente, e o texto do guia ainda mora no código.
 */

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function rotuloDoDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} (${SEMANA[d.getUTCDay()]})`;
}

function quando(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ViagemDoProntuario({
  pacienteId,
  nome,
  inicial,
}: {
  pacienteId: string;
  nome: string;
  inicial: ViagemDoPaciente;
}) {
  const [dados, definirDados] = useState<ViagemDoPaciente>(inicial);
  const [atualizando, definirAtualizando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => definirDados(inicial), [inicial]);

  const atualizar = useCallback(async () => {
    definirAtualizando(true);
    try {
      definirDados(await repositorio.viagemDoPaciente(pacienteId));
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui atualizar o diário.");
    } finally {
      definirAtualizando(false);
    }
  }, [pacienteId]);

  // O mais recente primeiro: é o dia que ela quer ler ao abrir a aba.
  const dias = useMemo(() => [...dados.diario].sort((a, b) => b.dia.localeCompare(a.dia)), [dados.diario]);

  const diarioDaTela = useMemo(() => {
    const valores: DiarioLocal = {};
    for (const dia of dados.diario) valores[dia.dia] = camposDoServidor(dia);
    return { valores, estados: {}, envia: false };
  }, [dados.diario]);

  return (
    <>
      <section className="c-secao">
        <div className="c-vg-nutri-topo">
          <h2 className="c-secao-titulo">Diário da viagem</h2>
          <button type="button" className="c-botao c-botao-pequeno c-botao-secundario" disabled={atualizando} onClick={() => void atualizar()}>
            {atualizando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
        <p className="c-subtitulo">O que ela preenche no guia aparece aqui, do dia mais recente para o mais antigo.</p>

        {erro && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>{erro}</span>
          </div>
        )}

        {dias.length === 0 ? (
          <EstadoVazio
            icone="info"
            titulo="Ela ainda não preencheu nenhum dia"
            descricao="Assim que ela anotar um dia no diário do guia, ele aparece aqui."
          />
        ) : (
          <div className="c-vg-nutri-dias">
            {dias.map((dia) => (
              <DiaDoDiario key={dia.dia} dia={dia} />
            ))}
          </div>
        )}
      </section>

      <section className="c-secao">
        <h2 className="c-secao-titulo">O guia como ela vê</h2>
        <p className="c-subtitulo">
          É a mesma tela do aplicativo dela, com a ficha de saúde preenchida. O diário aparece com o que ela já anotou.
        </p>
        {dados.guia ? (
          <div className="c-vg-previa">
            <GuiaDeViagemVisao
              guia={dados.guia}
              nome={dados.ficha?.nome ?? nome}
              ficha={dados.ficha}
              diario={diarioDaTela}
              comNavegacao={false}
            />
          </div>
        ) : (
          <EstadoVazio icone="info" titulo="Esta paciente ainda não tem guia" descricao="Monte o guia para ele aparecer aqui." />
        )}
      </section>
    </>
  );
}

function DiaDoDiario({ dia }: { dia: DiaDoDiarioDeViagem }) {
  const medida = (rotulo: string, valor: number | null, sufixo = "") => (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor === null ? "—" : `${valor}${sufixo}`}</dd>
    </div>
  );
  return (
    <article className="c-vg-nutri-dia">
      <header>
        <strong>
          {rotuloDoDia(dia.dia)}
          {dia.onde ? ` · ${dia.onde}` : ""}
        </strong>
        {dia.atualizadoEm && <span>preenchido em {quando(dia.atualizadoEm)}</span>}
      </header>
      <dl>
        {medida("Inchaço", dia.inchaco, "/10")}
        {medida("Dor", dia.dor, "/10")}
        {medida("Azia/amargo", dia.azia, "/10")}
        {medida("Evacuações", dia.evacuacoes)}
        {medida("Bristol", dia.bristol)}
      </dl>
      {dia.observacoes && <p>{dia.observacoes}</p>}
    </article>
  );
}
