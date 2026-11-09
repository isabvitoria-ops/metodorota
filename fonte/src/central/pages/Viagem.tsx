import { useState, useMemo, useCallback, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import type { FichaDeViagem } from "@/central/types/viagem";

type Pais = "it" | "pt" | "es";
type Idioma = "ptpt" | "it2" | "es2" | "en2";

const ESTRATEGIAS = [
  {
    titulo: "Enzima antes de cada refeição.",
    texto: "Tome 1 cápsula da Oficial Farma antes de cada refeição principal. Almoço e jantar, sem pular.",
  },
  {
    titulo: "Alho e cebola: pedir sem ou com menos.",
    texto: 'É o maior gatilho para SIBO. O ideal é pedir "senza aglio e cipolla" — mas se o prato que você quer leva alho e cebola e você vai comer assim mesmo, peça pelo menos "con meno aglio". Menos já é melhor que nada.',
  },
  {
    titulo: "Porção italiana.",
    texto: 'Na Itália, o "primo" (primeiro prato de massa) já vem em porção menor que no Brasil. Aceite a porção italiana — ela já é o controle.',
  },
  {
    titulo: "Alterne refeições no mesmo dia.",
    texto: "Todos os dias equilibrados: se almoçou mais pesado (massa, pizza), o jantar vai mais leve (peixe, legumes, arroz). Se o almoço foi simples, o jantar pode explorar mais. O intestino agradece as pausas entre uma refeição pesada e outra.",
  },
  {
    titulo: "Mastigar e caminhar.",
    texto: "Comer devagar, sem pressa. Caminhar 10 a 15 minutos depois da maior refeição. Evitar deitar nas 2 horas seguintes.",
  },
  {
    titulo: "Água: pelo menos 1,5 litro por dia.",
    texto: "Água sem gás, ao longo do dia, entre as refeições. Vai beber vinho? Beba. Mas intercale: cada taça de vinho, um copo de água. Evite cerveja e drinks com açúcar ou gás.",
  },
  {
    titulo: "Chás digestivos: pelo menos 2 por dia.",
    texto: "Um de manhã antes de sair e um à noite antes de dormir. Se puder mais, melhor. Gengibre, melissa, erva-cidreira, capim-limão ou erva-doce. Passe num supermercado ou lojinha e compre sachês de chá digestivo — tisana allo zenzero, tisana digestiva, camomilla. Faz muita diferença e não dá pra negligenciar.",
  },
  {
    titulo: "Diário (opcional).",
    texto: "A Isa colocou uma aba de diário nesta página pra conseguir te acompanhar de longe, em tempo real. Mas não é obrigatório. Se puder anotar, ajuda. Se não puder, tudo bem — aproveite a viagem.",
  },
];

interface AlimentoSemaforo {
  nome: string;
  detalhe: string;
}

const VERDE: AlimentoSemaforo[] = [
  { nome: "Proteínas", detalhe: "Frango, peru, peixes (dourada/orata, robalo/branzino, pescada/merluza, bacalhau, salmão), atum em lata, ovos (cozidos, mexidos, omelete), camarão, polvo, presunto cru (prosciutto, jamón)." },
  { nome: "Bases", detalhe: "Arroz branco, batata (cozida, assada, purê), polenta, massa e pão (o trigo europeu tende a estufar menos que o brasileiro). Quando disponível, a opção sem glúten ajuda na digestão." },
  { nome: "Legumes — pelo menos 1 vez por dia", detalhe: "Cenoura, abóbora, abobrinha, berinjela, espinafre, couve, beterraba, tomate, alface, pepino. Não abro mão disso: mesmo na Europa, pelo menos uma refeição por dia precisa ter legumes. Cozidos digerem melhor." },
  { nome: "Frutas — pelo menos 2 por dia", detalhe: "Kiwi, laranja, tangerina/clementina, abacaxi, morango, mirtilo, uva, mamão, melão, banana. Compre frutas e deixe no hotel. Mesmo com toda a comida boa da Europa, coma pelo menos 2 frutas por dia." },
  { nome: "Azeite", detalhe: "Principal gordura do Mediterrâneo. Não precisa limitar — é o tempero mais seguro que existe por lá." },
  { nome: "Chás digestivos", detalhe: "Gengibre, melissa, erva-cidreira, capim-limão, erva-doce, camomila. Pelo menos 2 por dia." },
  { nome: "Água", detalhe: "Pelo menos 1,5 litro por dia. Sem gás." },
];

const AMARELO: AlimentoSemaforo[] = [
  { nome: "Massa e pão de trigo", detalhe: "O trigo europeu (especialmente italiano) é diferente do brasileiro e tende a causar menos desconforto. Você vai comer massa e pão — enzima antes. Na Itália, prefira sem glúten quando disponível (é muito comum!), ou mescle: uma refeição com glúten, a próxima sem." },
  { nome: "Pizza", detalhe: "Escolha a pizza que quiser. Enzima antes. Se tiver opção senza glutine, é uma boa. Peça sem alho ou com menos alho quando possível." },
  { nome: "Gelato e doces", detalhe: "Coma o sabor que quiser — pistache, cookies, stracciatella, o que der vontade. Melhor depois de uma refeição completa do que de estômago vazio. Gelato leva leite: enzima antes ajuda." },
  { nome: "Alho e cebola", detalhe: 'O maior gatilho para SIBO. Quando puder, peça sem ou com menos ("senza aglio" / "con meno aglio"). Não precisa entrar em pânico se vier no prato — só não escolha pratos onde são o ingrediente principal (aglio e olio, sopa de cebola).' },
  { nome: "Queijos e laticínios", detalhe: "Queijos curados (parmesão, pecorino, manchego) têm pouca lactose. Queijos frescos (mozzarella, burrata, ricota) e cappuccino têm mais. Deixe o laticínio mais pesado pro gelato e pra sobremesas — não empilhe cappuccino + queijo fresco + gelato no mesmo dia." },
  { nome: "Vinho", detalhe: "Vai beber, beba. Intercale cada taça com um copo de água. Prefira durante a refeição, não de estômago vazio. Cerveja fermenta mais — vinho é melhor opção." },
  { nome: "Café", detalhe: "Depois de comer, nunca em jejum. Se piorar o estômago ou o gosto amargo, pare." },
  { nome: "Cogumelos, aspargos", detalhe: "Comuns na Europa. Você vai encontrar em vários pratos. Observe a resposta — se estufar muito, diminua." },
  { nome: "Embutidos e frios", detalhe: "Prosciutto, jamón, salame, copa. Fazem parte da cultura de lá. Coma com moderação — são ricos em sal e gordura." },
  { nome: "Croissant e doces de café da manhã", detalhe: "Cornetto, pastel de nata, churros. Faz parte do café da manhã europeu. Enzima antes e aproveite." },
];

const VERMELHO: AlimentoSemaforo[] = [
  { nome: "Feijão, lentilha, grão-de-bico e ervilha", detalhe: "Fora de cogitação. Leguminosas fermentam demais no intestino com SIBO. Evite pratos como fabada, cocido, ribollita, feijoada, sopas de lentilha e saladas de grão-de-bico. Esse é o limite que não vale a pena testar." },
  { nome: "Adoçantes e fermentáveis", detalhe: 'Xarope de agave, xilitol, sorbitol, manitol, maltitol, inulina e raiz de chicória. Sem chiclete, sem bala "sem açúcar", sem barrinha "sem açúcar". Não vale gastar cartucho com isso na Europa.' },
  { nome: "Refrigerante e água com gás", detalhe: "O gás expande no intestino. Prefira água sem gás e vinho. Suco de maçã e sucos concentrados também fermentam." },
  { nome: "Frituras em excesso", detalhe: "Tudo frito, em quantidade grande, pesa. Uma coxinha de vez em quando não é o problema — mas não faça de fritura a base do dia." },
];

const PAISES: Record<Pais, { nome: string; refeicoes: { periodo: string; desc: string }[]; gatilhos: string }> = {
  it: {
    nome: "Itália",
    refeicoes: [
      { periodo: "Café da manhã", desc: "Chá digestivo. Cornetto, pão, geleia, fruta, ovos se tiver. Enzima antes. Um caffè (espresso) depois — não em jejum. Cappuccino tem leite, mas é um por dia, não o fim do mundo." },
      { periodo: "Almoço e jantar", desc: "Enzima antes. Massa, pizza, risotto, peixe, carne, polenta — o que der vontade. Na Itália tem muita opção senza glutine, e a Isa gostaria que você preferisse quando disponível — ajuda bastante na digestão. Mas não é obrigação: mescle, uma com glúten, uma sem. Peça sem alho ou com menos quando possível. Alterne: se almoçou massa, janta mais leve (peixe, carne, legumes); se almoçou leve, janta o que quiser. Inclua legumes em pelo menos uma refeição." },
      { periodo: "Lanche", desc: "Gelato do sabor que quiser, um doce local, um café com algo. Melhor depois de uma refeição completa — gelato de estômago vazio pesa mais. Fruta pro hotel." },
      { periodo: "Muito alho/cebola", desc: "Soffritto é a base de quase tudo (molhos, ragù, risotto, sopas). Pergunte se pode vir com menos. Pratos com muito: aglio e olio, pesto (alho). Sem leguminosas: minestrone, ribollita (feijão e cebola), pasta e fagioli." },
    ],
    gatilhos: 'Dica Itália: "Senza glutine" é muito comum na Itália — por lei, todo estabelecimento deve oferecer ou informar sobre opções. Massa, pizza e pão sem glúten em muitos restaurantes. Pergunte: "Avete pasta senza glutine?"',
  },
  pt: {
    nome: "Portugal",
    refeicoes: [
      { periodo: "Café da manhã", desc: "Chá digestivo. Pão, manteiga, geleia, fruta, ovos se tiver. Uma empada ou um bolo típico? Vai. Enzima antes. Café depois de comer." },
      { periodo: "Almoço e jantar", desc: "Enzima antes. Peixe grelhado (dourada, robalo, pescada) com batata e legumes; bacalhau cozido com batata e ovo (sem grão-de-bico); polvo com batata e azeite; frango; arroz. Vinho: Portugal sem vinho não existe — intercale cada taça com um copo de água. Inclua legumes em pelo menos uma refeição." },
      { periodo: "Lanche", desc: "Pastel de nata, doce local, gelado, fruta. Enzima antes do doce. Aproveite." },
      { periodo: "Muito alho/cebola", desc: "Caldo verde (cebola, alho, chouriço); bacalhau à Brás, à Gomes de Sá, com natas (cebola, alho, creme); arroz de tomate (refogado de cebola); frango no churrasco (marinada de alho). O couvert (pão, queijo, enchidos, azeitonas) chega à mesa e é cobrado se usado." },
    ],
    gatilhos: "",
  },
  es: {
    nome: "Espanha",
    refeicoes: [
      { periodo: "Café da manhã", desc: "Chá digestivo. Pão, tortilla francesa, fruta, o que tiver. Churros con chocolate? Vai. Enzima antes. Café depois de comer." },
      { periodo: "Almoço e jantar", desc: 'Enzima antes. Pescado a la plancha, pollo a la plancha, pulpo a la gallega (polvo, batata, azeite, pimentón dulce), gambas a la plancha, tapas. O menú del día é ótimo pra escolher. Peça sem alho ou com menos ("sin ajo o con poco ajo") quando possível. Vinho com a refeição: intercale com água. Inclua legumes em pelo menos uma refeição.' },
      { periodo: "Lanche", desc: "Helado (sorvete), doce local, fruta, o que aparecer. Enzima antes. Tapas à noite contam como refeição — enzima antes também." },
      { periodo: "Muito alho/cebola", desc: "Tortilla de patatas (muita cebola), paella (sofrito de cebola e alho), gazpacho e salmorejo (alho), gambas al ajillo (muito alho), patatas bravas (molho). Sem leguminosas: cocido, fabada, lentejas." },
    ],
    gatilhos: "",
  },
};

const CARTOES: Record<Idioma, { label: string; texto: string; destaque1: string; destaque2: string }> = {
  ptpt: {
    label: "PT-PT",
    texto: "Tenho sensibilidade alimentar por motivo de saúde.",
    destaque1: "Não posso comer: feijão, grão-de-bico, lentilha e ervilha.",
    destaque2: "Pode preparar sem alho e sem cebola, ou com menos? Têm opção sem glúten? Obrigada!",
  },
  it2: {
    label: "Italiano",
    texto: "Ho una sensibilità alimentare per motivi di salute.",
    destaque1: "Non posso mangiare: fagioli, ceci, lenticchie e piselli.",
    destaque2: "Potete prepararlo senza aglio e cipolla, o con meno? Avete opzioni senza glutine? Grazie!",
  },
  es2: {
    label: "Español",
    texto: "Tengo sensibilidad alimentaria por motivos de salud.",
    destaque1: "No puedo comer: alubias, garbanzos, lentejas ni guisantes.",
    destaque2: "¿Pueden prepararlo sin ajo ni cebolla, o con menos? ¿Tienen opciones sin gluten? ¡Gracias!",
  },
  en2: {
    label: "English",
    texto: "I have a food sensitivity for medical reasons.",
    destaque1: "I cannot eat: beans, chickpeas, lentils or peas.",
    destaque2: "Could you prepare it without garlic and onion, or with less? Do you have gluten-free options? Thank you!",
  },
};

const FRASES = [
  ["Sem alho e sem cebola", "Senza aglio e senza cipolla", "Sin ajo y sin cebolla", "No garlic and no onion"],
  ["Sem glúten (trigo)", "Senza glutine (grano)", "Sin gluten (trigo)", "Gluten-free (wheat)"],
  ["Sem leite e lactose", "Senza latte e senza lattosio", "Sin leche ni lactosa", "No milk or lactose"],
  ["Têm opção sem glúten?", "Avete opzioni senza glutine?", "¿Tienen opciones sin gluten?", "Do you have gluten-free options?"],
  ["Molho à parte?", "Può servire la salsa a parte?", "¿Puede servir la salsa aparte?", "Sauce on the side?"],
  ["Grelhado simples", "Alla griglia, solo con olio e sale", "A la plancha, solo aceite y sal", "Grilled, just olive oil and salt"],
  ["Chá de gengibre", "Una tisana allo zenzero, per favore", "Una infusión de jengibre, por favor", "Ginger tea, please"],
  ["Enzimas digestivas, por favor", "Vorrei enzimi digestivi, per favore", "Quiero enzimas digestivas, por favor", "Digestive enzymes, please"],
];

const ROTULO_TRAD = [
  ["alho, cebola", "aglio, cipolla", "ajo, cebolla", "garlic, onion"],
  ["sem glúten", "senza glutine", "sin gluten", "gluten-free"],
  ["leite, lactose", "latte, lattosio", "leche, lactosa", "milk, lactose"],
  ["feijão, grão-de-bico, lentilha", "fagioli, ceci, lenticchie", "alubias, garbanzos, lentejas", "beans, chickpeas, lentils"],
  ["edulcorantes, sorbitol, xilitol", "dolcificanti, sorbitolo, xilitolo", "edulcorantes, sorbitol, xilitol", "sweeteners, sorbitol, xylitol"],
];

const DIAS_VIAGEM = [
  { n: 1, d: "11/11", w: "qua" }, { n: 2, d: "12/11", w: "qui" }, { n: 3, d: "13/11", w: "sex" },
  { n: 4, d: "14/11", w: "sáb" }, { n: 5, d: "15/11", w: "dom" }, { n: 6, d: "16/11", w: "seg" },
  { n: 7, d: "17/11", w: "ter" }, { n: 8, d: "18/11", w: "qua" }, { n: 9, d: "19/11", w: "qui" },
  { n: 10, d: "20/11", w: "sex" }, { n: 11, d: "21/11", w: "sáb" }, { n: 12, d: "22/11", w: "dom" },
  { n: 13, d: "23/11", w: "seg" }, { n: 14, d: "24/11", w: "ter" }, { n: 15, d: "25/11", w: "qua" },
  { n: 16, d: "26/11", w: "qui" },
];

const CHECKLIST_BRASIL = [
  "Garrafa reutilizável (leve vazia na segurança do aeroporto).",
  "Chás em sachê: gengibre, capim-limão, melissa ou erva-cidreira.",
  "Castanhas em porções de cerca de 20 g: amendoim, nozes, macadâmia, pistache. Evite caju.",
  "Tostas ou bolachas de arroz (ou compre lá).",
  "Barrinhas só se o rótulo estiver limpo: sem inulina, raiz de chicória, mel, xilitol ou sorbitol.",
  "Remédios e suplementos da prescrição, na embalagem original, bolsa de mão, com receita ou carta.",
  "Ficha de saúde preenchida, mais cópia do exame e do resumo da sua médica.",
  "Roupas de cós folgado.",
];

const CHECKLIST_DESTINO = [
  'Chás digestivos em sachê: gengibre, camomila, melissa, erva-cidreira, erva-doce. Na Itália: "tisana digestiva" ou "tisana allo zenzero". Em Portugal e Espanha: "infusão digestiva" ou "infusión digestiva".',
  "Frutas: banana pouco madura, tangerinas, kiwi, laranja, morangos ou mirtilos.",
  "Redes comuns: Portugal (Pingo Doce, Continente, Auchan, Lidl), Itália (Conad, Coop, Esselunga, Carrefour), Espanha (Mercadona, Carrefour, Dia). Confirme a loja mais próxima na hora.",
];

const SECOES = [
  { id: "estrategia", label: "Estratégia" },
  { id: "semaforo", label: "Guia" },
  { id: "pedir", label: "Pedir" },
  { id: "cartao", label: "Cartão" },
  { id: "frases", label: "Frases" },
  { id: "kit", label: "Kit" },
  { id: "dificeis", label: "Dias difíceis" },
  { id: "alerta", label: "Alerta" },
  { id: "diario", label: "Diário" },
];

interface DiaDoDiario {
  onde: string;
  inchaco: string;
  dor: string;
  azia: string;
  evacuacoes: string;
  bristol: string;
  observacoes: string;
}

const DIA_VAZIO: DiaDoDiario = { onde: "", inchaco: "", dor: "", azia: "", evacuacoes: "", bristol: "", observacoes: "" };

type Diario = Record<number, DiaDoDiario>;

const EM_BRANCO = "_______________";

/** O diário fica só no aparelho, separado por conta. */
function chaveDoDiario(perfilId: string | null): string {
  return `central:viagem-diario:v1:${perfilId ?? "anonimo"}`;
}

function lerDiario(chave: string): Diario {
  try {
    const bruto = window.localStorage.getItem(chave);
    const dados: unknown = bruto ? JSON.parse(bruto) : null;
    return dados && typeof dados === "object" && !Array.isArray(dados) ? (dados as Diario) : {};
  } catch {
    return {};
  }
}

function irParaSecao(id: string) {
  document.getElementById(`vg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function Viagem() {
  const { acesso } = useSessao();
  const [paisAtivo, definirPais] = useState<Pais>("it");
  const [idiomaAtivo, definirIdioma] = useState<Idioma>("it2");
  const [buscaAlimento, definirBuscaAlimento] = useState("");
  const [copiado, definirCopiado] = useState(false);
  const [ficha, definirFicha] = useState<FichaDeViagem | null>(null);
  const chaveDiario = chaveDoDiario(acesso.perfilId);
  const [diario, definirDiario] = useState<Diario>(() => lerDiario(chaveDiario));

  useEffect(() => {
    if (!acesso.viagem) return;
    let ativo = true;
    repositorio
      .minhaFichaDeViagem()
      .then((dados) => {
        if (ativo) definirFicha(dados);
      })
      .catch(() => {
        /* sem a ficha, os campos ficam em branco para preencher à mão */
      });
    return () => {
      ativo = false;
    };
  }, [acesso.viagem]);

  const buscaNorm = useMemo(() => normalizar(buscaAlimento), [buscaAlimento]);

  const filtra = useCallback(
    (items: AlimentoSemaforo[]) => {
      if (buscaNorm.length < 2) return items;
      return items.filter((i) => {
        const texto = normalizar(i.nome + " " + i.detalhe);
        return texto.includes(buscaNorm);
      });
    },
    [buscaNorm],
  );

  const verdesFiltrados = filtra(VERDE);
  const amarelosFiltrados = filtra(AMARELO);
  const vermelhosFiltrados = filtra(VERMELHO);

  function anotar(dia: number, campo: keyof DiaDoDiario, valor: string) {
    definirDiario((anterior) => {
      const novo = { ...anterior, [dia]: { ...DIA_VAZIO, ...anterior[dia], [campo]: valor } };
      try {
        window.localStorage.setItem(chaveDiario, JSON.stringify(novo));
      } catch {
        /* sem armazenamento, o diário vale só enquanto a tela estiver aberta */
      }
      return novo;
    });
  }

  function copiarModelo() {
    const texto = "Dia __ | Inchaço __/10 | Dor __/10 | Azia ou amargo __/10 | Evacuações __ (Bristol __) | Comi de diferente: _____ | Algum sinal de alerta? sim / não";
    try {
      void navigator.clipboard.writeText(texto);
      definirCopiado(true);
      setTimeout(() => definirCopiado(false), 2000);
    } catch {
      /* sem suporte, ignora */
    }
  }

  if (!acesso.viagem) return <Navigate to={rotas.home} replace />;

  const paisInfo = PAISES[paisAtivo];
  const cartao = CARTOES[idiomaAtivo];
  // A nutricionista abre a tela para conferir: o nome dela não é o da paciente.
  const nomeDaPaciente = ficha?.nome ?? (acesso.papel === "admin" ? null : acesso.nome);
  const primeiroNome = nomeDaPaciente?.trim().split(" ")[0] || null;

  return (
    <>
      <CabecalhoPagina titulo="Rota Viagem" voltarPara={rotas.home} />

      <div className="c-conteudo c-viagem-guia">
      {/* Hero */}
      <div className="c-vg-hero">
        <p className="c-vg-hero-tag">Módulo exclusivo</p>
        <p className="c-vg-hero-tagline">Seu intestino, em qualquer destino.</p>
        <p className="c-vg-hero-meta">
          <strong>{primeiroNome ? `Guia personalizado para ${primeiroNome}` : "Guia personalizado"}</strong>
        </p>
        <p className="c-vg-hero-meta">Portugal · Itália · Espanha</p>
        <p className="c-vg-hero-meta">11 a 26 de novembro de 2026 (16 dias)</p>
      </div>

      {/* Nav sticky */}
      <nav className="c-vg-nav" aria-label="Seções do guia">
        {SECOES.map((s) => (
          <button key={s.id} type="button" className="c-vg-nav-link" onClick={() => irParaSecao(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      {/* ESTRATÉGIA */}
      <section id="vg-estrategia" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Estratégia da viagem</h2>
        <ol className="c-vg-estrategias">
          {ESTRATEGIAS.map((e, i) => (
            <li key={i} className="c-vg-estrategia">
              <span className="c-vg-estrategia-num">{i + 1}</span>
              <span><strong>{e.titulo}</strong> {e.texto}</span>
            </li>
          ))}
        </ol>
        <div className="c-vg-dica">
          <strong>Gosto amargo na boca:</strong> escove os dentes e raspe a língua de manhã, beba água em goles ao longo do dia e prefira chá de gengibre, melissa ou erva-cidreira.
        </div>

        <h3 className="c-vg-sub">Como um dia de verdade vai ser</h3>
        <div className="c-vg-refeicoes">
          <div className="c-vg-refeicao"><span className="c-vg-refeicao-label">Manhã</span><span>Chá digestivo antes de sair. No café do hotel: croissant, pão, geleia, fruta, o que tiver. Coma com calma, sem pressa. <strong>Enzima antes se for pesado.</strong> Um cafezinho depois, não em jejum.</span></div>
          <div className="c-vg-refeicao"><span className="c-vg-refeicao-label">Almoço</span><span><strong>Enzima antes.</strong> Massa, pizza, prato local — o que der vontade. Peça sem alho e cebola (ou com menos). Se o almoço for mais pesado, o jantar compensa sendo mais leve. Caminhada de 10 a 15 minutos depois.</span></div>
          <div className="c-vg-refeicao"><span className="c-vg-refeicao-label">Lanche</span><span>Gelato, fruta, um doce local — o que aparecer. Se já tomou gelato no almoço, uma fruta ou castanhas agora equilibra.</span></div>
          <div className="c-vg-refeicao"><span className="c-vg-refeicao-label">Jantar</span><span><strong>Enzima antes.</strong> Se almoçou pesado: peixe, arroz, legumes, algo mais leve. Se almoçou mais simples: pode explorar outro prato local. Vinho? Intercale com água. Chá digestivo antes de dormir.</span></div>
        </div>
        <div className="c-vg-dica">
          <strong>A lógica é simples:</strong> enzima antes de cada refeição, alterne pesado e leve ao longo do dia, água entre as refeições, chá de manhã e à noite. O resto é aproveitar.
        </div>
      </section>

      {/* GUIA ALIMENTAR */}
      <section id="vg-semaforo" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Guia alimentar da viagem</h2>
        <p className="c-vg-intro">A gente não está fazendo dieta na Europa. A gente está tentando diminuir os danos pra você aproveitar a viagem <strong>com menos sintomas</strong>. Esse guia mostra o que ajuda, o que pede cuidado e o que vale evitar de verdade.</p>

        <input
          type="text"
          className="c-vg-busca"
          placeholder="Pesquise um alimento..."
          value={buscaAlimento}
          onChange={(e) => definirBuscaAlimento(e.target.value)}
        />

        {verdesFiltrados.length > 0 && (
          <div className="c-vg-sem-grupo">
            <div className="c-vg-sem-label c-vg-sem-label--verde">O que ajuda o intestino</div>
            <div className="c-vg-sem-corpo c-vg-sem-corpo--verde">
              {verdesFiltrados.map((a, i) => (
                <div key={i} className="c-vg-sem-item"><strong>{a.nome}</strong><span>{a.detalhe}</span></div>
              ))}
            </div>
          </div>
        )}

        {amarelosFiltrados.length > 0 && (
          <div className="c-vg-sem-grupo">
            <div className="c-vg-sem-label c-vg-sem-label--amarelo">Coma, mas observe como se sente</div>
            <div className="c-vg-sem-corpo c-vg-sem-corpo--amarelo">
              {amarelosFiltrados.map((a, i) => (
                <div key={i} className="c-vg-sem-item"><strong>{a.nome}</strong><span>{a.detalhe}</span></div>
              ))}
            </div>
          </div>
        )}

        {vermelhosFiltrados.length > 0 && (
          <div className="c-vg-sem-grupo">
            <div className="c-vg-sem-label c-vg-sem-label--vermelho">Isso sim vale evitar de verdade</div>
            <div className="c-vg-sem-corpo c-vg-sem-corpo--vermelho">
              {vermelhosFiltrados.map((a, i) => (
                <div key={i} className="c-vg-sem-item"><strong>{a.nome}</strong><span>{a.detalhe}</span></div>
              ))}
            </div>
          </div>
        )}

        <div className="c-vg-dica" style={{ marginTop: 16 }}>
          <strong>A ideia é conforto, não restrição.</strong> A gente está buscando um equilíbrio pra você aproveitar a viagem sem sentir dor. Enzima antes das refeições, água entre elas, chá de manhã e à noite, e leguminosas fora. O resto é curtir.
        </div>

        <div className="c-vg-card" style={{ marginTop: 12 }}>
          <strong>No supermercado:</strong> se for comprar coisas embaladas, dê uma olhada nos ingredientes. O que vale checar: se leva alho e cebola como ingrediente principal, e se tem adoçantes (E420, E421, E965, E966, E967) ou inulina. Na Itália, procure "senza glutine" — tem muita opção boa.
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="c-vg-tabela c-vg-tabela--rotulo">
            <thead><tr><th>Português</th><th>Italiano</th><th>Español</th><th>English</th></tr></thead>
            <tbody>
              {ROTULO_TRAD.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* O QUE PEDIR */}
      <section id="vg-pedir" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">O que pedir em cada país</h2>
        <p className="c-vg-intro">Pratos e ingredientes comuns em cada cozinha. Quando puder, peça sem alho e sem cebola (ou com menos). As frases úteis estão na seção seguinte.</p>

        <div className="c-vg-abas">
          {(["it", "pt", "es"] as Pais[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`c-vg-aba ${paisAtivo === p ? "c-vg-aba--ativo" : ""}`}
              onClick={() => definirPais(p)}
            >
              {PAISES[p].nome}
            </button>
          ))}
        </div>

        <h3 className="c-vg-sub" style={{ marginTop: 0 }}>{paisInfo.nome}</h3>
        <div className="c-vg-refeicoes">
          {paisInfo.refeicoes.map((r, i) => (
            <div key={i} className="c-vg-refeicao">
              <span className="c-vg-refeicao-label">{r.periodo}</span>
              <span>{r.desc}</span>
            </div>
          ))}
        </div>
        {paisInfo.gatilhos && (
          <div className="c-vg-dica" style={{ marginTop: 12 }}>
            <strong>{paisInfo.gatilhos.split(":")[0]}:</strong>{paisInfo.gatilhos.substring(paisInfo.gatilhos.indexOf(":") + 1)}
          </div>
        )}
      </section>

      {/* CARTÃO DO GARÇOM */}
      <section id="vg-cartao" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Cartão para mostrar ao garçom</h2>
        <p className="c-vg-intro">Mostre na tela do celular. Escolha o idioma do país onde você está.</p>

        <div className="c-vg-abas">
          {(["ptpt", "it2", "es2", "en2"] as Idioma[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`c-vg-aba ${idiomaAtivo === id ? "c-vg-aba--ativo" : ""}`}
              onClick={() => definirIdioma(id)}
            >
              {CARTOES[id].label}
            </button>
          ))}
        </div>

        <div className="c-vg-cartao-garcom">
          {cartao.texto} <strong>{cartao.destaque1}</strong> <strong>{cartao.destaque2}</strong>
        </div>
      </section>

      {/* FRASES ÚTEIS */}
      <section id="vg-frases" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Frases úteis</h2>
        <p className="c-vg-intro">Mostre o celular ou leia em voz alta. Em Portugal use a coluna de português europeu.</p>
        <div style={{ overflowX: "auto" }}>
          <table className="c-vg-tabela c-vg-tabela--frases">
            <thead><tr><th>PT</th><th>Italiano</th><th>Español</th><th>English</th></tr></thead>
            <tbody>
              {FRASES.map((f, i) => (
                <tr key={i}>{f.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* VOO E TRANSPORTE */}
      <section className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Voo longo, trens e passeios</h2>
        <h3 className="c-vg-sub">Voo longo</h3>
        <ul className="c-vg-lista">
          <li><strong>Por que o inchaço piora no avião:</strong> a cabine é pressurizada e os gases do intestino se expandem. Vá com roupa confortável (cós folgado) e evite uma refeição grande antes do embarque.</li>
          <li><strong>Antes de embarcar:</strong> faça uma refeição simples 2 a 3 horas antes. Não vá em jejum longo.</li>
          <li><strong>A bordo:</strong> beba água em goles, de hora em hora. <strong>Evite refrigerante, suco de caixinha e café a bordo</strong> — fermentam e pioram o inchaço na altitude. Vinho pode, com moderação e intercalando com água. Na refeição de bordo, fique com arroz, frango ou peixe e legumes cozidos; deixe de lado molhos cremosos e salada crua com cebola.</li>
          <li><strong>Mexa-se:</strong> levante e caminhe a cada 1 a 2 horas e movimente os tornozelos. Ajuda o intestino e a circulação.</li>
          <li><strong>Lanche na bolsa:</strong> castanhas, uma fruta e uma garrafinha de água. Compre tudo <strong>depois da imigração</strong>, na loja do embarque.</li>
        </ul>

        <h3 className="c-vg-sub" style={{ marginTop: 16 }}>Fuso e horários</h3>
        <p>Em novembro, Portugal fica 3 horas à frente de Brasília; Espanha e Itália ficam 4 horas à frente. Assim que chegar, ajuste as refeições ao horário local, mantendo cerca de 3 horas entre elas.</p>

        <h3 className="c-vg-sub" style={{ marginTop: 16 }}>Trens, ônibus e passeios longos</h3>
        <ul className="c-vg-lista">
          <li>Vá ao banheiro antes de embarcar e leve água e o lanche do kit.</li>
          <li>Programe a hora da refeição antes de sair. Passar o dia sem comer e depois comer muito é pior do que comer pouco e com regularidade.</li>
          <li>Tente comer a última refeição pelo menos 2 horas antes de deitar.</li>
          <li>Tapas e petiscos: escolha 1 ou 2 opções simples e pare. Beliscar a noite inteira é o oposto do que o intestino precisa.</li>
        </ul>

        <div className="c-vg-alerta-amarelo" style={{ marginTop: 12 }}>
          <strong>Alimentos na bagagem:</strong> As regras sanitárias da UE restringem a entrada de <strong>carnes, embutidos, queijos, leite e vegetais frescos</strong> vindos de fora do bloco. Leve do Brasil apenas itens <strong>industrializados, selados e de origem vegetal</strong> (castanhas, chás). Frutas e itens frescos: compre lá.
        </div>
      </section>

      {/* KIT DE BOLSO */}
      <section id="vg-kit" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Kit de bolso</h2>
        <h3 className="c-vg-sub">Do Brasil (itens industrializados e selados)</h3>
        <ul className="c-vg-checklist">
          {CHECKLIST_BRASIL.map((item, i) => <li key={i}>{item}</li>)}
        </ul>

        <h3 className="c-vg-sub" style={{ marginTop: 16 }}>Enzima digestiva (levar do Brasil)</h3>
        <p>Você vai levar a sua enzima digestiva (<strong>Complexo de Enzimas Digestivas — Oficial Farma</strong>) no pote, na bolsa de mão. Contém bromelina, papaína, protease, lipase, pancreatina e amilase — ajuda a digerir proteínas, gorduras e amido das refeições mais pesadas.</p>
        <ul className="c-vg-checklist" style={{ marginTop: 8 }}>
          <li><strong>Tome 1 cápsula antes de cada refeição principal</strong> (café, almoço e jantar).</li>
          <li>Ajuda a digerir melhor, especialmente proteínas, gorduras e amido. Tome mesmo quando a refeição parecer leve.</li>
          <li>Se o pote acabar durante a viagem: em qualquer <strong>farmacia</strong> (cruz verde na Itália, farmácia em Portugal, farmacia na Espanha) você encontra enzimas digestivas sem receita. Peça "<em>enzimi digestivi</em>" na Itália.</li>
        </ul>

        <h3 className="c-vg-sub" style={{ marginTop: 16 }}>No destino (supermercado ou mercado)</h3>
        <div className="c-vg-dica" style={{ marginBottom: 12 }}>
          <strong>Primeiro item da lista: chás digestivos.</strong> Passe num supermercado ou lojinha e compre sachês de chá: tisana allo zenzero (gengibre), tisana digestiva, camomilla, melissa. Pelo menos 2 por dia (manhã e noite). Faz muita diferença.
        </div>
        <ul className="c-vg-checklist">
          {CHECKLIST_DESTINO.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </section>

      {/* DIAS DIFÍCEIS */}
      <section id="vg-dificeis" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Dias difíceis: o que fazer</h2>
        {[
          { titulo: "Inchaço ou desconforto, sem sinais de alerta", texto: "Faça uma refeição bem simples e menor (arroz branco, batata ou mandioca cozida, frango ou peixe, cenoura ou abóbora cozida). Chá de gengibre e água em goles. Caminhada leve de 10 a 15 minutos. Evite gordura, fritura, café, álcool, refrigerante e doces. Não fique em jejum longo. Anote no diário." },
          { titulo: "Intestino preso", texto: "Mais água, kiwi, mamão ou laranja, caminhada. Evite aumentar fibra sem aumentar líquido. Sobre o Peg-lax, siga a regra combinada com a sua médica." },
          { titulo: "Diarreia (fezes tipo 6 ou 7)", texto: "Repor líquidos, comer arroz, batata, frango ou peixe cozido, banana prata ou maçã, evitar fibras extras, café e álcool. Avise a sua médica sobre o Peg-lax e a mim sobre o magnésio." },
          { titulo: "Azia, queimação ou gosto amargo", texto: "Refeições menores, sem deitar nas 2 horas seguintes, cabeceira da cama um pouco elevada, e trocar café, cítricos fortes e hortelã por banana, mamão e melissa ou gengibre. Siga o omeprazol conforme a receita." },
          { titulo: "Dor ou náusea", texto: "Não trate sozinha e não use nenhum medicamento sem a orientação da sua médica. Confira os sinais de alerta abaixo." },
        ].map((c, i) => (
          <div key={i} className="c-vg-card" style={{ marginBottom: 12 }}>
            <h3 className="c-vg-sub" style={{ marginTop: 0 }}>{c.titulo}</h3>
            <p>{c.texto}</p>
          </div>
        ))}
      </section>

      {/* SINAIS DE ALERTA */}
      <section id="vg-alerta" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Sinais de alerta</h2>
        <div className="c-vg-alerta-vermelho">
          <h3>Ligue 112 (ou vá a um pronto-socorro) se houver:</h3>
          <ul>
            <li>falta de ar, inchaço do rosto ou da boca, coceira pelo corpo todo com manchas;</li>
            <li>dor abdominal muito forte, contínua, ou abdome duro;</li>
            <li>vômitos com sangue ou fezes pretas, como borra de café, ou com sangue vivo;</li>
            <li>inchaço intenso com vômitos e sem conseguir soltar gases nem evacuar;</li>
            <li>desmaio, confusão ou muita fraqueza.</li>
          </ul>
        </div>

        <p className="c-vg-112-nota">112 funciona em Portugal, Espanha e Itália. "Urgências" em Portugal e na Espanha, "pronto soccorso" na Itália.</p>

        <div className="c-vg-alerta-amarelo">
          Se houver sinal de alerta, <strong>não espere resposta por mensagem</strong>: procure atendimento médico.
        </div>

        <h3 className="c-vg-sub" style={{ marginTop: 20 }}>Ficha de saúde (em inglês — leve na bolsa)</h3>
        <div className="c-vg-ficha">
          {[
            ["Name", ficha?.nome ?? EM_BRANCO],
            ["Date of birth", ficha?.nascimento ?? EM_BRANCO],
            ["Diagnoses", ficha?.diagnosticos ?? EM_BRANCO],
            ["Allergies", EM_BRANCO],
            ["Current medicines", EM_BRANCO],
            ["Doctor / phone", EM_BRANCO],
          ].map(([label, valor], i) => (
            <div key={i} className="c-vg-ficha-linha">
              <span className="c-vg-ficha-label">{label}</span>
              <span>{valor}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.85rem", marginTop: 4 }}>Preencha os campos em branco e leve na bolsa junto com a receita dos medicamentos.</p>
      </section>

      {/* DIÁRIO */}
      <section id="vg-diario" className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Diário intestinal da viagem</h2>
        <p className="c-vg-intro">Esse diário não é obrigatório — a Isa deixou aqui pra conseguir te acompanhar de longe, caso você queira. Se der pra preencher à noite, ótimo (leva 2 minutos). Se não der, tudo bem. Escala de 0 (nada) a 10 (o pior que você já sentiu). O que você anota fica guardado só neste aparelho: tire uma foto da tela e envie, ou copie o modelo abaixo.</p>

        {DIAS_VIAGEM.map((dia) => {
          const d = diario[dia.n] ?? DIA_VAZIO;
          const escala = (rotulo: string, campo: "inchaco" | "dor" | "azia") => (
            <label className="c-vg-diario-campo">
              <span>{rotulo}</span>
              <input
                type="number"
                inputMode="numeric"
                className="c-input"
                min={0}
                max={10}
                value={d[campo]}
                onChange={(e) => anotar(dia.n, campo, e.target.value)}
              />
            </label>
          );
          return (
            <details key={dia.n} className="c-vg-diario-dia">
              <summary className="c-vg-diario-resumo">
                Dia {dia.n} — {dia.d} ({dia.w})
              </summary>
              <div className="c-vg-diario-campos">
                <label className="c-vg-diario-campo">
                  <span>Onde estou</span>
                  <input
                    type="text"
                    className="c-input"
                    placeholder="Cidade"
                    value={d.onde}
                    onChange={(e) => anotar(dia.n, "onde", e.target.value)}
                  />
                </label>
                {escala("Inchaço 0-10", "inchaco")}
                {escala("Dor 0-10", "dor")}
                {escala("Azia/amargo 0-10", "azia")}
                <label className="c-vg-diario-campo">
                  <span>Evacuações (nº)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="c-input"
                    min={0}
                    value={d.evacuacoes}
                    onChange={(e) => anotar(dia.n, "evacuacoes", e.target.value)}
                  />
                </label>
                <label className="c-vg-diario-campo">
                  <span>Bristol</span>
                  <select className="c-select" value={d.bristol} onChange={(e) => anotar(dia.n, "bristol", e.target.value)}>
                    <option value="">-</option>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
                <label className="c-vg-diario-campo c-vg-diario-campo--full">
                  <span>O que comi de diferente, gatilhos, observações</span>
                  <textarea
                    className="c-textarea"
                    placeholder="Ex: comi meia porção de pasta al pomodoro no almoço, gelato de limão à tarde"
                    rows={2}
                    value={d.observacoes}
                    onChange={(e) => anotar(dia.n, "observacoes", e.target.value)}
                  />
                </label>
              </div>
            </details>
          );
        })}

        <h3 className="c-vg-sub" style={{ marginTop: 20 }}>Escala de Bristol</h3>
        <div className="c-vg-card">
          <p><strong>1-2</strong> = fezes duras e em bolinhas (prisão de ventre)</p>
          <p><strong>3-4</strong> = formadas e macias (ideal)</p>
          <p><strong>5</strong> = bolas moles</p>
          <p><strong>6</strong> = pastosas</p>
          <p><strong>7</strong> = líquidas (diarreia)</p>
        </div>

        <h3 className="c-vg-sub" style={{ marginTop: 16 }}>Modelo de mensagem para o check-in</h3>
        <div className="c-vg-msg-modelo">
          Dia __ | Inchaço __/10 | Dor __/10 | Azia ou amargo __/10 | Evacuações __ (Bristol __) | Comi de diferente: _____ | Algum sinal de alerta? sim / não
        </div>
        <button type="button" className="c-vg-copiar" onClick={copiarModelo}>
          {copiado ? "Copiado!" : "Copiar modelo"}
        </button>

        <div className="c-vg-alerta-amarelo" style={{ marginTop: 16 }}>
          Se houver sinal de alerta, <strong>não espere resposta por mensagem</strong>: procure atendimento, conforme a seção anterior.
        </div>
      </section>

      {/* DEPOIS DA VIAGEM */}
      <section className="c-vg-secao">
        <h2 className="c-vg-secao-titulo">Depois da viagem</h2>
        <div className="c-vg-refeicoes">
          <div className="c-vg-refeicao"><span className="c-vg-refeicao-label">Ao voltar (27/11)</span><span>Envie o último check-in e as fotos do diário. Vamos marcar a consulta de retorno para avaliar sintomas, fezes e o que funcionou ou não na viagem.</span></div>
          <div className="c-vg-refeicao"><span className="c-vg-refeicao-label">A partir de 26/11</span><span>A sua médica decide o início do antibiótico para a SIBO. O plano alimentar se ajusta ao que ela decidir.</span></div>
          <div className="c-vg-refeicao"><span className="c-vg-refeicao-label">Controle H. pylori</span><span>Cerca de 4 semanas depois do fim do antibiótico (a partir de, aproximadamente, 04/12), conforme a sua médica. Pergunte a ela se precisa pausar o omeprazol antes do exame e com que preparo.</span></div>
          <div className="c-vg-refeicao"><span className="c-vg-refeicao-label">Alimentação</span><span>Depois que os sintomas estiverem mais estáveis, reintroduzimos os grupos de alimentos aos poucos, um de cada vez, para descobrir o que você tolera. A restrição de agora é temporária.</span></div>
        </div>
        <div className="c-vg-dica" style={{ marginTop: 16 }}>
          <p>Você não precisa fazer tudo perfeito. Um dia ruim não estraga a viagem nem o tratamento. O combinado é: enzima antes de cada refeição, alternar pesado e leve, água e chá. O resto é aproveitar cada destino.</p>
          <p style={{ marginTop: 8, fontStyle: "italic" }}>Comida não é vilã.</p>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer className="c-vg-rodape">
        Isabela Marçal · Nutricionista · CRN-9 37597<br />
        @belamarcall · (31) 99450-3318<br /><br />
        Material individual, feito com base no seu quadro atual e no seu cardápio.<br />
        Não substitui orientação médica.<br />
        Em caso de sinais de alerta, procure atendimento. Não espere resposta por mensagem.
      </footer>
      </div>
    </>
  );
}
