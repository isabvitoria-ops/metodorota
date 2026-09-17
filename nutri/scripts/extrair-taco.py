#!/usr/bin/env python3
"""
Extrai a TACO 4ª edição da planilha oficial do NEPA/UNICAMP.

    python3 scripts/extrair-taco.py Taco-4a-Edicao.xlsx > /tmp/taco.json

Roda raramente — só quando a planilha oficial for atualizada. Precisa de
`openpyxl` (pip install openpyxl).

O que este arquivo NÃO faz, e é o motivo de existir em vez de alguém digitar
os valores: não arredonda, não completa lacuna e não converte marcador em
número. A planilha do NEPA usa três marcadores, e cada um significa uma coisa
diferente:

    NA   não analisado / não disponível  →  nulo, e a tela diz que não há dado
    Tr   traços, abaixo do limite de detecção  →  guardado como `tr`, não como 0
    *    valor com ressalva na fonte  →  guardado com a ressalva junto

Zerar qualquer um desses seria inventar informação nutricional, que é
exatamente o que o §30 do pedido dela proíbe.
"""

import json
import re
import sys

import openpyxl

# Os grupos da TACO, na ordem em que aparecem. Servem para reconhecer a linha
# de título de grupo no meio da planilha — ela vem com o nome na primeira
# coluna e o resto vazio, igual a uma linha de alimento sem código.
GRUPOS = [
    "Cereais e derivados",
    "Verduras, hortaliças e derivados",
    "Frutas e derivados",
    "Gorduras e óleos",
    "Pescados e frutos do mar",
    "Carnes e derivados",
    "Leite e derivados",
    "Bebidas (alcoólicas e não alcoólicas)",
    "Ovos e derivados",
    "Produtos açucarados",
    "Miscelâneas",
    "Outros alimentos industrializados",
    "Alimentos preparados",
    "Leguminosas e derivados",
    "Nozes e sementes",
]

# coluna da planilha -> (chave, unidade). A coluna 14 repete o código do
# alimento no meio da tabela, e por isso não está aqui.
COLUNAS_PRINCIPAIS = {
    3: ("umidade", "%"),
    4: ("energia_kcal", "kcal"),
    5: ("energia_kj", "kJ"),
    6: ("proteina", "g"),
    7: ("lipideos", "g"),
    8: ("colesterol", "mg"),
    9: ("carboidrato", "g"),
    10: ("fibra_alimentar", "g"),
    11: ("cinzas", "g"),
    12: ("calcio", "mg"),
    13: ("magnesio", "mg"),
    15: ("manganes", "mg"),
    16: ("fosforo", "mg"),
    17: ("ferro", "mg"),
    18: ("sodio", "mg"),
    19: ("potassio", "mg"),
    20: ("cobre", "mg"),
    21: ("zinco", "mg"),
    22: ("retinol", "mcg"),
    23: ("vitamina_a_re", "mcg"),
    24: ("vitamina_a_rae", "mcg"),
    25: ("tiamina", "mg"),
    26: ("riboflavina", "mg"),
    27: ("piridoxina", "mg"),
    28: ("niacina", "mg"),
    29: ("vitamina_c", "mg"),
}

COLUNAS_ACIDOS_GRAXOS = {
    3: ("ag_saturados", "g"),
    4: ("ag_monoinsaturados", "g"),
    5: ("ag_poliinsaturados", "g"),
    6: ("ag_12_0", "g"),
    7: ("ag_14_0", "g"),
    8: ("ag_16_0", "g"),
    9: ("ag_18_0", "g"),
    10: ("ag_20_0", "g"),
    11: ("ag_22_0", "g"),
    12: ("ag_24_0", "g"),
    14: ("ag_14_1", "g"),
    15: ("ag_16_1", "g"),
    16: ("ag_18_1", "g"),
    17: ("ag_20_1", "g"),
    18: ("ag_18_2_n6", "g"),
    19: ("ag_18_3_n3", "g"),
    20: ("ag_20_4", "g"),
    21: ("ag_20_5", "g"),
    22: ("ag_22_5", "g"),
    23: ("ag_22_6", "g"),
    24: ("ag_18_1t", "g"),
    25: ("ag_18_2t", "g"),
}

COLUNAS_AMINOACIDOS = {
    3: ("aa_triptofano", "g"),
    4: ("aa_treonina", "g"),
    5: ("aa_isoleucina", "g"),
    6: ("aa_leucina", "g"),
    7: ("aa_lisina", "g"),
    8: ("aa_metionina", "g"),
    9: ("aa_cistina", "g"),
    10: ("aa_fenilalanina", "g"),
    11: ("aa_tirosina", "g"),
    13: ("aa_valina", "g"),
    14: ("aa_arginina", "g"),
    15: ("aa_histidina", "g"),
    16: ("aa_alanina", "g"),
    17: ("aa_acido_aspartico", "g"),
    18: ("aa_acido_glutamico", "g"),
    19: ("aa_glicina", "g"),
    20: ("aa_prolina", "g"),
    21: ("aa_serina", "g"),
}

