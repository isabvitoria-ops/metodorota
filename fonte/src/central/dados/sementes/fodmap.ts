/**
 * Catálogo FODMAP — alimentos comuns na alimentação brasileira.
 *
 * Fontes: Monash University FODMAP App (referência-padrão mundial) adaptado
 * para alimentos do dia a dia brasileiro. Porções em gramas ou medida caseira.
 *
 * COMO ACRESCENTAR UM ALIMENTO
 * ----------------------------
 * Some uma linha à categoria. O formato é:
 *   [id, nome, porçãoSegura, porçãoModerada, nível, [grupos], dica?]
 *
 * Exemplo:
 *   ["kiwi", "Kiwi", "150 g (2 unid.)", null, "verde", [], null],
 */
import type { AlimentoFodmap, CategoriaFodmap, GrupoFodmap, NivelFodmap } from "@/central/types/fodmap";

type Linha = [
  id: string,
  nome: string,
  porcaoSegura: string | null,
  porcaoModerada: string | null,
  nivel: NivelFodmap,
  grupos: GrupoFodmap[],
  dica?: string | null,
];

function montar(linhas: Linha[], categoria: CategoriaFodmap): AlimentoFodmap[] {
  return linhas.map(([id, nome, porcaoSegura, porcaoModerada, nivel, grupos, dica]) => ({
    id,
    nome,
    categoria,
    porcaoSegura,
    porcaoModerada,
    nivel,
    grupos,
    dica: dica ?? null,
  }));
}

const FRUTAS: Linha[] = [
  ["banana-verde", "Banana (verde/madura firme)", "100 g (1 unid.)", null, "verde", [], null],
  ["banana-madura", "Banana (muito madura)", null, "100 g (1 unid.)", "amarelo", ["frutanos"], "Quanto mais madura, mais frutanos."],
  ["morango", "Morango", "140 g (10 unid.)", null, "verde", [], null],
  ["uva", "Uva", "150 g (1 cacho peq.)", null, "verde", [], null],
  ["laranja", "Laranja", "130 g (1 unid.)", null, "verde", [], null],
  ["kiwi", "Kiwi", "150 g (2 unid.)", null, "verde", [], null],
  ["abacaxi", "Abacaxi", "140 g (1 fatia)", null, "verde", [], null],
  ["mamao", "Mamão papaia", "140 g (1 fatia)", null, "verde", [], null],
  ["mirtilo", "Mirtilo", "40 g (¼ xíc.)", null, "verde", [], null],
  ["framboesa", "Framboesa", "60 g (½ xíc.)", null, "verde", [], null],
  ["melao", "Melão", "120 g (1 fatia)", null, "verde", [], null],
  ["maracuja", "Maracujá (polpa)", "2 col. sopa", null, "verde", [], null],
  ["limao", "Limão", "Livre", null, "verde", [], null],
  ["tangerina", "Tangerina/mexerica", "1 unidade", null, "verde", [], null],
  ["manga", "Manga", null, "40 g (2 fatias)", "amarelo", ["frutose"], "Porção pequena é tolerada."],
  ["melancia", "Melancia", null, "80 g (1 fatia fina)", "amarelo", ["frutose", "manitol"], "Porção grande é alto FODMAP."],
  ["maca", "Maçã", null, null, "vermelho", ["frutose", "sorbitol"], null],
  ["pera", "Pera", null, null, "vermelho", ["frutose", "sorbitol"], null],
  ["cereja", "Cereja", null, null, "vermelho", ["frutose", "sorbitol"], null],
  ["ameixa", "Ameixa", null, null, "vermelho", ["sorbitol"], null],
  ["pessego", "Pêssego", null, null, "vermelho", ["sorbitol"], null],
  ["caqui", "Caqui", null, null, "vermelho", ["frutose", "sorbitol"], null],
  ["abacate", "Abacate", "30 g (2 col. sopa)", "50 g", "verde", ["sorbitol"], "Porção grande é alto FODMAP."],
  ["goiaba", "Goiaba", null, null, "vermelho", ["frutose"], null],
  ["acerola", "Acerola", "50 g (5 unid.)", null, "verde", [], null],
];

