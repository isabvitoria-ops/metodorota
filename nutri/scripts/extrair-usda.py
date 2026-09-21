#!/usr/bin/env python3
"""
Converte o FoodData Central (USDA) na tabela que a ferramenta usa.

    python3 extrair-usda.py FoodData_Central_Supporting_Data_csv/ ../dados/usda.json

POR QUE ESTA ENTRA NO SITE, E A TBCA NÃO

O FoodData Central é publicação do governo dos Estados Unidos e é de
domínio público: pode ser redistribuído, inclusive num produto pago. A TBCA
é CC BY-NC-ND — não comercial e sem redistribuição —, e por isso fica no
navegador dela. São duas situações diferentes, e o código trata cada uma
como ela é.

O QUE VEM DAQUI

O pacote "Supporting Data" é sobretudo tabela de apoio (nomes de nutriente,
categorias, unidades). O que tem composição de verdade é um arquivo só:
`fndds_ingredient_nutrient_value.csv`, com 1.882 ingredientes × 65
nutrientes, completo. São os ingredientes que a FNDDS usa, que vêm em boa
parte da SR Legacy — alimentos de verdade, não produtos de marca.

OS NOMES FICAM EM INGLÊS

"Butter, stick, salted" continua "Butter, stick, salted". Traduzir 1.882
nomes por máquina, sem ninguém conferir, produziria erro de alimento — e
errar o alimento é errar a prescrição. O que existe é uma lista de
APELIDOS de busca (ver `APELIDOS`): digitar "manteiga" encontra "butter",
sem que o nome mostrado mude. A etiqueta na tela diz USDA, e ela vê de
onde veio.
"""

import csv
import json
import os
import sys

# nutrient_nbr do USDA -> nome interno da ferramenta.
NUTRIENTES = {
    "208": "energia_kcal",
    "205": "carboidrato",
    "203": "proteina",
    "204": "lipideos",
    "291": "fibra_alimentar",
    "269": "acucar",
    "601": "colesterol",
    "307": "sodio",
    "301": "calcio",
    "303": "ferro",
    "306": "potassio",
    "304": "magnesio",
    "309": "zinco",
    "401": "vitamina_c",
}

# A ORDEM importa: é ela que os valores seguem no arquivo compacto.
ORDEM = [
    "energia_kcal", "carboidrato", "proteina", "lipideos", "fibra_alimentar",
    "acucar", "colesterol", "sodio", "calcio", "ferro", "potassio", "magnesio",
    "zinco", "vitamina_c",
]

"""
Apelidos de busca: a palavra em português encontra a palavra em inglês.

NÃO É TRADUÇÃO DO ALIMENTO, e a diferença é o que mantém isto honesto: o
nome mostrado continua sendo o original, e o apelido só entra no texto
invisível que a busca varre. "Manteiga" acha "Butter, stick, salted", que
aparece escrito assim mesmo, com a etiqueta USDA do lado.

A lista é curta de propósito. Só entra palavra que não tem como confundir:
`beef` é carne bovina em qualquer contexto, mas `roll` pode ser pãozinho ou
rocambole, e `chip` pode ser batata frita ou gota de chocolate. Palavra
dúbia fora — um apelido errado faz ela escolher o alimento errado, que é
pior do que não achar.
"""
APELIDOS = {
    "butter": "manteiga", "chicken": "frango", "beef": "carne bovina boi",
    "pork": "porco suina", "rice": "arroz", "beans": "feijao",
    "milk": "leite", "cheese": "queijo", "egg": "ovo ovos",
    "fish": "peixe", "bread": "pao", "potato": "batata",
    "apple": "maca", "banana": "banana", "orange": "laranja",
    "carrot": "cenoura", "onion": "cebola", "tomato": "tomate",
    "sugar": "acucar", "salt": "sal", "flour": "farinha",
    "oats": "aveia", "corn": "milho", "wheat": "trigo",
    "yogurt": "iogurte", "almond": "amendoa", "peanut": "amendoim",
    "shrimp": "camarao", "turkey": "peru", "honey": "mel",
    "water": "agua", "garlic": "alho", "lemon": "limao",
    "strawberry": "morango", "grape": "uva", "pineapple": "abacaxi",
    "mango": "manga", "papaya": "mamao", "avocado": "abacate",
    "cabbage": "repolho", "lettuce": "alface", "spinach": "espinafre",
    "pumpkin": "abobora", "cassava": "mandioca", "lentils": "lentilha",
    "chickpeas": "grao de bico", "quinoa": "quinoa", "salmon": "salmao",
    "tuna": "atum", "sardine": "sardinha", "liver": "figado",
    "coconut": "coco", "olive": "azeitona", "cocoa": "cacau",
    "coffee": "cafe", "cinnamon": "canela", "ginger": "gengibre",
}


