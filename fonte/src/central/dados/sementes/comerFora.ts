import type {
  CategoriaComerFora,
  EstabelecimentoComerFora,
  NivelEscolha,
  OpcaoComerFora,
  ValorEnergetico,
} from "@/central/types";

/**
 * Conteúdo de "Comer fora".
 *
 * Tudo aqui veio dos materiais da nutricionista — "Melhores escolhas para sua
 * refeição livre" — e nada foi completado por fora deles. Onde o material não
 * diz, o campo fica nulo e a tela mostra o estado de preparo, em vez de
 * inventar um número ou uma recomendação.
 *
 * A classificação em melhor escolha / boa opção / mais ocasional só aparece
 * onde o próprio material compara as opções. Nas listas em que ela apenas
 * apresenta alternativas equivalentes, `nivel` fica nulo: marcar uma cor ali
 * seria criar um julgamento que ela não fez.
 *
 * COMO ACRESCENTAR UM RESTAURANTE / CATEGORIA
 * -------------------------------------------
 * Pela tela: área da nutricionista → Conteúdos → Comer fora → Nova categoria.
 * Por aqui: some um objeto na lista e rode `npm run seed && npm run instalador`.
 */

interface EntradaOpcao {
  id: string;
  titulo: string;
  descricao?: string | null;
  nivel?: NivelEscolha | null;
  kcal?: number | null;
  mostrarKcal?: boolean;
  observacaoEnergia?: string | null;
  detalhes?: string[];
  tags?: string[];
}

function opcao(e: EntradaOpcao): OpcaoComerFora {
  const energia: ValorEnergetico | null =
    e.kcal === undefined && e.mostrarKcal === undefined
      ? null
      : {
          kcal: e.kcal ?? null,
          mostrarKcal: e.mostrarKcal ?? false,
          observacao: e.observacaoEnergia ?? null,
        };
  return {
    id: e.id,
    titulo: e.titulo,
    descricao: e.descricao ?? null,
    nivel: e.nivel ?? null,
    energia,
    detalhes: e.detalhes ?? [],
    tags: e.tags ?? [],
  };
}


interface EntradaEstabelecimento {
  id: string;
  nome: string;
  grupo?: string | null;
  logo?: string | null;
  resumo?: string | null;
  ordem?: number;
  opcoes?: OpcaoComerFora[];
  observacoes?: string[];
}

/**
 * Uma casa dentro da categoria. Nasce sem opções de propósito: quem decide o
 * que é melhor escolha no cardápio de cada lugar é a nutricionista, no painel
 * — aqui só entra a identificação.
 */
function casa(e: EntradaEstabelecimento): EstabelecimentoComerFora {
  return {
    id: e.id,
    nome: e.nome,
    grupo: e.grupo ?? null,
    logo: e.logo ?? null,
    resumo: e.resumo ?? null,
    ordem: e.ordem ?? 0,
    opcoes: e.opcoes ?? [],
    observacoes: e.observacoes ?? [],
  };
}

/**
 * Logos vindas do simple-icons (CC0). Cada marca continua sendo de quem é: o
 * uso aqui é só para identificar a casa na lista, que é o que a paciente
 * procura. As demais a nutricionista envia pelo painel.
 */
/**
 * Hamburgueria artesanal não é uma marca: é uma categoria de lugar. Como não
 * há logo para pôr, entra uma ilustração — desenhada aqui, não uma foto de
 * banco de imagem —, e a nutricionista troca por uma foto real pelo painel
 * quando quiser.
 */
const ILUSTRACAO_ARTESANAL =
  "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><path d='M6 30c0-13 11.6-21 26-21s26 8 26 21z' fill='%23D9A05B'/><ellipse cx='22' cy='18' rx='3' ry='1.7' fill='%23F0D6A8'/><ellipse cx='34' cy='14' rx='3' ry='1.7' fill='%23F0D6A8'/><ellipse cx='45' cy='19' rx='3' ry='1.7' fill='%23F0D6A8'/><ellipse cx='28' cy='24' rx='3' ry='1.7' fill='%23F0D6A8'/><ellipse cx='40' cy='25' rx='3' ry='1.7' fill='%23F0D6A8'/><path d='M5 30h54c1.7 0 3 1.3 3 3s-1.3 3-3 3c-3.4 0-3.4 3-6.8 3s-3.4-3-6.8-3-3.4 3-6.8 3-3.4-3-6.8-3-3.4 3-6.8 3-3.4-3-6.8-3-3.4 3-6.2 3c-1.7 0-3-1.3-3-3s1.3-3 3-3z' fill='%237FA35A'/><path d='M12 37h40c1.2 0 2.2 1 2.2 2.2 0 3.4-3.6 2.4-3.6 5.8h-4.4c0-3-3.6-2.4-3.6-5.8H12z' fill='%23E8B33A'/><rect x='8' y='41' width='48' height='10' rx='5' fill='%237A4A2B'/><path d='M9 50h46c0 5.5-4.5 8-23 8S9 55.5 9 50z' fill='%23C98F4E'/></svg>";

/** Restaurante italiano também não é marca — mesma solução do artesanal. */
const ILUSTRACAO_ITALIANO =
  "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><ellipse cx='32' cy='38' rx='29' ry='17' fill='%23EFEAE1'/><ellipse cx='32' cy='36' rx='23' ry='13' fill='%23FBF8F3'/><path d='M12 36c4-5 10-7 20-7s16 2 20 7c-3 6-11 9-20 9s-17-3-20-9z' fill='%23E8C978'/><path d='M13 35c5 1 9-2 14-1M15 39c6 1 10-3 16-2M20 43c6 0 9-3 15-3M34 34c5-1 9 1 14 3M36 39c5-1 8 0 13 2' stroke='%23D4AE55' stroke-width='1.6' stroke-linecap='round' fill='none'/><circle cx='26' cy='35' r='4.2' fill='%23C0453A'/><circle cx='38' cy='39' r='3.6' fill='%23C0453A'/><circle cx='33' cy='31' r='2.8' fill='%23D4574B'/><path d='M44 30c2-1 3-3 2-4' stroke='%237FA35A' stroke-width='2' stroke-linecap='round' fill='none'/><ellipse cx='45' cy='28' rx='2.6' ry='1.6' transform='rotate(-25 45 28)' fill='%237FA35A'/></svg>";

