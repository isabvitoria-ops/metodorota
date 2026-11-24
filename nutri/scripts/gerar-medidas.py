#!/usr/bin/env python3
"""
Medidas caseiras (unidade, fatia) com peso de fonte oficial.

    python3 scripts/gerar-medidas.py WEIGHT.txt FOOD_DES.txt > dados/medidas.json

WEIGHT.txt e FOOD_DES.txt são os arquivos da USDA National Nutrient Database
for Standard Reference, Release 28 (SR28), USDA/ARS — domínio público, a
mesma base de onde vêm os alimentos USDA desta ferramenta. `WEIGHT.txt` é a
tabela oficial de porções: "1 fruit (2" dia) = 69 g" para o kiwi.

DUAS REGRAS, e nenhum número de cabeça:

1. Alimento USDA recebe as porções do próprio código, com o nome em inglês
   como veio — como o nome do alimento, que também não é traduzido.

2. Alimento da TACO ou do IBGE só recebe peso do USDA quando é O MESMO
   alimento, e para fruta, a MESMA VARIEDADE: pêra Williams é a Bartlett
   americana; limão tahiti é a Persian lime; banana nanica é Cavendish.
   Onde a variedade brasileira é outra — banana-prata, laranja-pera,
   goiaba, maracujá amarelo, abacate, tangerina poncã — NÃO entra peso
   americano: uma banana-prata não pesa o que pesa uma Cavendish, e um
   número errado com cara de oficial é pior que número nenhum.

3. Por cima de tudo, a planilha dela (`dados/medidas_caseiras_lote*.xlsx`):
   medidas brasileiras com a fonte de cada uma (Tucunduva, TACO, TBCA).
   Onde ela tem medida, substitui a do USDA para aquele alimento.

Cada medida leva `ref`, o código SR28 e a porção original, para conferir
em https://fdc.nal.usda.gov (Data Type: SR Legacy, buscar pelo código).
"""
import json
import sys

PESOS, NOMES = sys.argv[1], sys.argv[2]

nomes = {}
for linha in open(NOMES, encoding="latin-1"):
    f = linha.split("^")
    nomes[f[0].strip("~")] = f[2].strip("~")

porcoes = {}
for linha in open(PESOS, encoding="latin-1"):
    f = linha.rstrip("\r\n").split("^")
    porcoes.setdefault(f[0].strip("~"), []).append(
        {"qtd": float(f[2]), "desc": f[3].strip("~"), "g": float(f[4])}
    )


def porcao(ndb, desc):
    """A porção exata, pelo texto do USDA. Não achou, o gerador PARA."""
    for p in porcoes[ndb]:
        if p["desc"] == desc:
            return p
    raise SystemExit(f"porção '{desc}' não existe em {ndb} {nomes[ndb]}")


def usda(ndb, *pares):
    """[(nome em português, porção do USDA)] → medidas com referência."""
    saida = []
    for nome, desc in pares:
        p = porcao(ndb, desc)
        gramas = round(p["g"] / p["qtd"], 2)
        qtd = "" if p["qtd"] == 1 else f"{p['qtd']:g} × "
        saida.append({
            "n": nome,
            "g": gramas,
            "ref": f"USDA SR28 {ndb} · {nomes[ndb]} · {qtd}{desc} = {p['g']:g} g",
        })
    return saida


TAMANHOS = lambda ndb, p, m, g: usda(  # noqa: E731
    ndb, ("unidade pequena", p), ("unidade média", m), ("unidade grande", g)
)