def sem_acento(texto: str) -> str:
    import unicodedata
    return "".join(
        c for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )


def busca_de(nome: str) -> str:
    """O texto que a busca varre: o nome, mais os apelidos que casarem.

    O casamento é por PALAVRA INTEIRA, e não por pedaço de palavra. Com
    pedaço, "buttermilk" — que é leite fermentado — casava com "butter" e
    entrava na busca por "manteiga". Um apelido errado faz ela escolher o
    alimento errado, que é pior do que não achar.

    O "s" opcional no fim cobre o plural que a USDA usa o tempo todo
    ("eggs", "beans"), sem abrir a porta para palavra parecida.
    """
    import re
    base = sem_acento(nome)
    palavras = set(re.findall(r"[a-z]+", base))
    extras = [
        pt for en, pt in APELIDOS.items()
        if en in palavras or f"{en}s" in palavras or en.rstrip("s") in palavras
    ]
    return " ".join([base, *extras]).strip()


def extrair(pasta: str) -> dict:
    caminho = os.path.join(pasta, "fndds_ingredient_nutrient_value.csv")
    if not os.path.exists(caminho):
        raise SystemExit(
            f"Não achei {caminho}.\n"
            "É o arquivo do pacote 'Supporting Data' do FoodData Central."
        )

    alimentos: dict[str, dict] = {}
    with open(caminho, encoding="utf-8-sig") as f:
        for linha in csv.DictReader(f):
            chave = NUTRIENTES.get(linha["Nutrient code"].strip())
            if not chave:
                continue
            codigo = linha["ingredient code"].strip()
            alimento = alimentos.setdefault(
                codigo, {"c": codigo, "n": linha["Ingredient description"].strip(), "v": {}}
            )
            bruto = linha["Nutrient value"].strip()
            # Vazio e "NA" viram NULO, não zero. A regra de sempre: o que a
            # fonte não mediu não é zero medido.
            if bruto in ("", "NA"):
                continue
            try:
                alimento["v"][chave] = float(bruto)
            except ValueError:
                continue

    lista = []
    for a in sorted(alimentos.values(), key=lambda x: x["n"]):
        # Sem caloria, o alimento não serve para montar dieta — e entrar na
        # busca só para aparecer vazio confunde mais do que ajuda.
        if a["v"].get("energia_kcal") is None:
            continue
        lista.append({
            "c": a["c"],
            "n": a["n"],
            "b": busca_de(a["n"]),
            # Vetor na ORDEM, com `null` onde não há valor: é bem menor que
            # repetir catorze nomes de chave em 1.882 alimentos.
            "v": [a["v"].get(k) for k in ORDEM],
        })

    return {
        "fonte": "USDA FoodData Central",
        "nome": "FoodData Central — FNDDS Ingredient Nutrient Values",
        "instituicao": "U.S. Department of Agriculture",
        "licenca": "Domínio público (obra do governo dos Estados Unidos).",
        "base": "FoodData Central, versão de 28/10/2022",
        "nutrientes": ORDEM,
        "alimentos": lista,
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("uso: extrair-usda.py <pasta do csv> <saida.json>")
    dados = extrair(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as saida:
        json.dump(dados, saida, ensure_ascii=False, separators=(",", ":"))
    com_apelido = sum(1 for a in dados["alimentos"] if a["b"] != sem_acento(a["n"]))
    print(f"{len(dados['alimentos'])} alimentos, {com_apelido} com apelido em português.")
    print(f"{os.path.getsize(sys.argv[2]):,} bytes.".replace(",", "."))


if __name__ == "__main__":
    main()
