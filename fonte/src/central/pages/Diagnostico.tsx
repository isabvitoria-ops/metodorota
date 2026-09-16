import { useEffect, useState } from "react";
import { supabase, MODO_DEMONSTRACAO } from "@/central/supabase/cliente";
import { catalogo } from "@/central/dados/catalogo";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";
import { urlDaRota } from "@/central/utils/enderecos";

/**
 * Tela de diagnóstico.
 *
 * Existe porque quem publica o app não consegue ver o que o navegador dela
 * está vendo. Em vez de trocar mensagens de "não funciona", ela abre esta
 * tela e manda um print: aqui está se a conexão com o banco existe, o que o
 * banco respondeu, quem está autenticado e qual endereço o link do convite
 * vai usar.
 *
 * Não mostra segredo nenhum: a chave aparece só pelo começo, e ela é pública
 * por desenho — quem protege os dados são as políticas do banco.
 */
interface Linha {
  rotulo: string;
  valor: string;
  bom: boolean | null;
}

export function Diagnostico() {
  const { acesso, configuracoes, pronto } = useSessao();
  const [linhas, definirLinhas] = useState<Linha[]>([]);
  const [testando, definirTestando] = useState(true);

  useEffect(() => {
    if (!pronto) return;

    const url = import.meta.env.VITE_SUPABASE_URL ?? "";
    const chave = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

    // O que se sabe sem perguntar nada a ninguém aparece de imediato. Se a
    // rede estiver fora, esta tela ainda serve — e ela existe justamente
    // para o caso de a rede estar fora.
    definirLinhas([
      {
        rotulo: "Modo",
        valor: MODO_DEMONSTRACAO ? "Demonstração (sem banco)" : "Conectado ao Supabase",
        bom: !MODO_DEMONSTRACAO,
      },
      { rotulo: "Endereço do projeto", valor: url || "não configurado", bom: Boolean(url) },
      {
        rotulo: "Chave pública",
        valor: chave ? `${chave.slice(0, 22)}…` : "não configurada",
        bom: Boolean(chave),
      },
      { rotulo: "Endereço desta página", valor: window.location.href, bom: null },
      { rotulo: "Link que o convite vai usar", valor: urlDaRota("/definir-senha"), bom: null },
      { rotulo: "Papel", valor: acesso.papel, bom: null },
      { rotulo: "Situação", valor: String(acesso.situacao), bom: null },
      { rotulo: "Tem acesso", valor: acesso.temAcesso ? "sim" : "não", bom: null },
      {
        rotulo: "Catálogo carregado",
        valor: `${catalogo.alimentos().length} alimentos, ${catalogo.guias().length} guias, ${catalogo.categoriasComerFora().length} categorias`,
        bom: catalogo.alimentos().length > 0,
      },
      { rotulo: "Nome da Central", valor: configuracoes.nomeCentral, bom: null },
    ]);
    definirTestando(false);

    if (!supabase) return;
    let vivo = true;

    /** Uma leitura simples que qualquer conta pode fazer: se ela falhar, o
     *  problema é de conexão ou de chave, não de permissão. A corrida com o
     *  relógio existe porque uma rede bloqueada pode deixar a requisição
     *  pendurada, e uma tela de diagnóstico pendurada não diagnostica nada. */
    const espera = new Promise<string>((resolver) =>
      window.setTimeout(() => resolver("sem resposta em 10 segundos — verifique a conexão"), 10_000),
    );
    // `Promise.resolve` envolve o construtor de consulta do Supabase, que é
    // "thenable" mas não uma Promise completa — sem isso não há `.catch`.
    const consulta = Promise.resolve(
      supabase
        .from("planos")
        .select("id")
        .limit(5)
        .then(({ data, error }) =>
          error ? `erro: ${error.message}` : `${data?.length ?? 0} planos encontrados`,
        ),
    ).catch((e: unknown) => `erro: ${e instanceof Error ? e.message : "falha na requisição"}`);

    void Promise.race([consulta, espera]).then((resultado) => {
      if (!vivo) return;
      definirLinhas((atuais) => [
        ...atuais,
        {
          rotulo: "Leitura de teste (planos)",
          valor: resultado,
          bom: /planos encontrados/.test(resultado) && !resultado.startsWith("0 "),
        },
      ]);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      definirLinhas((atuais) => [
        ...atuais,
        {
          rotulo: "Sessão",
          valor: data.session ? `entrou como ${data.session.user.email}` : "ninguém autenticado",
          bom: null,
        },
      ]);
    });

    return () => {
      vivo = false;
    };
  }, [pronto, acesso, configuracoes]);

  return (
    // Esta tela vive fora do CentralApp (é aberta sem sessão), então precisa
    // trazer a casca de estilo consigo: todo o CSS da Central é escopado sob
    // `.central`, e sem esta div a página sairia sem formatação nenhuma.
    <div className="central">
      <div className="c-casca">
        <CabecalhoPagina
          titulo="Diagnóstico"
          descricao="O que este aparelho está vendo. Tire um print desta tela se algo não estiver funcionando."
          voltarPara={rotas.home}
        />
        <div className="c-conteudo">
          {testando && <p className="c-contagem">Conferindo…</p>}
          <div className="c-lista" style={{ marginTop: 16 }}>
            {linhas.map((linha) => (
              <div className="c-lista-item" key={linha.rotulo}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="c-lista-item-nome">{linha.rotulo}</span>
                  <span className="c-lista-item-apoio" style={{ wordBreak: "break-all" }}>
                    {linha.valor}
                  </span>
                </span>
                {linha.bom !== null && (
                  <span className="c-lista-item-direita">
                    <span className={`c-selo ${linha.bom ? "melhor" : "ocasional"}`}>
                      {linha.bom ? "ok" : "erro"}
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