KIWI = usda("09148", ("unidade", 'fruit (2" dia)'))
BANANA_NANICA = TAMANHOS(
    "09040", 'small (6" to 6-7/8" long)', 'medium (7" to 7-7/8" long)', 'large (8" to 8-7/8" long)'
)
OVO_CRU = TAMANHOS("01123", "small", "medium", "large")
OVO_COZIDO = usda("01129", ("unidade grande", "large"))
OVO_FRITO = usda("01128", ("unidade grande", "large"))
CLARA = usda("01124", ("unidade grande", "large"))
GEMA = usda("01125", ("unidade grande", "large"))
CODORNA = usda("01140", ("unidade", "egg"))
MORANGO = TAMANHOS("09316", 'small (1" dia)', 'medium (1-1/4" dia)', 'large (1-3/8" dia)')
UVA = usda("09132", ("unidade", "grapes"))
AMEIXA = usda("09279", ("unidade", 'fruit (2-1/8" dia)'))
PESSEGO = TAMANHOS("09236", 'small (2-1/2" dia)', 'medium (2-2/3" dia)', 'large (2-3/4" dia)')
NECTARINA = TAMANHOS("09191", 'small (2-1/3" dia)', 'medium (2-1/2" dia)', 'large (2-3/4" dia)')
FIGO = TAMANHOS("09089", 'small (1-1/2" dia)', 'medium (2-1/4" dia)', 'large (2-1/2" dia)')
CAQUI = usda("09263", ("unidade", 'fruit (2-1/2" dia)'))
LARANJA_BAIA = usda("09202", ("unidade", 'fruit (2-7/8" dia)'))
LARANJA_VALENCIA = usda("09201", ("unidade", 'fruit (2-5/8" dia)'))
MACA_FUJI = TAMANHOS("09504", "small", "medium", "large")
PERA_WILLIAMS = TAMANHOS("09412", "small", "medium", "large")
MANGA = usda("09176", ("unidade", "fruit without refuse"))
PAPAIA = usda("09226", ("unidade pequena", "fruit, small"))
LIMAO_TAHITI = usda("09159", ("unidade", 'fruit (2" dia)'))
ACEROLA = usda("09001", ("unidade", "fruit without refuse"))
TOMATE = TAMANHOS(
    "11529", 'small whole (2-2/5" dia)', 'medium whole (2-3/5" dia)', 'large whole (3" dia)'
) + usda("11529", ("fatia média", 'slice, medium (1/4" thick)'))
CENOURA_CRUA = TAMANHOS("11124", 'small (5-1/2" long)', "medium", 'large (7-1/4" to 8-/1/2" long)')
CENOURA_COZIDA = usda("11125", ("unidade", "carrot"))
CASTANHA_PARA = usda("12078", ("unidade", "kernel"))
AMENDOA = usda("12061", ("unidade", "almond"))
NOZ = usda("12155", ("metade", "oz (14 halves)"))
# "oz (14 halves)" = 28,35 g para 14 metades: a metade sai da divisão,
# que é conta, não estimativa. O gerador precisa dividir pela contagem.
NOZ[0]["g"] = round(28.35 / 14, 2)
NOZ[0]["ref"] += " → 1 metade = 28,35 ÷ 14"
PAO_FORMA = usda("18069", ("fatia fina", "slice, thin"), ("fatia grande", "slice, large"))
PAO_FORMA_INTEGRAL = usda("18075", ("fatia", "slice"))
PAO_AVEIA = usda("18039", ("fatia", "slice"))

# TACO: pelo nome exato. Nome que não existir para o gerador.
TACO = {
    "Kiwi, cru": KIWI,
    "Banana, nanica, crua": BANANA_NANICA,
    "Ovo, de galinha, inteiro, cru": OVO_CRU,
    "Ovo, de galinha, inteiro, cozido/10minutos": OVO_COZIDO,
    "Ovo, de galinha, inteiro, frito": OVO_FRITO,
    "Ovo, de galinha, clara, cozida/10minutos": CLARA,
    "Ovo, de galinha, gema, cozida/10minutos": GEMA,
    "Ovo, de codorna, inteiro, cru": CODORNA,
    "Morango, cru": MORANGO,
    "Uva, Itália, crua": UVA,
    "Uva, Rubi, crua": UVA,
    "Ameixa, crua": AMEIXA,
    "Pêssego, Aurora, cru": PESSEGO,
    "Figo, cru": FIGO,
    "Caqui, chocolate, cru": CAQUI,
    "Laranja, baía, crua": LARANJA_BAIA,
    "Laranja, valência, crua": LARANJA_VALENCIA,
    "Maçã, Fuji, com casca, crua": MACA_FUJI,
    "Pêra, Williams, crua": PERA_WILLIAMS,
    "Manga, Tommy Atkins, crua": MANGA,
    "Manga, Haden, crua": MANGA,
    "Mamão, Papaia, cru": PAPAIA,
    "Limão, tahiti, cru": LIMAO_TAHITI,
    "Acerola, crua": ACEROLA,
    "Tomate, com semente, cru": TOMATE,
    "Cenoura, crua": CENOURA_CRUA,
    "Cenoura, cozida": CENOURA_COZIDA,
    "Castanha-do-Brasil, crua": CASTANHA_PARA,
    "Amêndoa, torrada, salgada": AMENDOA,
    "Noz, crua": NOZ,
    "Pão, trigo, forma, integral": PAO_FORMA_INTEGRAL,
    "Pão, aveia, forma": PAO_AVEIA,
}

