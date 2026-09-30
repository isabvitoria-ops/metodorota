import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { Icone, IconeCoracaoCheio } from "@/central/components/Icone";
import {
  REFEICOES_DO_DIARIO,
  type FotoDoDiario,
  type RefeicaoDoDiario,
} from "@/central/types/diarioDeFotos";
import {
  agruparPorDia,
  diasSeguidos,
  refeicaoPelaHora,
  rotuloDaRefeicao,
  rotuloDoDia,
} from "@/central/utils/diarioDeFotos";
import { reduzirFoto } from "@/central/utils/reduzirFoto";
import { hojeSaoPaulo, somarDias } from "@/central/utils/situacao";

/**
 * Diário de fotos — o mesmo componente dos dois lados (como os exames).
 *
 * `pacienteId` nulo: sou a paciente. Vejo o formulário para registrar e as
 * minhas fotos, e posso apagar as minhas. Preenchido: é a nutricionista
 * olhando a ficha de alguém, e o que ela faz aqui é ver e CURTIR — nada de
 * comentário, nada de comparar com o plano (decisão dela).
 */
export function DiarioDeFotos({ pacienteId }: { pacienteId: string | null }) {
  const souNutricionista = pacienteId !== null;
  const hoje = hojeSaoPaulo();
  const [fotos, definirFotos] = useState<FotoDoDiario[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      definirFotos(
        pacienteId === null
          ? await repositorio.meuDiario()
          : await repositorio.diarioDoPaciente(pacienteId),
      );
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar o diário.");
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const dias = useMemo(() => agruparPorDia(fotos), [fotos]);
  const sequencia = useMemo(() => diasSeguidos(fotos, hoje), [fotos, hoje]);

  async function curtir(foto: FotoDoDiario) {
    const antes = fotos;
    definirFotos((l) => l.map((f) => (f.id === foto.id ? { ...f, curtida: !f.curtida } : f)));
    try {
      await repositorio.curtirFoto(foto.id, !foto.curtida);
    } catch (e) {
      definirFotos(antes);
      definirErro(e instanceof Error ? e.message : "Não consegui curtir.");
    }
  }

  async function apagar(foto: FotoDoDiario) {
    if (!window.confirm("Apagar esta foto do seu diário?")) return;
    try {
      await repositorio.apagarFotoDoDiario(foto.id);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui apagar.");
    }
  }

  return (
    <section className="c-secao">
      {!souNutricionista && (
        <Registrar
          hoje={hoje}
          aoRegistrar={async () => {
            definirAviso("Foto registrada.");
            await carregar();
          }}
          aoFalhar={definirErro}
        />
      )}

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
      {aviso && !erro && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}

      {!souNutricionista && sequencia >= 2 && (
        <p className="c-dica">
          {sequencia} dias seguidos registrando. Continue assim!
        </p>
      )}

      {carregando && <p className="c-contagem">Carregando…</p>}

      {!carregando && fotos.length === 0 && (
        <p className="c-dica">
          {souNutricionista
            ? "Esta paciente ainda não registrou nenhuma refeição no diário."
            : "Você ainda não registrou nenhuma refeição. A primeira foto começa o seu diário."}
        </p>
      )}

      {dias.map((dia) => (
        <div key={dia.data} className="c-diario-dia">
          <h3 className="c-diario-dia-titulo">{rotuloDoDia(dia.data, hoje)}</h3>
          {dia.fotos.map((foto) => (
            <CartaoDaFoto
              key={foto.id}
              foto={foto}
              souNutricionista={souNutricionista}
              aoCurtir={() => void curtir(foto)}
              aoApagar={() => void apagar(foto)}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function Registrar({
  hoje,
  aoRegistrar,
  aoFalhar,
}: {
  hoje: string;
  aoRegistrar: () => Promise<void>;
  aoFalhar: (mensagem: string | null) => void;
}) {
  const [foto, definirFoto] = useState<Blob | null>(null);
  const [previa, definirPrevia] = useState<string | null>(null);
  const [preparando, definirPreparando] = useState(false);
  const [enviando, definirEnviando] = useState(false);
  const [refeicao, definirRefeicao] = useState<RefeicaoDoDiario>(() =>
    refeicaoPelaHora(new Date().getHours()),
  );
  const [legenda, definirLegenda] = useState("");
  const [data, definirData] = useState(hoje);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  // A prévia é um endereço na memória do navegador; solta ao trocar/sair.
  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa);
  }, [previa]);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    aoFalhar(null);
    definirPreparando(true);
    try {
      const reduzida = await reduzirFoto(arquivo);
      definirFoto(reduzida);
      definirPrevia(URL.createObjectURL(reduzida));
    } catch (e) {
      aoFalhar(e instanceof Error ? e.message : "Não consegui preparar a foto.");
    } finally {
      definirPreparando(false);
      if (camera.current) camera.current.value = "";
      if (galeria.current) galeria.current.value = "";
    }
  }

  async function registrar() {
    if (!foto) return;
    definirEnviando(true);
    aoFalhar(null);
    try {
      await repositorio.enviarFotoDoDiario(foto, refeicao, legenda.trim() || null, data || null);
      definirFoto(null);
      definirPrevia(null);
      definirLegenda("");
      definirData(hoje);
      definirRefeicao(refeicaoPelaHora(new Date().getHours()));
      await aoRegistrar();
    } catch (e) {
      aoFalhar(e instanceof Error ? e.message : "Não consegui registrar a foto.");
    } finally {
      definirEnviando(false);
    }
  }

  return (
    <div className="c-bloco">
      <h2 className="c-secao-titulo" style={{ marginTop: 0 }}>
        Registrar uma refeição
      </h2>

      {previa ? (
        <img className="c-diario-previa" src={previa} alt="Prévia da foto da refeição" />
      ) : (
        <div className="c-diario-escolha">
          <button
            type="button"
            className="c-botao"
            disabled={preparando || enviando}
            onClick={() => camera.current?.click()}
          >
            <Icone nome="camera" tamanho={18} style={{ verticalAlign: "-3px", marginRight: 8 }} />
            {preparando ? "Preparando a foto…" : "Tirar foto"}
          </button>
          <button
            type="button"
            className="c-botao c-botao-secundario"
            disabled={preparando || enviando}
            onClick={() => galeria.current?.click()}
          >
            Escolher da galeria
          </button>
        </div>
      )}
      {/* Dois campos escondidos: o da câmera pede direto a câmera traseira no
          celular; no computador os dois abrem o seletor de arquivos. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void escolher(e.target.files?.[0])}
      />
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void escolher(e.target.files?.[0])}
      />

      {previa && (
        <>
          <p className="c-dica" style={{ marginBottom: 6 }}>Qual refeição foi?</p>
          <div className="c-chips">
            {REFEICOES_DO_DIARIO.map((r) => (
              <button
                key={r.valor}
                type="button"
                className="c-chip"
                aria-pressed={refeicao === r.valor}
                onClick={() => definirRefeicao(r.valor)}
              >
                {r.rotulo}
              </button>
            ))}
          </div>

          <label className="c-campo-rotulo">
            Legenda (opcional)
            <input
              className="c-campo"
              type="text"
              maxLength={300}
              value={legenda}
              onChange={(e) => definirLegenda(e.target.value)}
              placeholder="O que tinha no prato, como você se sentiu…"
            />
          </label>

          <label className="c-campo-rotulo">
            Dia da refeição
            <input
              className="c-campo"
              type="date"
              value={data}
              min={somarDias(hoje, -7)}
              max={hoje}
              onChange={(e) => definirData(e.target.value || hoje)}
            />
            <span className="c-dica">Esqueceu de registrar? Dá para voltar até 7 dias.</span>
          </label>

          <div className="c-diario-acoes">
            <button type="button" className="c-botao" disabled={enviando} onClick={() => void registrar()}>
              {enviando ? "Enviando…" : "Registrar"}
            </button>
            <button
              type="button"
              className="c-botao c-botao-secundario"
              disabled={enviando}
              onClick={() => {
                definirFoto(null);
                definirPrevia(null);
              }}
            >
              Trocar a foto
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CartaoDaFoto({
  foto,
  souNutricionista,
  aoCurtir,
  aoApagar,
}: {
  foto: FotoDoDiario;
  souNutricionista: boolean;
  aoCurtir: () => void;
  aoApagar: () => void;
}) {
  const [endereco, definirEndereco] = useState<string | null>(null);
  const [falhou, definirFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    repositorio
      .enderecoDaFoto(foto.caminho)
      .then((e) => ativo && definirEndereco(e))
      .catch(() => ativo && definirFalhou(true));
    return () => {
      ativo = false;
    };
  }, [foto.caminho]);

  return (
    <article className="c-diario-cartao">
      {endereco ? (
        <img className="c-diario-foto" src={endereco} alt={`Foto: ${rotuloDaRefeicao(foto.refeicao)}`} loading="lazy" />
      ) : (
        <div className="c-diario-foto c-diario-foto-vazia">
          {falhou ? "Não consegui abrir esta foto." : "Carregando a foto…"}
        </div>
      )}
      <div className="c-diario-corpo">
        <strong>{rotuloDaRefeicao(foto.refeicao)}</strong>
        {foto.legenda && <p className="c-diario-legenda">{foto.legenda}</p>}
        <div className="c-diario-rodape">
          {souNutricionista ? (
            <button
              type="button"
              className="c-chip c-diario-curtir"
              aria-pressed={foto.curtida}
              onClick={aoCurtir}
            >
              {foto.curtida ? <IconeCoracaoCheio tamanho={16} /> : <Icone nome="coracao" tamanho={16} />}
              {foto.curtida ? "Curtida" : "Curtir"}
            </button>
          ) : (
            <>
              {foto.curtida ? (
                <span className="c-diario-curtida">
                  <IconeCoracaoCheio tamanho={16} /> Sua nutricionista curtiu
                </span>
              ) : (
                <span />
              )}
              <button type="button" className="c-chip" onClick={aoApagar}>
                Apagar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