avisos = []


def ler_valor(bruto, alimento, chave):
    """
    Devolve (valor, marcador).

    valor    número, ou None quando não há dado
    marcador None | 'na' | 'tr' | 'ressalva'
    """
    if bruto is None:
        return None, "na"
    if isinstance(bruto, (int, float)):
        return float(bruto), None

    texto = str(bruto).strip()
    if texto in ("", "-"):
        return None, "na"
    if texto.upper() == "NA":
        return None, "na"
    if texto.lower() in ("tr", "traço", "traços"):
        return None, "tr"
    if texto == "*":
        return None, "na"

    # Valor com ressalva na fonte: "12,3*"
    ressalva = texto.endswith("*")
    limpo = texto.rstrip("*").strip()

    # A planilha oficial tem pelo menos uma célula digitada torta (",0,02").
    # Não adivinho o que era: registro o aviso e trato como sem dado. Chutar
    # aqui seria inventar valor nutricional.
    normalizado = limpo.replace(",", ".")
    if normalizado.count(".") > 1 or not re.fullmatch(r"-?\d*\.?\d+", normalizado):
        avisos.append(
            f"alimento {alimento}, campo {chave}: valor ilegível na planilha "
            f"({bruto!r}) — gravado como sem dado"
        )
        return None, "na"

    return float(normalizado), ("ressalva" if ressalva else None)


def linha_de_alimento(ws, r):
    """O código do alimento é inteiro. Cabeçalho repetido e título de grupo não."""
    bruto = ws.cell(r, 1).value
    if isinstance(bruto, (int, float)) and float(bruto).is_integer():
        return int(bruto)
    if isinstance(bruto, str) and bruto.strip().isdigit():
        return int(bruto.strip())
    return None


def ler_aba(ws, colunas, alvo, so_existentes=False):
    grupo_atual = None
    vistos = 0
    for r in range(1, ws.max_row + 1):
        bruto = ws.cell(r, 1).value
        if isinstance(bruto, str) and bruto.strip() in GRUPOS:
            grupo_atual = bruto.strip()
            continue

        codigo = linha_de_alimento(ws, r)
        if codigo is None:
            continue
        descricao = ws.cell(r, 2).value
        if not descricao or not str(descricao).strip():
            continue

        if so_existentes and codigo not in alvo:
            avisos.append(f"alimento {codigo} aparece nesta aba e não na principal")
            continue

        registro = alvo.setdefault(
            codigo,
            {"codigo": codigo, "nome": str(descricao).strip(), "grupo": grupo_atual, "valores": {}},
        )
        if grupo_atual and not registro.get("grupo"):
            registro["grupo"] = grupo_atual

        for coluna, (chave, unidade) in colunas.items():
            valor, marcador = ler_valor(ws.cell(r, coluna).value, codigo, chave)
            if valor is None and marcador == "na":
                continue  # sem dado não vira linha: a ausência é a informação
            registro["valores"][chave] = {
                "valor": valor,
                "unidade": unidade,
                "marcador": marcador,
            }
        vistos += 1
    return vistos


def main():
    if len(sys.argv) < 2:
        print("uso: extrair-taco.py <planilha.xlsx>", file=sys.stderr)
        return 1

    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    alimentos = {}

    n1 = ler_aba(wb["CMVCol taco3"], COLUNAS_PRINCIPAIS, alimentos)
    n2 = ler_aba(wb["AGtaco3"], COLUNAS_ACIDOS_GRAXOS, alimentos, so_existentes=True)
    n3 = ler_aba(wb["Aminoácidos TACO3"], COLUNAS_AMINOACIDOS, alimentos, so_existentes=True)

    sem_grupo = [c for c, a in alimentos.items() if not a["grupo"]]
    if sem_grupo:
        avisos.append(f"{len(sem_grupo)} alimento(s) sem grupo: {sem_grupo[:10]}")

    saida = {
        "fonte": "TACO — Tabela Brasileira de Composição de Alimentos, 4ª edição revisada e ampliada",
        "instituicao": "NEPA/UNICAMP",
        "base": "valores por 100 g de parte comestível",
        "planilha": sys.argv[1].split("/")[-1],
        "alimentos": [alimentos[c] for c in sorted(alimentos)],
        "resumo": {
            "alimentos": len(alimentos),
            "linhas_principal": n1,
            "linhas_acidos_graxos": n2,
            "linhas_aminoacidos": n3,
            "nutrientes_distintos": len(
                {k for a in alimentos.values() for k in a["valores"]}
            ),
        },
        "avisos": avisos,
    }
    json.dump(saida, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