# IBGE: (nome exato, preparos). O preparo importa: ovo frito não pesa o
# que pesa o cru, e cenoura cozida é outra porção.
CRU = {"1", "99"}
IBGE = [
    ("Kiwi", CRU, KIWI),
    ("Ovo de galinha", CRU, OVO_CRU),
    ("Ovo de galinha", {"2"}, OVO_COZIDO),
    ("Ovo de galinha", {"5"}, OVO_FRITO),
    ("Ovo de codorna", {"1", "2", "99"}, CODORNA),
    ("Morango", CRU, MORANGO),
    ("Uva", CRU, UVA),
    ("Ameixa", CRU, AMEIXA),
    ("Pêssego", CRU, PESSEGO),
    ("Nectarina", CRU, NECTARINA),
    ("Figo", CRU, FIGO),
    ("Caqui", CRU, CAQUI),
    ("Acerola", CRU, ACEROLA),
    ("Tomate", CRU, TOMATE),
    ("Cenoura", CRU, CENOURA_CRUA),
    ("Cenoura", {"2"}, CENOURA_COZIDA),
    ("Castanha-do-pará", CRU, CASTANHA_PARA),
    ("Amêndoa", CRU, AMENDOA),
    ("Noz (nogueira)", CRU, NOZ),
    ("Pão de forma industrializado de qualquer marca", CRU, PAO_FORMA),
]

# ---------------------------------------------------------------------------
# A planilha dela: `dados/medidas_caseiras_lote*.xlsx`
# ---------------------------------------------------------------------------
#
# Medidas brasileiras (Tucunduva, TACO, TBCA, USDA — a coluna "Fonte" diz
# qual), conferidas por ela. ONDE A PLANILHA TEM MEDIDA, ELA SUBSTITUI a do
# USDA para aquele alimento: é fonte brasileira, escolhida por quem
# prescreve, e duas "unidades" de pesos diferentes no mesmo seletor seriam
# um convite ao erro.
#
# Cada nome da planilha aponta para os alimentos das tabelas que ele cobre.
# Nome sem destino aqui PARA o gerador — um lote novo não entra calado.
PLANILHA = {
    "Banana": {"taco": ["Banana, prata, crua"], "ibge": [("Banana (ouro, prata, d´água, da terra, etc.)", CRU)]},
    "Pão francês": {"taco": ["Pão, trigo, francês"], "ibge": [("Pão de sal", CRU)]},
    "Pão de forma, tradicional": {"ibge": [("Pão de forma industrializado de qualquer marca", CRU)]},
    "Maçã fuji": {"taco": ["Maçã, Fuji, com casca, crua"]},
    "Mamão papaia": {"taco": ["Mamão, Papaia, cru"]},
    "Ovo de galinha": {
        "taco": [
            "Ovo, de galinha, inteiro, cru",
            "Ovo, de galinha, inteiro, cozido/10minutos",
            "Ovo, de galinha, inteiro, frito",
        ],
        "ibge": [("Ovo de galinha", {"1", "2", "5", "99"})],
    },
    "Queijo minas frescal": {
        "taco": ["Queijo, minas, frescal"],
        "ibge": [("Queijo de minas frescal orgânico", CRU)],
    },
    # A TBCA mora no navegador dela (licença não permite publicar); o id é
    # o código da TBCA, o mesmo que a importação usa.
    "Tapioca": {"importada": ["BRC0906B"]},
    "Iogurte natural": {
        "taco": ["Iogurte, natural", "Iogurte, natural, desnatado"],
        "ibge": [("Iogurte natural", CRU)],
    },
    "Castanha do Pará sem sal": {
        "taco": ["Castanha-do-Brasil, crua"],
        "ibge": [("Castanha-do-pará", CRU)],
    },
    "Azeite de oliva": {"taco": ["Azeite, de oliva, extra virgem"], "ibge": [("Azeite de oliva", CRU)]},
    "Peito de frango, sem pele, grelhado": {
        "taco": ["Frango, peito, sem pele, grelhado"],
        "ibge": [("Peito de galinha ou frango", {"3"})],
    },
    "Requeijão": {"taco": ["Queijo, requeijão, cremoso"], "ibge": [("Requeijão", CRU)]},
}