const VERDURAS_LEGUMES: Linha[] = [
  ["alface", "Alface", "Livre", null, "verde", [], null],
  ["rucula", "Rúcula", "Livre", null, "verde", [], null],
  ["espinafre", "Espinafre", "Livre", null, "verde", [], null],
  ["pepino", "Pepino", "Livre", null, "verde", [], null],
  ["tomate", "Tomate", "1 unid. pequena", null, "verde", [], null],
  ["cenoura", "Cenoura", "Livre", null, "verde", [], null],
  ["abobrinha", "Abobrinha", "65 g (½ xíc.)", null, "verde", [], null],
  ["berinjela", "Berinjela", "70 g (½ xíc.)", null, "verde", [], null],
  ["pimentao", "Pimentão", "Livre", null, "verde", [], null],
  ["vagem", "Vagem", "75 g (½ xíc.)", null, "verde", [], null],
  ["batata", "Batata inglesa", "Livre", null, "verde", [], null],
  ["batata-doce", "Batata-doce", "75 g (½ xíc.)", "100 g", "verde", ["manitol"], "Porção grande pode ser moderada."],
  ["inhame", "Inhame/cará", "75 g (½ xíc.)", null, "verde", [], null],
  ["mandioca", "Mandioca/aipim", "75 g (½ xíc.)", null, "verde", [], null],
  ["chuchu", "Chuchu", "Livre", null, "verde", [], null],
  ["brocolis", "Brócolis (cabeça)", "75 g (½ xíc.)", null, "verde", [], "Prefira o topo, sem talo."],
  ["brocolis-talo", "Brócolis (talo)", null, null, "vermelho", ["frutanos", "gos"], null],
  ["couve-flor", "Couve-flor", null, "70 g (½ xíc.)", "amarelo", ["manitol"], null],
  ["repolho", "Repolho", "75 g (½ xíc.)", "120 g", "verde", ["frutanos"], "Porção grande pode incomodar."],
  ["couve", "Couve-manteiga", "Livre", null, "verde", [], null],
  ["cebola", "Cebola", null, null, "vermelho", ["frutanos"], "Uma das maiores fontes de frutanos."],
  ["alho", "Alho", null, null, "vermelho", ["frutanos"], "Use óleo com alho: o FODMAP não passa para o óleo."],
  ["alho-poro", "Alho-poró (parte branca)", null, null, "vermelho", ["frutanos"], "A parte verde escura é tolerada."],
  ["aspargo", "Aspargo", null, null, "vermelho", ["frutanos"], null],
  ["beterraba", "Beterraba", null, "20 g (2 fatias)", "amarelo", ["frutanos", "gos"], null],
  ["quiabo", "Quiabo", "Livre", null, "verde", [], null],
  ["milho", "Milho verde", "½ espiga", "1 espiga", "verde", ["sorbitol"], null],
  ["ervilha", "Ervilha", null, "25 g (2 col. sopa)", "amarelo", ["gos", "frutanos"], null],
  ["cogumelo", "Cogumelo/champignon", null, null, "vermelho", ["manitol"], null],
  ["abobora", "Abóbora", "Livre", null, "verde", [], null],
];

const GRAOS_CEREAIS: Linha[] = [
  ["arroz-branco", "Arroz branco", "Livre", null, "verde", [], null],
  ["arroz-integral", "Arroz integral", "Livre", null, "verde", [], null],
  ["quinoa", "Quinoa", "155 g (1 xíc.)", null, "verde", [], null],
  ["aveia", "Aveia", "52 g (½ xíc.)", null, "verde", [], null],
  ["milho-farinha", "Farinha de milho/fubá", "Livre", null, "verde", [], null],
  ["tapioca", "Tapioca/polvilho", "Livre", null, "verde", [], null],
  ["pao-sem-gluten", "Pão sem glúten", "2 fatias", null, "verde", [], "Verifique os ingredientes."],
  ["macarrao-sem-gluten", "Macarrão sem glúten (arroz/milho)", "145 g (1 xíc.)", null, "verde", [], null],
  ["trigo-pao", "Pão de trigo", null, "1 fatia", "amarelo", ["frutanos"], null],
  ["trigo-macarrao", "Macarrão de trigo", null, "½ xíc. cozido", "amarelo", ["frutanos"], "Porção grande é vermelho."],
  ["centeio", "Pão de centeio", null, null, "vermelho", ["frutanos", "gos"], null],
  ["cevada", "Cevada", null, null, "vermelho", ["frutanos", "gos"], null],
  ["trigo-farinha", "Farinha de trigo (porção grande)", null, null, "vermelho", ["frutanos"], null],
  ["pipoca", "Pipoca", "Livre", null, "verde", [], "Sem temperos industrializados."],
  ["granola-sem-mel", "Granola sem mel/frutose", "¼ xíc.", null, "verde", [], "Verifique os ingredientes."],
];

