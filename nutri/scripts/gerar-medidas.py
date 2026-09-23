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

   A única exceção é a banana-prata: 70 g por unidade, valor informado pela
   própria nutricionista, e marcado assim na tela.

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
BANANA_PRATA = [{"n": "unidade", "g": 70, "ref": "Valor informado pela nutricionista (banana-prata, média)"}]
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
    "Banana, prata, crua": BANANA_PRATA,
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
    ("Banana (ouro, prata, d´água, da terra, etc.)", CRU, BANANA_PRATA),
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
        "nota": "Pesos de porção oficiais. TACO e IBGE só recebem peso quando o alimento "
        "é o mesmo (e a variedade é a mesma). Exceção marcada: banana-prata, 70 g, "
        "informado pela nutricionista.",
        "usda_sem_porcao": sem_porcao,
        "alimentos": alimentos,
    },
    sys.stdout,
    ensure_ascii=False,
    separators=(",", ":"),
)