# Lote 2: a auditoria de medidas de 23/11/2026 (IBGE POF 2008-09 e UFG,
# conferidas contra o DietSystem). Medida de alimento COZIDO só vai para
# alimento cozido: o erro mais grave que a auditoria achou no DietSystem foi
# medida do cozido em alimento cru. O que a auditoria marcou como dúvida, ou
# que contradiz o lote 1, ficou de fora até ela decidir.
PLANILHA.update({
    "Abacate": {"taco": ["Abacate, cru"], "ibge": [("Abacate", {"99"})]},
    "Abacaxi": {"taco": ["Abacaxi, cru"], "ibge": [("Abacaxi", {"99"})]},
    "Abobrinha, cozida": {"taco": ["Abobrinha, italiana, cozida", "Abobrinha, italiana, refogada"], "ibge": [("Abobrinha", {"2", "7"})]},
    "Abóbora, cozida": {"taco": ["Abóbora, cabotian, cozida", "Abóbora, moranga, refogada"], "ibge": [("Abóbora", {"2", "7"})]},
    "Alface": {"taco": ["Alface, americana, crua", "Alface, crespa, crua", "Alface, lisa, crua", "Alface, roxa, crua"], "ibge": [("Alface", {"99"})]},
    "Ameixa": {"taco": ["Ameixa, crua"], "ibge": [("Ameixa", {"99"})]},
    "Arroz branco, cozido": {"taco": ["Arroz, tipo 1, cozido", "Arroz, tipo 2, cozido"], "ibge": [("Arroz (polido, parboilizado, agulha, agulhinha, etc.)", {"99"})]},
    "Arroz integral, cozido": {"taco": ["Arroz, integral, cozido"], "ibge": [("Arroz integral", {"99"})]},
    "Atum em conserva": {"taco": ["Atum, conserva em óleo"], "ibge": [("Atum em conserva", {"99"})]},
    "Aveia em flocos": {"taco": ["Aveia, flocos, crua"], "ibge": [("Aveia em flocos", {"99"})]},
    "Açúcar": {"taco": ["Açúcar, refinado", "Açúcar, cristal"], "ibge": [("Açúcar", {"99"})]},
    "Banana nanica": {"taco": ["Banana, nanica, crua"]},
    "Batata doce, cozida": {"taco": ["Batata, doce, cozida"], "ibge": [("Batata-doce", {"2"})]},
    "Batata inglesa, cozida": {"taco": ["Batata, inglesa, cozida"], "ibge": [("Batata-inglesa", {"2"})]},
    "Beterraba, cozida": {"taco": ["Beterraba, cozida"], "ibge": [("Beterraba", {"2"})]},
    "Biscoito cream cracker": {"taco": ["Biscoito, salgado, cream cracker"]},
    "Brócolis, cozido": {"taco": ["Brócolis, cozido"], "ibge": [("Brócolis", {"2"})]},
    "Café, infusão": {"taco": ["Café, infusão 10%"], "ibge": [("Café", {"99"})]},
    "Camarão, cozido": {"taco": ["Camarão, Rio Grande, grande, cozido"], "ibge": [("Camarão", {"2"})]},
    "Carne moída": {"ibge": [("Carne moída", {"2", "7"})]},
    "Castanha de caju": {"taco": ["Castanha-de-caju, torrada, salgada"], "ibge": [("Castanha de caju", {"99"})]},
    "Cenoura": {"taco": ["Cenoura, crua"], "ibge": [("Cenoura", CRU)]},
    "Cenoura, cozida": {"taco": ["Cenoura, cozida"], "ibge": [("Cenoura", {"2"})]},
    "Chuchu, cozido": {"taco": ["Chuchu, cozido"], "ibge": [("Chuchu", {"2"})]},
    "Clara de ovo": {"taco": ["Ovo, de galinha, clara, cozida/10minutos"]},
    "Couve, refogada/cozida": {"taco": ["Couve, manteiga, refogada"], "ibge": [("Couve", {"2", "7"})]},
    "Coxa de frango": {"taco": ["Frango, coxa, com pele, assada", "Frango, coxa, sem pele, cozida"]},
    "Creme de leite": {"taco": ["Creme de Leite"], "ibge": [("Creme de leite", {"99"})]},
    "Cuscuz de milho": {"taco": ["Cuscuz, de milho, cozido com sal"], "ibge": [("Cuscuz", {"99"})]},
    "Espinafre, cozido": {"taco": ["Espinafre, Nova Zelândia, refogado"], "ibge": [("Espinafre", {"2", "7"})]},
    "Estrogonofe de carne": {"taco": ["Estrogonofe de carne"]},
    "Farinha de aveia": {"ibge": [("Farinha de aveia", {"99"})]},
    "Feijoada": {"ibge": [("Feijoada", {"99"})]},
    "Feijão carioca, cozido": {"taco": ["Feijão, carioca, cozido", "Feijão, preto, cozido"], "ibge": [("Feijão (preto, mulatinho, roxo, rosinha, etc.)", {"99"})]},
    "Filé de peixe (merluza)": {"taco": ["Merluza, filé, assado", "Merluza, filé, frito"]},
    "Fígado bovino": {"taco": ["Carne, bovina, fígado, grelhado"], "ibge": [("Fígado bovino", {"3", "5"})]},
    "Goiaba": {"taco": ["Goiaba, branca, com casca, crua", "Goiaba, vermelha, com casca, crua"], "ibge": [("Goiaba", {"99"})]},
    "Granola": {"ibge": [("Granola", {"99"})]},
    "Grão de bico, cozido": {"ibge": [("Grão de bico", {"99"})]},
    "Kiwi": {"taco": ["Kiwi, cru"], "ibge": [("Kiwi", {"99"})]},
    "Laranja": {"taco": ["Laranja, baía, crua", "Laranja, da terra, crua", "Laranja, lima, crua", "Laranja, pêra, crua", "Laranja, valência, crua"], "ibge": [("Laranja (pera, seleta, lima, da terra, etc.)", {"99"})]},
    "Leite (integral/desnatado)": {"taco": ["Leite, de vaca, integral", "Leite, de vaca, desnatado, UHT"], "ibge": [("Leite de vaca integral", {"99"}), ("Leite de vaca desnatado", {"99"}), ("Leite de vaca semidesnatado", {"99"})]},
    "Leite integral": {"taco": ["Leite, de vaca, integral"], "ibge": [("Leite de vaca integral", {"99"})]},
    "Lentilha, cozida": {"taco": ["Lentilha, cozida"], "ibge": [("Lentilha", {"99"})]},
    "Lombo de porco": {"taco": ["Porco, lombo, assado"], "ibge": [("Lombo suíno", {"4"})]},
    "Macarrão, cozido": {"ibge": [("Macarrão", {"2"})]},
    "Mamão formosa": {"taco": ["Mamão, Formosa, cru"], "ibge": [("Mamão", {"99"})]},
    "Mandioca, cozida": {"taco": ["Mandioca, cozida"], "ibge": [("Mandioca", {"2"}), ("Aipim", {"2"})]},
    "Manga": {"ibge": [("Manga", {"99"})]},
    "Manteiga": {"taco": ["Manteiga, com sal", "Manteiga, sem sal"], "ibge": [("Manteiga com ou sem sal", {"99"})]},
    "Mel": {"taco": ["Mel, de abelha"], "ibge": [("Mel", {"99"})]},
    "Melancia": {"taco": ["Melancia, crua"], "ibge": [("Melancia", {"99"})]},
    "Melão": {"taco": ["Melão, cru"], "ibge": [("Melão", {"99"})]},
    "Morango": {"taco": ["Morango, cru"], "ibge": [("Morango", {"99"})]},
    "Patinho/alcatra (bife)": {"taco": ["Carne, bovina, patinho, sem gordura, grelhado", "Carne, bovina, miolo de alcatra, sem gordura, grelhado"], "ibge": [("Patinho", {"3"}), ("Alcatra", {"3"})]},
    "Peito de frango inteiro, assado": {"taco": ["Frango, peito, com pele, assado"], "ibge": [("Peito de galinha ou frango", {"4"})]},
    "Peito de peru": {"ibge": [("Peito de peru", {"99"})]},
    "Peixe (posta)": {"ibge": [("Peixe de mar (inteiro, em posta, em filé, etc.)", {"2", "3", "4", "5"}), ("Peixe de água doce (inteiro, em posta, em filé, etc.)", {"2", "3", "4", "5"}), ("Peixe não especificado (inteiro, em posta, em filé, etc.)", {"2", "3", "4", "5"})]},
    "Pera": {"taco": ["Pêra, Park, crua", "Pêra, Williams, crua"], "ibge": [("pera", {"99"})]},
    "Polenta": {"ibge": [("Polenta", {"99"})]},
    "Presunto": {"taco": ["Presunto, com capa de gordura", "Presunto, sem capa de gordura"], "ibge": [("Presunto", {"99"})]},
    "Purê de batata": {"ibge": [("Purê de batata", {"99"})]},
    "Pão de queijo": {"taco": ["Pão, de queijo, assado"], "ibge": [("Pão de queijo", {"99"})]},
    "Queijo muçarela": {"taco": ["Queijo, mozarela"], "ibge": [("Queijo muçarela", {"99"})]},
    "Queijo parmesão ralado": {"ibge": [("Queijo ralado", {"99"})]},
    "Queijo prato": {"taco": ["Queijo, prato"], "ibge": [("Queijo prato", {"99"})]},
    "Repolho, cru": {"taco": ["Repolho, branco, cru", "Repolho, roxo, cru"], "ibge": [("Repolho", CRU)]},
    "Requeijão cremoso": {"taco": ["Queijo, requeijão, cremoso"], "ibge": [("Requeijão", CRU)]},
    "Salmão": {"taco": ["Salmão, filé, com pele, fresco,  grelhado", "Salmão, sem pele, fresco, grelhado"]},
    "Salsicha": {"ibge": [("Salsicha no varejo", {"1", "2", "3", "4", "5", "99"})]},
    "Sardinha em conserva": {"taco": ["Sardinha, conserva em óleo"], "ibge": [("Sardinha em conserva", {"99"})]},
    "Sobrecoxa de frango": {"taco": ["Frango, sobrecoxa, com pele, assada", "Frango, sobrecoxa, sem pele, assada"]},
    "Suco de laranja": {"taco": ["Laranja, baía, suco", "Laranja, da terra, suco", "Laranja, lima, suco", "Laranja, pêra, suco", "Laranja, valência, suco"], "ibge": [("Suco de laranja", {"99"})]},
    "Tangerina": {"taco": ["Tangerina, Poncã, crua"], "ibge": [("Tangerina", {"99"})]},
    "Tomate": {"taco": ["Tomate, com semente, cru"], "ibge": [("Tomate", {"99"})]},
    "Uva": {"taco": ["Uva, Itália, crua", "Uva, Rubi, crua"], "ibge": [("Uva", {"99"})]},
    "Vagem": {"ibge": [("Vagem", {"2", "7"})]},
    "Óleo de soja": {"taco": ["Óleo, de soja"], "ibge": [("Óleo de soja", {"99"})]},
})