const LATICINIOS: Linha[] = [
  ["leite-sem-lactose", "Leite sem lactose", "250 ml (1 copo)", null, "verde", [], null],
  ["iogurte-sem-lactose", "Iogurte sem lactose", "170 g (1 pote)", null, "verde", [], null],
  ["queijo-parmesao", "Queijo parmesão", "40 g (2 col. sopa)", null, "verde", [], "Maturado: quase sem lactose."],
  ["queijo-brie", "Queijo brie/camembert", "40 g", null, "verde", [], "Maturado: quase sem lactose."],
  ["queijo-cheddar", "Queijo cheddar", "40 g", null, "verde", [], null],
  ["queijo-mucarela", "Muçarela", "40 g", null, "verde", ["lactose"], "Pequena quantidade é tolerada."],
  ["manteiga", "Manteiga", "Livre", null, "verde", [], "Gordura pura, sem lactose."],
  ["leite-vaca", "Leite de vaca", null, null, "vermelho", ["lactose"], null],
  ["iogurte-comum", "Iogurte comum", null, null, "vermelho", ["lactose"], null],
  ["queijo-cottage", "Queijo cottage/ricota", null, "40 g (2 col. sopa)", "amarelo", ["lactose"], null],
  ["sorvete", "Sorvete de leite", null, null, "vermelho", ["lactose"], null],
  ["creme-de-leite", "Creme de leite", null, null, "vermelho", ["lactose"], null],
  ["leite-coco", "Leite de coco (bebida)", "120 ml (½ copo)", null, "verde", [], null],
  ["leite-amendoa", "Leite de amêndoa", "240 ml (1 copo)", null, "verde", [], "Sem inulina/chicória."],
  ["leite-arroz", "Leite de arroz", "200 ml", null, "verde", [], null],
];

const PROTEINAS: Linha[] = [
  ["frango", "Frango", "Livre", null, "verde", [], null],
  ["peixe", "Peixe", "Livre", null, "verde", [], null],
  ["carne-bovina", "Carne bovina", "Livre", null, "verde", [], null],
  ["carne-suina", "Carne suína", "Livre", null, "verde", [], null],
  ["ovos", "Ovos", "Livre", null, "verde", [], null],
  ["tofu-firme", "Tofu firme", "160 g", null, "verde", [], "Tofu silken pode ter mais GOS."],
  ["tempeh", "Tempeh", "100 g", null, "verde", [], null],
  ["presunto", "Presunto/peito de peru", "Livre", null, "verde", [], "Sem mel ou alho nos ingredientes."],
  ["atum-enlatado", "Atum enlatado", "Livre", null, "verde", [], null],
  ["sardinha", "Sardinha", "Livre", null, "verde", [], null],
  ["linguica", "Linguiça (verificar ingredientes)", null, "1 unid.", "amarelo", ["frutanos"], "Muitas levam alho e cebola."],
  ["salsicha", "Salsicha", null, null, "vermelho", ["frutanos"], "Geralmente contém alho e cebola."],
];

const OLEAGINOSAS: Linha[] = [
  ["amendoim", "Amendoim", "28 g (2 col. sopa)", null, "verde", [], null],
  ["nozes", "Nozes", "30 g (10 metades)", null, "verde", [], null],
  ["macadamia", "Macadâmia", "20 unid.", null, "verde", [], null],
  ["semente-girassol", "Semente de girassol", "2 col. sopa", null, "verde", [], null],
  ["semente-abobora", "Semente de abóbora", "2 col. sopa", null, "verde", [], null],
  ["chia", "Chia", "2 col. sopa", null, "verde", [], null],
  ["linhaca", "Linhaça", "1 col. sopa", null, "verde", [], null],
  ["castanha-para", "Castanha-do-Pará", "10 g (3 unid.)", null, "verde", [], null],
  ["castanha-caju", "Castanha de caju", null, "10 g (5 unid.)", "amarelo", ["gos"], "Porção grande é vermelho."],
  ["pistache", "Pistache", null, null, "vermelho", ["frutanos", "gos"], null],
  ["amendoa", "Amêndoa", null, "12 g (10 unid.)", "amarelo", ["gos"], "Porção grande é vermelho."],
];