const ILUSTRACAO_SUB =
  "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><g transform='rotate(-12 32 32)'><path d='M6 26h52c3.3 0 6 2.7 6 6s-2.7 6-6 6H6c-3.3 0-6-2.7-6-6s2.7-6 6-6z' fill='%23D9A05B'/><path d='M4 32h56c2.2 0 3.6 2 3 4-.8 2.6-3.2 4.4-6 4.4H7c-2.8 0-5.2-1.8-6-4.4-.6-2 .8-4 3-4z' fill='%237FA35A'/><path d='M8 36h48c1.9 0 3.2 1.7 2.7 3.5-.6 2.2-2.6 3.7-4.9 3.7H10.2c-2.3 0-4.3-1.5-4.9-3.7C4.8 37.7 6.1 36 8 36z' fill='%23C0453A'/><path d='M10 41h44c2 0 3.4 1.8 2.8 3.7-.7 2.2-2.8 3.7-5.1 3.7H12.3c-2.3 0-4.4-1.5-5.1-3.7C6.6 42.8 8 41 10 41z' fill='%23F0D9A6'/><path d='M11 47h42c-1.4 4.4-7.6 6.6-21 6.6S12.4 51.4 11 47z' fill='%23C98F4E'/><ellipse cx='18' cy='29' rx='2.8' ry='1.5' fill='%23F0D6A8'/><ellipse cx='32' cy='28' rx='2.8' ry='1.5' fill='%23F0D6A8'/><ellipse cx='46' cy='29' rx='2.8' ry='1.5' fill='%23F0D6A8'/></g></svg>";

const ILUSTRACAO_BALCAO =
  "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><path d='M10 26h44l-4 26a6 6 0 0 1-6 5H20a6 6 0 0 1-6-5z' fill='%23FBF8F3' stroke='%23E6E1D9' stroke-width='1.5'/><path d='M12 33h40l-1.4 9c-6 3-12 1-18.6 1s-12 2-18.6-1z' fill='%23E8C978'/><path d='M13 42c6-2 12 0 19 0s13-2 19 0l-1.3 8.6a4 4 0 0 1-4 3.4H18.3a4 4 0 0 1-4-3.4z' fill='%23F0D9A6'/><circle cx='24' cy='38' r='3.4' fill='%23C0453A'/><circle cx='38' cy='40' r='3' fill='%23C0453A'/><ellipse cx='32' cy='35' rx='3' ry='1.8' fill='%237FA35A'/><path d='M44 19c0 3-2 5-2 7M50 17c0 3-2 5-2 7M38 18c0 3-2 5-2 7' stroke='%23D4CDC3' stroke-width='2' stroke-linecap='round' fill='none'/></svg>";