# Como a medida vai escrita na dieta. O texto original fica na `ref`.
RENOMEAR = {
    "pedaço/unidade/fatia (M)": "unidade média",
    "colher de arroz/servir": "colher de servir",
    "colher de servir/arroz": "colher de servir",
    "unidade (pote)": "pote",
}


def ler_planilhas():
    """{nome da planilha: [medidas]}, de todos os lotes, na ordem."""
    import glob
    import openpyxl

    saida = {}
    for arquivo in sorted(glob.glob("dados/medidas_caseiras_lote*.xlsx")):
        lote = arquivo.split("/")[-1]
        linhas = openpyxl.load_workbook(arquivo, read_only=True).active.iter_rows(values_only=True)
        cabecalho = next(linhas)
        if list(cabecalho[:4]) != ["Alimento", "Fonte (tabela)", "Medida caseira", "Gramas (g)"]:
            raise SystemExit(f"{lote}: colunas mudaram: {cabecalho}")
        for alimento, fonte, medida, gramas, *resto in linhas:
            if not alimento:
                continue
            obs = resto[0] if resto else None
            original = str(medida).strip()
            nome = original[2:] if original.startswith("1 ") else original
            nome = RENOMEAR.get(nome, nome)
            g = float(gramas)
            if not g > 0:
                raise SystemExit(f"{lote}: {alimento} / {medida} sem gramas")
            ref = f"{fonte} · 1 {original[2:] if original.startswith('1 ') else original} = {g:g} g · {lote}"
            if obs:
                ref += f" · {obs}"
            saida.setdefault(alimento.strip(), []).append({"n": nome, "g": g, "ref": ref})
    return saida