const CONDIMENTOS: Linha[] = [
  ["azeite", "Azeite de oliva", "Livre", null, "verde", [], null],
  ["oleo-coco", "Óleo de coco", "Livre", null, "verde", [], null],
  ["vinagre", "Vinagre", "2 col. sopa", null, "verde", [], null],
  ["mostarda", "Mostarda", "1 col. sopa", null, "verde", [], null],
  ["sal", "Sal", "Livre", null, "verde", [], null],
  ["acucar", "Açúcar refinado", "Livre", null, "verde", [], null],
  ["rapadura", "Rapadura/açúcar mascavo", "1 col. chá", null, "verde", [], null],
  ["gengibre", "Gengibre", "Livre", null, "verde", [], null],
  ["cebolinha", "Cebolinha (verde)", "Livre", null, "verde", [], "Só a parte verde."],
  ["manjericao", "Manjericão", "Livre", null, "verde", [], null],
  ["oregano", "Orégano", "Livre", null, "verde", [], null],
  ["curcuma", "Cúrcuma", "1 col. chá", null, "verde", [], null],
  ["shoyu", "Molho de soja/shoyu", "2 col. sopa", null, "verde", [], "Versão sem trigo é mais segura."],
  ["mel", "Mel", null, null, "vermelho", ["frutose"], null],
  ["xarope-milho", "Xarope de milho (frutose)", null, null, "vermelho", ["frutose"], null],
  ["molho-tomate-ind", "Molho de tomate industrializado", null, "2 col. sopa", "amarelo", ["frutanos"], "Geralmente contém cebola e alho."],
  ["ketchup", "Ketchup", null, "1 sachê", "amarelo", ["frutose", "frutanos"], null],
];

const BEBIDAS: Linha[] = [
  ["agua", "Água", "Livre", null, "verde", [], null],
  ["cafe", "Café (sem leite)", "1 xíc.", null, "verde", [], null],
  ["cha-verde", "Chá verde", "1 xíc.", null, "verde", [], null],
  ["cha-hortelan", "Chá de hortelã", "1 xíc.", null, "verde", [], null],
  ["cha-gengibre", "Chá de gengibre", "1 xíc.", null, "verde", [], null],
  ["suco-laranja", "Suco de laranja (natural)", "125 ml (½ copo)", null, "verde", [], null],
  ["agua-coco", "Água de coco", "180 ml (1 copo peq.)", "250 ml", "verde", ["sorbitol"], "Porção grande pode ser moderada."],
  ["cha-camomila", "Chá de camomila", null, "1 xíc. fraca", "amarelo", ["frutanos"], "Chá forte é alto FODMAP."],
  ["cha-erva-doce", "Chá de erva-doce/funcho", null, null, "vermelho", ["frutanos"], null],
  ["suco-maca", "Suco de maçã", null, null, "vermelho", ["frutose", "sorbitol"], null],
  ["suco-manga", "Suco de manga", null, null, "vermelho", ["frutose"], null],
  ["cerveja", "Cerveja (regular)", "1 lata (375 ml)", null, "verde", [], "Sem glúten é mais segura para celíacos."],
  ["vinho", "Vinho (tinto/branco)", "1 taça (150 ml)", null, "verde", [], null],
  ["refrigerante", "Refrigerante (com frutose)", null, null, "vermelho", ["frutose"], "Versão com açúcar comum é tolerada."],
];

// ── Feijões e leguminosas (na categoria verduras_legumes por serem guarnição) ──

const LEGUMINOSAS: Linha[] = [
  ["feijao-preto", "Feijão preto", null, "40 g (3 col. sopa)", "amarelo", ["gos", "frutanos"], "Porção pequena é melhor tolerada."],
  ["feijao-carioca", "Feijão carioca", null, "40 g (3 col. sopa)", "amarelo", ["gos", "frutanos"], "Deixar de molho 12h e trocar a água reduz."],
  ["lentilha", "Lentilha", null, "23 g (2 col. sopa)", "amarelo", ["gos", "frutanos"], null],
  ["grao-de-bico", "Grão-de-bico", null, "42 g (¼ xíc.)", "amarelo", ["gos", "frutanos"], "Enlatado e bem enxaguado é melhor."],
  ["soja", "Soja/edamame", null, null, "vermelho", ["gos", "frutanos"], null],
];

export const CATALOGO_FODMAP: AlimentoFodmap[] = [
  ...montar(FRUTAS, "frutas"),
  ...montar(VERDURAS_LEGUMES, "verduras_legumes"),
  ...montar(LEGUMINOSAS, "verduras_legumes"),
  ...montar(GRAOS_CEREAIS, "graos_cereais"),
  ...montar(LATICINIOS, "laticinios"),
  ...montar(PROTEINAS, "proteinas"),
  ...montar(OLEAGINOSAS, "oleaginosas"),
  ...montar(CONDIMENTOS, "condimentos"),
  ...montar(BEBIDAS, "bebidas"),
];