const LOGO_BURGER_KING =
  "data:image/svg+xml,<svg fill='%23D62300' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path d='M15.39 12.614c-.72 0-1.11.538-1.11 1.215v1.508c0 .125-.043.182-.12.182-.056 0-.098-.035-.147-.133l-.971-1.885c-.37-.72-.755-.887-1.196-.887-.734 0-1.14.552-1.14 1.243v4.314c0 .678.392 1.215 1.112 1.215.72 0 1.112-.537 1.112-1.215v-1.507c0-.126.042-.182.119-.182.055 0 .097.035.146.133l.972 1.885c.37.719.769.886 1.195.886.735 0 1.14-.551 1.14-1.242v-4.315c0-.677-.391-1.215-1.111-1.215zm-4.02-.405c.364 0 .68-.286.68-.642 0-.238-.099-.412-.224-.572-.203-.266-.385-.496-.476-.74-.02-.056-.007-.105.056-.154.217-.167.469-.537.469-1.124 0-.886-.734-1.389-1.622-1.389h-.79c-.553 0-.819.321-.819.754v3.114c0 .419.245.754.692.754.448 0 .693-.335.693-.754v-.74c0-.09.042-.133.111-.133.084 0 .112.049.126.133.063.356.23.837.42 1.082.237.314.46.411.685.411zm-1.146-2.666h-.098c-.119 0-.175-.07-.175-.161v-.474c0-.09.056-.16.175-.16h.098c.294 0 .385.208.385.39 0 .174-.091.405-.385.405zm-3.761 2.666c1.132 0 1.734-.677 1.734-1.528V8.328c0-.419-.245-.754-.692-.754-.448 0-.693.335-.693.754v2.276c0 .167-.097.363-.35.363-.251 0-.335-.196-.335-.363V8.328c0-.419-.252-.754-.7-.754-.447 0-.691.335-.691.754v2.353c0 .852.594 1.528 1.727 1.528zm12.011-.034c.392 0 .7-.23.7-.65 0-.412-.308-.642-.7-.642h-.63c-.118 0-.174-.07-.174-.16v-.133c0-.091.056-.161.175-.161h.482c.336 0 .602-.202.602-.559 0-.355-.266-.558-.602-.558h-.482c-.12 0-.175-.07-.175-.16V9.04c0-.091.056-.161.175-.161h.629c.392 0 .7-.23.7-.65 0-.411-.308-.642-.7-.642h-1.321c-.553 0-.818.321-.818.754v3.079c0 .432.265.754.818.754h1.321zm2.642 3.127h-.342c-.615 0-1.09.286-1.09.914 0 .573.517.845.901.845.189 0 .322.056.322.202 0 .182-.224.3-.462.3-.79 0-1.328-.537-1.328-1.535 0-1.11.734-1.515 1.3-1.515.692 0 .804.349 1.287.349a.927.927 0 0 0 .936-.915.95.95 0 0 0-.398-.788c-.427-.315-1.07-.545-1.979-.545-1.629 0-3.216 1.026-3.216 3.414 0 2.282 1.587 3.35 3.153 3.35 1.643 0 2.685-1.012 2.685-2.492 0-.935-.587-1.584-1.769-1.584zm-12.43-2.688c-.783 0-1.21.587-1.21 1.32v4.132c0 .734.427 1.32 1.21 1.32.783 0 1.21-.586 1.21-1.32v-4.132c0-.733-.427-1.32-1.21-1.32zm11.494-.405c.447 0 .692-.335.692-.754v-.74c0-.09.042-.132.112-.132.084 0 .111.049.125.133.063.355.231.837.42 1.082.238.314.461.412.685.412.363 0 .678-.286.678-.643 0-.237-.098-.412-.224-.572-.237-.3-.384-.496-.475-.74-.02-.056-.007-.105.056-.153.217-.168.469-.538.469-1.124 0-.887-.735-1.39-1.623-1.39h-.79c-.552 0-.817.321-.817.754v3.114c0 .419.244.753.692.753zm.615-3.301c0-.09.056-.161.175-.161h.098c.293 0 .384.21.384.391 0 .175-.09.405-.384.405h-.098c-.12 0-.175-.07-.175-.16zm-18.87 3.267h.986c.93 0 1.496-.622 1.496-1.397 0-.621-.37-.907-.454-.977-.035-.028-.07-.056-.07-.084 0-.035.021-.048.056-.09.133-.154.266-.398.266-.754 0-.838-.567-1.285-1.448-1.285h-.832c-.552 0-.817.321-.817.754v3.079c0 .433.265.754.817.754zm.413-3.386c0-.09.056-.16.175-.16h.09c.301 0 .392.209.392.39 0 .168-.09.405-.391.405h-.091c-.12 0-.175-.07-.175-.16zm0 1.634c0-.091.056-.161.175-.161h.126c.335 0 .433.223.433.426 0 .181-.098.44-.433.44h-.126c-.12 0-.175-.07-.175-.161zm11.878 1.794c1.098 0 1.79-.699 1.79-1.718 0-.649-.391-1.096-1.174-1.096h-.224c-.413 0-.734.196-.734.636 0 .39.342.58.601.58.133 0 .217.041.217.139 0 .125-.147.21-.315.21-.524 0-.88-.37-.88-1.062 0-.768.489-1.047.866-1.047.462 0 .539.238.86.238.37 0 .623-.308.623-.629a.669.669 0 0 0-.266-.544c-.294-.217-.706-.377-1.321-.377-1.084 0-2.14.712-2.14 2.36 0 1.576 1.056 2.31 2.097 2.31zm-8.718 3.762a.354.354 0 0 1-.07-.188c0-.077.042-.133.126-.21.196-.181.678-.635.944-1.047.202-.314.286-.6.286-.837 0-.607-.552-1.082-1.153-1.082-.385 0-.748.216-.993.614-.329.53-.72 1.145-.972 1.39-.063.062-.098.076-.146.076-.084 0-.12-.056-.12-.146v-.699c0-.684-.405-1.235-1.139-1.235-.74 0-1.14.551-1.14 1.235v4.3c0 .685.399 1.237 1.14 1.237.734 0 1.14-.552 1.14-1.236v-.991c0-.084.035-.147.119-.147.111 0 .14.112.167.168.161.384.63 1.2 1.063 1.682.294.32.657.524 1.042.524.65 0 1.196-.566 1.196-1.173 0-.377-.161-.657-.469-.991-.392-.427-.853-.986-1.021-1.244zm15.751 6.702C19.432 23.707 16.313 24 12 24c-4.313 0-7.432-.293-9.25-1.32-1.09-.614-1.642-1.451-1.642-2.052 0-.342.181-.537.587-.537h20.61c.406 0 .587.195.587.537 0 .6-.552 1.438-1.643 2.053zm1.056-15.917H1.695c-.406 0-.587-.209-.587-.586C1.108 3.944 4.47 0 12 0c7.46 0 10.892 3.944 10.892 6.178 0 .377-.181.586-.587.586Z'/></svg>";

const LOGO_MCDONALDS =
  "data:image/svg+xml,<svg fill='%23FBC817' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path d='M17.243 3.006c2.066 0 3.742 8.714 3.742 19.478H24c0-11.588-3.042-20.968-6.766-20.968-2.127 0-4.007 2.81-5.248 7.227-1.241-4.416-3.121-7.227-5.231-7.227C3.031 1.516 0 10.888 0 22.476h3.014c0-10.763 1.658-19.47 3.724-19.47 2.066 0 3.741 8.05 3.741 17.98h2.997c0-9.93 1.684-17.98 3.75-17.98Z'/></svg>";