taco = json.load(open("dados/taco.json"))["alimentos"]
ibge = json.load(open("dados/ibge.json"))["alimentos"]
usda_base = json.load(open("dados/usda.json"))["alimentos"]

alimentos = {}

for nome, medidas in TACO.items():
    achados = [a for a in taco if a["n"] == nome]
    if len(achados) != 1:
        raise SystemExit(f"TACO: '{nome}' casou {len(achados)} vezes")
    alimentos[f"taco:{achados[0]['c']}"] = medidas

for nome, preparos, medidas in IBGE:
    achados = [a for a in ibge if a["nome"] == nome and a["preparo_codigo"] in preparos]
    if not achados:
        raise SystemExit(f"IBGE: '{nome}' {sorted(preparos)} não existe")
    for a in achados:
        alimentos[f"ibge:{a['codigo']}:{a['preparo_codigo']}"] = medidas

# A planilha dela por cima: substitui o USDA daquele alimento, não soma com
# ele. Entre os lotes, SOMA: dois nomes da planilha podem cair no mesmo
# alimento (lote 1 "Requeijão" e lote 2 "Requeijão cremoso"). Mesma medida
# com o mesmo peso entra uma vez; com peso diferente, o gerador PARA.
de_planilha = set()


def por_cima(chave, medidas, origem):
    if chave not in de_planilha:
        alimentos[chave] = []
        de_planilha.add(chave)
    lista = alimentos[chave]
    for m in medidas:
        igual = next((x for x in lista if x["n"] == m["n"]), None)
        if igual is None:
            lista.append(m)
        elif igual["g"] != m["g"]:
            raise SystemExit(f"{chave}: '{m['n']}' {igual['g']:g} g × {m['g']:g} g ({origem})")


