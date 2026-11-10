import { useCallback, useEffect, useMemo, useState } from "react";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { Esqueleto } from "@/central/components/Esqueleto";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { GuiaDeViagemVisao } from "@/central/components/GuiaDeViagem";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { repositorio } from "@/central/dados/repositorio";
import { useDiarioDeViagem } from "@/central/hooks/useDiarioDeViagem";
import { rotas } from "@/central/rotas";
import { PedidoDeViagem } from "@/central/pages/ViagemPedido";
import type { MeuGuiaDeViagem } from "@/central/types/viagem";
import { diasDaViagem, normalizarFicha, normalizarGuia } from "@/central/utils/guiaViagem";

/**
 * Rota Viagem — a tela da paciente.
 *
 * O guia é escrito pela nutricionista, por paciente, e vem do banco. Esta tela
 * só busca e mostra; quem desenha é `GuiaDeViagemVisao`.
 *
 * O GUIA FICA GUARDADO NO APARELHO depois de aberto uma vez. Ele é usado no
 * exterior, em restaurante e aeroporto, onde a internet falha: sem a cópia, a
 * paciente abriria uma tela vazia justo na hora de mostrar o cartão ao garçom.
 * A cópia aparece na hora, e a versão nova entra por cima quando a rede responde.
 */
export function Viagem() {
  const { acesso } = useSessao();
  // Sem o guia liberado, a tela continua sendo o aviso de viagem para a nutricionista.
  if (!acesso.viagem) return <PedidoDeViagem />;
  return <MeuGuia />;
}

function chaveDoGuia(perfilId: string | null): string {
  return `central:viagem-guia:v1:${perfilId ?? "anonimo"}`;
}

function lerGuardado(chave: string): MeuGuiaDeViagem | null {
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as { guia?: unknown; ficha?: unknown };
    const guia = normalizarGuia(dados.guia);
    return guia ? { guia, ficha: normalizarFicha(dados.ficha) } : null;
  } catch {
    return null;
  }
}

function guardar(chave: string, meu: MeuGuiaDeViagem | null) {
  try {
    if (meu) window.localStorage.setItem(chave, JSON.stringify(meu));
    else window.localStorage.removeItem(chave);
  } catch {
    /* sem armazenamento, o guia só abre com internet */
  }
}

function MeuGuia() {
  const { acesso } = useSessao();
  const chave = chaveDoGuia(acesso.perfilId);
  const [meu, definirMeu] = useState<MeuGuiaDeViagem | null>(() => lerGuardado(chave));
  const [estado, definirEstado] = useState<"carregando" | "pronto" | "erro">("carregando");

  const carregar = useCallback(() => {
    definirEstado("carregando");
    return repositorio
      .meuGuiaDeViagem()
      .then((novo) => {
        definirMeu(novo);
        guardar(chave, novo);
        definirEstado("pronto");
      })
      .catch(() => definirEstado("erro"));
  }, [chave]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <>
      <CabecalhoPagina titulo="Rota Viagem" voltarPara={rotas.home} />
      <div className="c-conteudo c-viagem-guia">
        {meu ? (
          <GuiaComDiario meu={meu} />
        ) : estado === "carregando" ? (
          <Esqueleto />
        ) : estado === "erro" ? (
          <div className="c-aviso c-aviso-erro" role="alert" style={{ marginTop: 20 }}>
            <span>Não consegui abrir o seu guia agora. Confira a internet e tente de novo.</span>
            <button type="button" className="c-botao c-botao-pequeno" onClick={() => void carregar()}>
              Tentar de novo
            </button>
          </div>
        ) : acesso.papel === "admin" ? (
          <EstadoVazio
            icone="info"
            titulo="O guia de viagem é de cada paciente"
            descricao="Para montar, ler ou acompanhar o diário, abra a ficha da paciente e entre na aba Viagem."
          />
        ) : (
          <EstadoVazio
            icone="info"
            titulo="Seu guia de viagem ainda não está disponível"
            descricao="Assim que ele ficar pronto, aparece aqui."
          />
        )}
      </div>
    </>
  );
}

/** Só monta com o guia em mãos: o diário precisa das datas da viagem desde o primeiro instante. */
function GuiaComDiario({ meu }: { meu: MeuGuiaDeViagem }) {
  const { acesso, modoDemonstracao } = useSessao();
  // A nutricionista abre o guia para conferir, mas não é paciente: o diário
  // dela não tem para onde ir. (Na demonstração as duas são a mesma pessoa.)
  const envia = modoDemonstracao || acesso.papel !== "admin";
  const datas = useMemo(
    () => diasDaViagem(meu.guia.dataInicio, meu.guia.dataFim).map((d) => d.data),
    [meu.guia.dataInicio, meu.guia.dataFim],
  );
  const diario = useDiarioDeViagem(acesso.perfilId, envia, datas);
  // A nutricionista abre a tela para conferir: o nome dela não é o da paciente.
  const nome = meu.ficha?.nome ?? (acesso.papel === "admin" ? null : acesso.nome);

  return <GuiaDeViagemVisao guia={meu.guia} nome={nome} ficha={meu.ficha} diario={{ ...diario, envia }} />;
}