export const CATEGORIAS_COMER_FORA: CategoriaComerFora[] = [
  // ---------------------------------------------------------------- refeição livre
  {
    id: "hamburguer",
    nome: "Hambúrguer",
    resumo: "Como montar o lanche do jeito que cabe no seu dia.",
    icone: "hamburguer",
    logo: null,
    ordem: 1,
    status: "publicado",
    introducao:
      "Escolha o lugar e veja o que pedir. A diferença entre uma opção e outra costuma estar nos acompanhamentos, não no lanche em si.",
    estabelecimentos: [
      casa({
        id: "mcdonalds",
        nome: "McDonald's",
        grupo: "Lanchonetes",
        logo: LOGO_MCDONALDS,
        ordem: 1,
        opcoes: [
          opcao({
            id: "mcdonalds-melhor",
            titulo: "Cheeseburger",
            descricao: "Com batata pequena e Coca-Cola Zero.",
            nivel: "melhor",
            detalhes: ["Cheeseburger — 291 kcal", "Batata pequena — 171 kcal", "Coca-Cola Zero — 0 kcal"],
            kcal: 462,
            mostrarKcal: true,
            tags: ["combo"],
          }),
          opcao({
            id: "mcdonalds-boa",
            titulo: "McChicken",
            descricao: "Com batata pequena e Coca-Cola Zero.",
            nivel: "boa",
            detalhes: ["McChicken — 403 kcal", "Batata pequena — 171 kcal", "Coca-Cola Zero — 0 kcal"],
            kcal: 574,
            mostrarKcal: true,
            tags: ["combo"],
          }),
          opcao({
            id: "mcdonalds-ocasional",
            titulo: "Quarterão com queijo",
            descricao: "Com batata média e Coca-Cola Zero.",
            nivel: "ocasional",
            detalhes: ["Quarterão com queijo — 566 kcal", "Batata média — 295 kcal", "Coca-Cola Zero — 0 kcal"],
            kcal: 861,
            mostrarKcal: true,
            tags: ["combo"],
          }),
        ],
      }),
      casa({
        id: "burger-king",
        nome: "Burger King",
        grupo: "Lanchonetes",
        logo: LOGO_BURGER_KING,
        ordem: 2,
        opcoes: [
          opcao({
            id: "burger-king-melhor",
            titulo: "Cheeseburger",
            descricao: "Com batata pequena e Coca-Cola Zero.",
            nivel: "melhor",
            detalhes: ["Cheeseburger — 308 kcal", "Batata pequena — 262 kcal", "Coca-Cola Zero — 0 kcal"],
            kcal: 570,
            mostrarKcal: true,
            tags: ["combo"],
          }),
          opcao({
            id: "burger-king-boa",
            titulo: "Whopper Jr.",
            descricao: "Com batata pequena e Coca-Cola Zero.",
            nivel: "boa",
            detalhes: ["Whopper Jr. — 388 kcal", "Batata pequena — 262 kcal", "Coca-Cola Zero — 0 kcal"],
            kcal: 650,
            mostrarKcal: true,
            tags: ["combo"],
          }),
          opcao({
            id: "burger-king-ocasional",
            titulo: "Whopper",
            descricao: "Com batata média e Coca-Cola Zero.",
            nivel: "ocasional",
            detalhes: ["Whopper — 819 kcal", "Batata média — 346 kcal", "Coca-Cola Zero — 0 kcal"],
            kcal: 1165,
            mostrarKcal: true,
            tags: ["combo"],
          }),
        ],
      }),
      casa({
        id: "subway",
        nome: "Subway",
        grupo: "Lanchonetes",
        // Ilustração, não a logo: a marca não está em nenhum acervo aberto e
        // desenhar uma imitação seria pior. A nutricionista troca pela real
        // em um clique, pelo painel.
        logo: ILUSTRACAO_SUB,
        ordem: 3,
        resumo: "Montagens do balcão, das mais leves às mais ocasionais.",
        opcoes: [
          opcao({
            id: "subway-melhor",
            titulo: "Frango assado",
            descricao: "Pão 9 grãos, sem queijo, molho mostarda e mel. Com refrigerante zero.",
            nivel: "melhor",
            detalhes: ["Sanduíche — 356 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 356,
            mostrarKcal: true,
            tags: ["sanduiche", "combo"],
          }),
          opcao({
            id: "subway-boa",
            titulo: "Frango empanado",
            descricao: "Pão italiano, molho barbecue. Com refrigerante zero.",
            nivel: "boa",
            detalhes: ["Sanduíche — 419 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 419,
            mostrarKcal: true,
            tags: ["sanduiche", "combo"],
          }),
          opcao({
            id: "subway-ocasional",
            titulo: "B.M.T. Italiano",
            descricao: "Três carnes e queijo. Com refrigerante zero.",
            nivel: "ocasional",
            detalhes: ["Sanduíche — 732 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 732,
            mostrarKcal: true,
            tags: ["sanduiche", "combo"],
          }),
        ],
      }),
      casa({
        id: "hamburgueria-artesanal",
        nome: "Artesanal",
        grupo: "Artesanais",
        logo: ILUSTRACAO_ARTESANAL,
        resumo: "Valores estimados — variam de casa para casa.",
        observacoes: [
          "Hamburgueria artesanal não tem tabela publicada, então estes números são estimativa. Use como ordem de grandeza, não como medida.",
        ],
        ordem: 3,
        opcoes: [
          opcao({
            id: "hamburgueria-artesanal-melhor",
            titulo: "Smash simples",
            descricao: "Pão brioche, cerca de 120 g de carne, sem molho extra. Com batata rústica pequena e refrigerante zero.",
            nivel: "melhor",
            detalhes: ["Smash simples — 450 kcal", "Batata rústica pequena — 250 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 700,
            mostrarKcal: true,
          observacaoEnergia: "Estimativa do total.",
            tags: ["combo"],
          }),
          opcao({
            id: "hamburgueria-artesanal-boa",
            titulo: "Clássico",
            descricao: "Blend de cerca de 150 g com queijo. Com batata rústica pequena ou média e refrigerante zero.",
            nivel: "boa",
            detalhes: ["Clássico — 650 kcal", "Batata rústica pequena ou média — 300 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 950,
            mostrarKcal: true,
          observacaoEnergia: "Estimativa do total.",
            tags: ["combo"],
          }),
          opcao({
            id: "hamburgueria-artesanal-ocasional",
            titulo: "Duplo smash com bacon",
            descricao: "Com molho especial, batata média ou grande e refrigerante zero.",
            nivel: "ocasional",
            detalhes: ["Duplo smash com bacon — 950 kcal", "Batata média ou grande — 400 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 1350,
            mostrarKcal: true,
          observacaoEnergia: "Estimativa do total.",
            tags: ["combo"],
          }),
        ],
      }),
    ],
    decisoes: [],
    lembretes: [],
    tags: ["hamburguer", "lanche", "burger"],
  },

  // ---------------------------------------------------------------- japonesa
  {
    id: "japonesa",
    nome: "Comida japonesa",
    resumo: "Entradas, combinados e o que costuma pesar no rodízio.",
    icone: "japonesa",
    logo: null,
    ordem: 2,
    status: "publicado",
    introducao:
      "Comece pelas entradas, escolha o combinado e deixe as preparações fritas e os molhos cremosos como parte menor da refeição.",
    estabelecimentos: [
      casa({
        id: "restaurante-japones",
        nome: "Restaurante japonês",
        grupo: "Restaurantes",
        logo: "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><ellipse cx='32' cy='50' rx='27' ry='6' fill='%23EFEAE1'/><rect x='8' y='30' width='20' height='19' rx='5' fill='%23FBF8F3' stroke='%23E6E1D9' stroke-width='1.5'/><rect x='12' y='26' width='12' height='8' rx='3' fill='%23E98A5E'/><path d='M12 29h12' stroke='%23F6C0A4' stroke-width='1.6'/><rect x='33' y='27' width='22' height='22' rx='6' fill='%23FBF8F3' stroke='%23E6E1D9' stroke-width='1.5'/><rect x='36' y='30' width='16' height='16' rx='4' fill='%233E4A3A'/><circle cx='44' cy='38' r='5' fill='%23FBF8F3'/><circle cx='44' cy='38' r='2.6' fill='%23E98A5E'/><path d='M6 22c6-4 14-4 20 0' stroke='%237FA35A' stroke-width='2.4' stroke-linecap='round' fill='none'/></svg>",
        ordem: 1,
        resumo: "Valores estimados — variam de casa para casa.",
        observacoes: [
          "Restaurante japonês não tem tabela publicada, então estes números são estimativa. Use como ordem de grandeza, não como medida.",
          "Molho shoyu tradicional ou light.",
          "O salmão é um peixe muito saudável, mas é rico em gordura, o que eleva o valor calórico da refeição. Para reduzir, prefira atum, peixe branco ou camarão.",
        ],
        opcoes: [
          opcao({
            id: "restaurante-japones-melhor",
            titulo: "Sashimi com edamame",
            descricao: "De 10 a 12 fatias, pouco shoyu. Com refrigerante zero.",
            nivel: "melhor",
            detalhes: ["Sashimi — 10 a 12 fatias", "Edamame", "Pouco shoyu", "Refrigerante zero"],
            kcal: 350,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["japonesa", "combo"],
          }),
          opcao({
            id: "restaurante-japones-boa",
            titulo: "Combinado de cerca de 20 peças",
            descricao: "Sushi, niguiri e uramaki, sem molhos cremosos. Com refrigerante zero.",
            nivel: "boa",
            detalhes: ["Cerca de 20 peças", "Sushi, niguiri e uramaki", "Sem molhos cremosos", "Refrigerante zero"],
            kcal: 600,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["japonesa", "combo"],
          }),
          opcao({
            id: "restaurante-japones-ocasional",
            titulo: "Combinado grande, 24 peças",
            descricao: "Maioria sushi, sashimi e uramaki tradicional, com 4 hot rolls. Sem tempura, molho especial moderado. Com refrigerante zero.",
            nivel: "ocasional",
            detalhes: ["24 peças", "4 hot rolls", "Sem tempura", "Molho especial moderado", "Refrigerante zero"],
            kcal: 1050,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["japonesa", "combo"],
          }),
        ],
      }),
    ],
    decisoes: [],
    lembretes: [],
    tags: ["japonesa", "japones", "sushi", "sashimi", "rodizio", "temaki"],
  },

  // ---------------------------------------------------------------- massas
  {
    id: "massas",
    nome: "Massas",
    resumo: "Quantidade da massa, proteína e molho.",
    icone: "massas",
    logo: null,
    ordem: 3,
    status: "publicado",
    introducao: "Três escolhas definem o prato: quanto de massa, se entra proteína e qual molho acompanha.",
    estabelecimentos: [
      casa({
        id: "spoleto",
        nome: "Spoleto",
        grupo: "Montar no balcão",
        // Ilustração até ela enviar a logo — mesma razão do Subway.
        logo: ILUSTRACAO_BALCAO,
        ordem: 1,
        opcoes: [
          opcao({
            id: "spoleto-melhor",
            titulo: "Bambini ao molho de tomate com frango",
            descricao: "Massa comum, 100 g. Com refrigerante zero.",
            nivel: "melhor",
            detalhes: ["Porção Bambini — 100 g de massa comum", "Molho de tomate", "Frango grelhado", "Sem queijo extra", "Refrigerante zero"],
            kcal: 350,
            mostrarKcal: true,
            observacaoEnergia: "Total do combo.",
            tags: ["massa", "combo"],
          }),
          opcao({
            id: "spoleto-boa",
            titulo: "Bambini ao branco ou bolonhesa com polpetone",
            descricao: "Massa comum, 100 g. Com refrigerante zero.",
            nivel: "boa",
            detalhes: ["Porção Bambini — 100 g de massa comum", "Molho branco ou bolonhesa", "Polpetone de frango ou peru", "Queijo moderado", "Refrigerante zero"],
            kcal: 460,
            mostrarKcal: true,
            observacaoEnergia: "Total do combo.",
            tags: ["massa", "combo"],
          }),
          opcao({
            id: "spoleto-ocasional",
            titulo: "Tradicional aos quatro queijos com polpetone de carne",
            descricao: "Massa comum, 200 g. Com refrigerante zero.",
            nivel: "ocasional",
            detalhes: ["Porção Tradicional — 200 g de massa comum", "Molho quatro queijos", "Polpetone de carne", "Sem adicionais extras", "Refrigerante zero"],
            kcal: 880,
            mostrarKcal: true,
            observacaoEnergia: "Total do combo.",
            tags: ["massa", "combo"],
          }),
        ],
      }),
      casa({
        id: "restaurante-italiano",
        nome: "Restaurante italiano",
        grupo: "Restaurantes",
        logo: ILUSTRACAO_ITALIANO,
        ordem: 2,
        resumo: "Valores estimados — variam de casa para casa.",
        observacoes: [
          "Restaurante italiano não tem tabela publicada, então estes números são estimativa. Use como ordem de grandeza, não como medida.",
        ],
        opcoes: [
          opcao({
            id: "italiano-melhor",
            titulo: "Massa ao sugo com frango ou camarão",
            descricao: "Massa comum. Com refrigerante zero.",
            nivel: "melhor",
            detalhes: ["Molho de tomate (sugo)", "Frango grelhado ou camarão", "Pouco queijo", "Refrigerante zero"],
            kcal: 550,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["massa", "combo"],
          }),
          opcao({
            id: "italiano-boa",
            titulo: "Bolonhesa ou carbonara mais leve",
            descricao: "Massa comum. Com refrigerante zero.",
            nivel: "boa",
            detalhes: ["Molho bolonhesa, ou carbonara em versão mais leve", "Queijo moderado", "Refrigerante zero"],
            kcal: 800,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["massa", "combo"],
          }),
          opcao({
            id: "italiano-ocasional",
            titulo: "Massa rica: Alfredo, carbonara tradicional ou quatro queijos",
            descricao: "Massa comum. Com refrigerante zero.",
            nivel: "ocasional",
            detalhes: ["Molho Alfredo, carbonara tradicional ou quatro queijos", "Pão de alho e queijo extra", "Refrigerante zero"],
            kcal: 1200,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["massa", "combo"],
          }),
        ],
      }),
    ],
    decisoes: [],
    lembretes: [
      "Prefira o molho ao sugo.",
      "Adicione proteína para trazer mais saciedade: massa e frango, massa e camarão, massa e carne magra.",
    ],
    tags: ["massa", "macarrao", "italiano", "molho", "spoleto", "lasanha"],
  },

  // ---------------------------------------------------------------- pizza
  {
    id: "pizza",
    nome: "Pizza",
    resumo: "Quantas fatias fecham uma refeição, por tipo de massa.",
    icone: "pizza",
    logo: null,
    ordem: 4,
    status: "publicado",
    introducao: "A conta muda com a massa: quanto mais densa, menos fatias fecham a mesma refeição.",
    estabelecimentos: [
      casa({
        id: "pizzaria",
        nome: "Pizzaria",
        grupo: "Restaurantes",
        logo: "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><path d='M32 6 58 52a3 3 0 0 1-2.7 4.4H8.7A3 3 0 0 1 6 52z' fill='%23E8C978'/><path d='M32 15 51 49H13z' fill='%23D8453A' opacity='.18'/><path d='M32 13 53 51H11z' fill='%23F0D9A6'/><circle cx='32' cy='27' r='4' fill='%23C0453A'/><circle cx='22' cy='40' r='4' fill='%23C0453A'/><circle cx='42' cy='41' r='4' fill='%23C0453A'/><circle cx='32' cy='45' r='3.2' fill='%23D4574B'/><ellipse cx='27' cy='33' rx='2.4' ry='1.6' fill='%237FA35A'/><ellipse cx='39' cy='33' rx='2.4' ry='1.6' fill='%237FA35A'/><path d='M6 52a3 3 0 0 0 2.7 4.4h46.6A3 3 0 0 0 58 52z' fill='%23D9A05B'/></svg>",
        ordem: 1,
        resumo: "Valores estimados — variam de casa para casa.",
        observacoes: ["Pizzaria não tem tabela publicada, então estes números são estimativa. Use como ordem de grandeza, não como medida."],
        opcoes: [
          opcao({
            id: "pizzaria-melhor",
            titulo: "2 fatias de massa fina",
            descricao: "Mussarela, sem borda recheada. Com refrigerante zero.",
            nivel: "melhor",
            detalhes: ["2 fatias", "Massa fina tradicional", "Mussarela", "Sem borda recheada", "Refrigerante zero"],
            kcal: 380,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["pizza", "combo"],
          }),
          opcao({
            id: "pizzaria-boa",
            titulo: "3 fatias de calabresa ou frango",
            descricao: "Catupiry moderado. Com refrigerante zero.",
            nivel: "boa",
            detalhes: ["3 fatias", "Calabresa, ou frango com catupiry moderado", "Refrigerante zero"],
            kcal: 650,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["pizza", "combo"],
          }),
          opcao({
            id: "pizzaria-ocasional",
            titulo: "4 a 5 fatias de mussarela, presunto e bacon",
            descricao: "Com refrigerante zero.",
            nivel: "ocasional",
            detalhes: ["4 a 5 fatias", "Mussarela, presunto e bacon", "Refrigerante zero"],
            kcal: 950,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["pizza", "combo"],
          }),
        ],
      }),
    ],
    decisoes: [],
    lembretes: [
      "Prefira opções com proteína e sem muita adição de queijo, como frango ou carne seca.",
    ],
    tags: ["pizza", "pizzaria", "fatia", "borda"],
  },

  // ---------------------------------------------------------------- açaí
  {
    id: "acai",
    nome: "Açaí",
    resumo: "Tamanho da tigela e o que entra junto.",
    icone: "acai",
    logo: null,
    ordem: 5,
    status: "publicado",
    introducao: "O tamanho decide se o açaí é a refeição livre inteira ou metade dela.",
    estabelecimentos: [
      casa({
        id: "acaiteria",
        nome: "Açaiteria",
        grupo: "Lojas",
        logo: "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><path d='M14 20h36l-4 30a6 6 0 0 1-6 5H24a6 6 0 0 1-6-5z' fill='%23FBF8F3' stroke='%23E6E1D9' stroke-width='1.5'/><path d='M15.5 26h33l-1.2 9c-5 3-10 1-15.8 1s-11-2-15-1z' fill='%236B3A72'/><path d='M16.6 35c4-1 9 1 15 1s11-2 15.7-1l-1.5 11H18.1z' fill='%237C4685'/><circle cx='24' cy='22' r='4' fill='%23E8C978'/><circle cx='33' cy='20' r='3.4' fill='%23C0453A'/><circle cx='41' cy='22' r='3.4' fill='%23E8C978'/><path d='M28 17c1-3 4-4 7-3' stroke='%237FA35A' stroke-width='2' stroke-linecap='round' fill='none'/></svg>",
        ordem: 1,
        resumo: "Valores estimados — variam de casa para casa.",
        observacoes: ["Açaiteria não tem tabela publicada, então estes números são estimativa. Use como ordem de grandeza, não como medida."],
        opcoes: [
          opcao({
            id: "acaiteria-melhor",
            titulo: "300 ml com banana e granola",
            descricao: "Adoçado com xarope.",
            nivel: "melhor",
            detalhes: ["300 ml", "Açaí com xarope", "Banana", "Granola"],
            kcal: 300,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["acai", "combo"],
          }),
          opcao({
            id: "acaiteria-boa",
            titulo: "500 ml com banana e granola",
            descricao: "Leite condensado moderado.",
            nivel: "boa",
            detalhes: ["500 ml", "Leite condensado moderado", "Banana", "Granola"],
            kcal: 450,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["acai", "combo"],
          }),
          opcao({
            id: "acaiteria-ocasional",
            titulo: "700 ml turbinado",
            descricao: "Leite condensado, Nutella, leite em pó e granola.",
            nivel: "ocasional",
            detalhes: ["700 ml", "Leite condensado", "Nutella", "Leite em pó", "Granola"],
            kcal: 850,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["acai", "combo"],
          }),
        ],
      }),
    ],
    decisoes: [],
    lembretes: [],
    tags: ["acai", "tigela", "copo"],
  },

  // ---------------------------------------------------------------- doces
  {
    id: "doces",
    nome: "Doces e sobremesas",
    resumo: "Cada uma destas conta como meia refeição livre.",
    icone: "doces",
    logo: "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><path d='M14 30h36v20a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z' fill='%23E8C978'/><path d='M14 40h36v4.5c-4 2.5-8 .5-12 .5s-8 2-12 0-6-3-8-2.5z' fill='%23C98F4E' opacity='.55'/><path d='M14 30c0-4 8-7 18-7s18 3 18 7c0 3-4 5-8 3.6-3-1-4 1.4-7 1.4s-4-2.4-7-1.4C24 35 20 33 14 30z' fill='%23FBF3DE'/><circle cx='32' cy='17' r='5.2' fill='%23C0453A'/><path d='M32 12V7' stroke='%237A4A2B' stroke-width='2' stroke-linecap='round'/><ellipse cx='22' cy='27' rx='2.4' ry='1.4' fill='%23C0453A'/><ellipse cx='42' cy='27' rx='2.4' ry='1.4' fill='%237C4685'/></svg>",
    ordem: 6,
    status: "publicado",
    introducao: "Duas destas opções somam uma refeição livre completa.",
    estabelecimentos: [],
    decisoes: [
      {
        id: "sobremesas",
        titulo: "Meias refeições doces",
        pergunta: "O que está na mesa?",
        observacoes: [
          "Doceria não tem tabela publicada, então estes números são estimativa. Use como ordem de grandeza, não como medida.",
        ],
        opcoes: [
          opcao({
            id: "doce-gelato",
            titulo: "Gelato: 1 copo médio com 2 sabores",
            descricao: "Bacio di Latte, Lullo, Mi Garba.",
            nivel: "melhor",
            kcal: 250,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa.",
            tags: ["gelato", "sorvete"],
          }),
          opcao({
            id: "doce-milkshake",
            titulo: "Milkshake pequeno",
            descricao: "Bob's, McDonald's.",
            nivel: "boa",
            kcal: 400,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa.",
            tags: ["milkshake"],
          }),
          opcao({
            id: "doce-bolo",
            titulo: "1 fatia média de bolo ou torta com calda",
            nivel: "boa",
            kcal: 400,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa.",
            tags: ["bolo", "torta"],
          }),
          opcao({
            id: "doce-cookie",
            titulo: "1 cookie artesanal grande, estilo americano",
            descricao: "Mr. Cheney, American Day.",
            nivel: "ocasional",
            kcal: 500,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa.",
            tags: ["cookie"],
          }),
          opcao({
            id: "doce-brownie",
            titulo: "1 brownie com 1 bola de sorvete",
            nivel: "ocasional",
            kcal: 630,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa.",
            tags: ["brownie", "sorvete"],
          }),
        ],
      },
    ],
    lembretes: [],
    tags: ["doce", "sobremesa", "chocolate", "bolo", "sorvete", "cookie"],
  },

  {
    id: "barzinho",
    nome: "Barzinho",
    resumo: "O que pedir para beber, e o que costuma acompanhar.",
    icone: "taca",
    logo: "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><path d='M10 12h44L36 34v18h9a3 3 0 0 1 0 6H19a3 3 0 0 1 0-6h9V34z' fill='%23EFEAE1'/><path d='M15 16h34L34 34h-4z' fill='%23E8C978'/><path d='M18 19h28l-5 6H23z' fill='%23F3DFA2'/><circle cx='45' cy='15' r='5' fill='%23C0453A'/><path d='M45 10V4' stroke='%237FA35A' stroke-width='2.4' stroke-linecap='round'/><path d='M40 9c3-3 7-3 10 0' stroke='%237FA35A' stroke-width='2' stroke-linecap='round' fill='none'/></svg>",
    ordem: 7,
    status: "publicado",
    introducao:
      "As contas abaixo são para duas doses — é o mínimo que costuma acontecer numa saída. Os números são estimativa: bar não publica tabela, e a receita muda de casa para casa.",
    decisoes: [
      {
        id: "com-drink",
        titulo: "Com drink",
        pergunta: "Duas doses, mais o que vem para beliscar.",
        observacoes: [],
        opcoes: [
          opcao({
            id: "drink-melhor",
            titulo: "Caipirinha, vodka soda ou Moscow Mule",
            descricao: "Duas doses, com porção pequena de azeitonas ou castanhas.",
            nivel: "melhor",
            detalhes: ["2 drinks — 360 kcal", "Azeitonas ou castanhas, porção pequena — 90 kcal"],
            kcal: 450,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["barzinho", "combo"],
          }),
          opcao({
            id: "drink-boa",
            titulo: "Margarita, Cosmopolitan ou caipiroska",
            descricao: "Duas doses, com tábua de queijos pequena.",
            nivel: "boa",
            detalhes: ["2 drinks — 500 kcal", "Tábua de queijos pequena — 200 kcal"],
            kcal: 700,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["barzinho", "combo"],
          }),
          opcao({
            id: "drink-ocasional",
            titulo: "Piña colada, sex on the beach ou caipirinha de frutas",
            descricao: "Duas doses, com três bruschettas.",
            nivel: "ocasional",
            detalhes: ["2 drinks — 800 kcal", "Bruschettas, 3 unidades — 150 kcal"],
            kcal: 950,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["barzinho", "combo"],
          }),
        ],
      },
      {
        id: "com-chopp",
        titulo: "Com chopp",
        pergunta: "Duas doses, mais o que vem para beliscar.",
        observacoes: [],
        opcoes: [
          opcao({
            id: "chopp-melhor",
            titulo: "Dois chopps pequenos",
            descricao: "300 ml cada, com porção pequena de azeitonas ou castanhas.",
            nivel: "melhor",
            detalhes: ["2 chopps de 300 ml — 240 kcal", "Azeitonas ou castanhas, porção pequena — 90 kcal"],
            kcal: 330,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["barzinho", "combo"],
          }),
          opcao({
            id: "chopp-boa",
            titulo: "Dois chopps médios",
            descricao: "500 ml cada, com tábua de queijos pequena.",
            nivel: "boa",
            detalhes: ["2 chopps de 500 ml — 400 kcal", "Tábua de queijos pequena — 200 kcal"],
            kcal: 600,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["barzinho", "combo"],
          }),
          opcao({
            id: "chopp-ocasional",
            titulo: "Dois chopps grandes",
            descricao: "700 ml cada, com três bruschettas.",
            nivel: "ocasional",
            detalhes: ["2 chopps de 700 ml — 560 kcal", "Bruschettas, 3 unidades — 150 kcal"],
            kcal: 710,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["barzinho", "combo"],
          }),
        ],
      },
    ],
    estabelecimentos: [],
    lembretes: [],
    tags: ["barzinho", "bar", "drink", "chopp", "cerveja", "happy hour", "alcool", "petisco"],
  },

  {
    id: "cinema",
    nome: "Cinema",
    resumo: "O tamanho da pipoca é a escolha inteira.",
    icone: "restaurante",
    logo: "data:image/svg+xml,<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><path d='M18 28h28l-3 27a4 4 0 0 1-4 3.6H25a4 4 0 0 1-4-3.6z' fill='%23C0453A'/><path d='M24 28h5l-1.6 30.6h-2.6zM35 28h5l-1.4 30.6H36z' fill='%23FBF8F3' opacity='.85'/><circle cx='24' cy='24' r='6' fill='%23F3E7C8'/><circle cx='33' cy='19' r='6.5' fill='%23FBF3DE'/><circle cx='42' cy='24' r='6' fill='%23F3E7C8'/><circle cx='28' cy='15' r='4.6' fill='%23F7EDD4'/><circle cx='38' cy='14' r='4.6' fill='%23F7EDD4'/><circle cx='19' cy='20' r='4' fill='%23FBF3DE'/><circle cx='47' cy='20' r='4' fill='%23FBF3DE'/><circle cx='33' cy='26' r='4.4' fill='%23F3E7C8'/></svg>",
    ordem: 8,
    status: "publicado",
    introducao:
      "A bebida zero não entra na conta, então o que decide é o balde. Os números são estimativa: a rede não publica tabela, e a manteiga muda tudo.",
    estabelecimentos: [],
    decisoes: [
      {
        id: "pipoca",
        titulo: "Pipoca e bebida",
        pergunta: "Qual balde?",
        observacoes: [],
        opcoes: [
          opcao({
            id: "cinema-melhor",
            titulo: "Pipoca pequena",
            descricao: "Com refrigerante zero.",
            nivel: "melhor",
            detalhes: ["Pipoca pequena — 200 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 200,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["cinema", "pipoca"],
          }),
          opcao({
            id: "cinema-boa",
            titulo: "Pipoca média",
            descricao: "Com refrigerante zero.",
            nivel: "boa",
            detalhes: ["Pipoca média — 450 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 450,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["cinema", "pipoca"],
          }),
          opcao({
            id: "cinema-ocasional",
            titulo: "Pipoca grande com um pacotinho de Fini",
            descricao: "Com refrigerante zero.",
            nivel: "ocasional",
            detalhes: ["Pipoca grande — 700 kcal", "Fini, pacotinho — 90 kcal", "Refrigerante zero — 0 kcal"],
            kcal: 790,
            mostrarKcal: true,
            observacaoEnergia: "Estimativa do total.",
            tags: ["cinema", "pipoca", "fini", "bala"],
          }),
        ],
      },
    ],
    lembretes: [],
    tags: ["cinema", "pipoca", "filme", "fini", "bala"],
  },

  // Categorias já reservadas — aparecem na grade e na busca, ainda sem conteúdo.
  { id: "restaurantes", nome: "Restaurantes", resumo: null, icone: "restaurante", logo: null, ordem: 9, status: "em-preparacao", introducao: null, decisoes: [], estabelecimentos: [], lembretes: [], tags: ["restaurante", "self service", "buffet", "por quilo"] },
  { id: "delivery", nome: "Delivery", resumo: null, icone: "delivery", logo: null, ordem: 10, status: "em-preparacao", introducao: null, decisoes: [], estabelecimentos: [], lembretes: [], tags: ["delivery", "ifood", "entrega"] },
];

export const CATEGORIA_COMER_FORA_POR_ID: ReadonlyMap<string, CategoriaComerFora> = new Map(
  CATEGORIAS_COMER_FORA.map((c) => [c.id, c]),
);