planilha = ler_planilhas()
sem_destino = sorted(set(planilha) - set(PLANILHA))
if sem_destino:
    raise SystemExit(f"planilha: sem destino em PLANILHA: {sem_destino}")
for nome_planilha, destinos in PLANILHA.items():
    medidas = planilha.get(nome_planilha)
    if not medidas:
        raise SystemExit(f"planilha: '{nome_planilha}' não está em nenhum lote")
    for nome in destinos.get("taco", []):
        achados = [a for a in taco if a["n"] == nome]
        if len(achados) != 1:
            raise SystemExit(f"TACO: '{nome}' casou {len(achados)} vezes")
        por_cima(f"taco:{achados[0]['c']}", medidas, nome_planilha)
    for nome, preparos in destinos.get("ibge", []):
        achados = [a for a in ibge if a["nome"] == nome and a["preparo_codigo"] in preparos]
        if not achados:
            raise SystemExit(f"IBGE: '{nome}' {sorted(preparos)} não existe")
        for a in achados:
            por_cima(f"ibge:{a['codigo']}:{a['preparo_codigo']}", medidas, nome_planilha)
    for codigo in destinos.get("importada", []):
        por_cima(f"imp:{codigo}", medidas, nome_planilha)

# USDA: as porções do próprio código. "NLEA serving" fica de fora — é a
# porção de rótulo americana, não uma medida que se sirva no prato.
sem_porcao = 0
for a in usda_base:
    lista = porcoes.get(a["c"].zfill(5))
    if not lista:
        sem_porcao += 1
        continue
    medidas = []
    for p in lista:
        if p["desc"] == "NLEA serving":
            continue
        nome = p["desc"] if p["qtd"] == 1 else f"{p['qtd']:g} {p['desc']}"
        if any(m[0] == nome for m in medidas):
            continue
        medidas.append([nome, round(p["g"], 2)])
    if medidas:
        alimentos[f"usda:{a['c']}"] = medidas

json.dump(
    {
        "fonte": "USDA National Nutrient Database for Standard Reference, Release 28 (SR28) — WEIGHT",
        "instituicao": "USDA/ARS — domínio público",
        "nota": "Pesos de porção oficiais do USDA. TACO e IBGE só recebem peso do USDA "
        "quando o alimento e a variedade são os mesmos. Por cima, a planilha da "
        "nutricionista (dados/medidas_caseiras_lote*.xlsx), que substitui o USDA onde tem medida.",
        "usda_sem_porcao": sem_porcao,
        "alimentos": alimentos,
    },
    sys.stdout,
    ensure_ascii=False,
    separators=(",", ":"),
)
