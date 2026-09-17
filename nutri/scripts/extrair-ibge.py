#!/usr/bin/env python3
"""
Extrai a Tabela de Composição Nutricional dos Alimentos Consumidos no Brasil
(IBGE, POF 2008-2009 — "tabela reduzida") para JSON.

Uso: python3 scripts/extrair-ibge.py <planilha.xlsx> > dados/ibge.json

REGRAS QUE NÃO SE NEGOCIAM, as mesmas que valeram para a TACO:

  * "-" na planilha significa VALOR AUSENTE. Não é zero. Fibra aparece
    como "-" em 858 linhas; virar zero faria uma dieta parecer sem fibra
    nenhuma quando na verdade o IBGE não mediu. Aqui vira `null`;
  * "0,00" é medida real abaixo do limite de quantificação, e é o próprio
    IBGE quem diz isso na nota de rodapé. Esse zero fica;
  * nada é estimado, completado por alimento parecido ou trazido de outra
    tabela. O que não está aqui, não está.

A planilha é um layout de impressão: o cabeçalho se repete a cada página e
o nome do grupo aparece sozinho na coluna E logo depois dele. Por isso a
leitura é por posição de linha, não por coluna só.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

COLUNAS = {
    "L": "proteina_g",
    "M": "lipidios_g",
    "N": "carboidrato_g",
    "O": "fibra_g",
}

# A energia mora na coluna K -- MENOS na última página (as 28 linhas a partir
# de "Macarrão pronto light"), onde ela escorregou uma coluna para a esquerda
# e está em J. Lendo só K, esses 28 alimentos entrariam sem caloria nenhuma e
# nada avisaria: uma pizza de 229 kcal somaria zero no cardápio. Por isso o
# recuo para J, contado e impresso no fim para que o escorregão fique visível.
COLUNAS_ENERGIA = ("K", "J")

# Onde o nome do grupo aparece. É layout de impressão: ora numa coluna, ora
# noutra, às vezes sozinho na linha, às vezes na mesma linha do primeiro
# alimento do grupo.
COLUNAS_GRUPO = ("C", "D", "E", "F")


def numero(texto):
    """"12,34" vira 12.34. "-" e vazio viram None — ausência, nunca zero."""
    t = (texto or "").strip()
    if t in ("", "-", "–", "—"):
        return None
    try:
        return float(t.replace(".", "").replace(",", ".")) if "," in t else float(t)
    except ValueError:
        raise SystemExit(f"valor que não sei ler: {t!r}")


def ler(caminho):
    z = zipfile.ZipFile(caminho)
    textos = [
        "".join(t.text or "" for t in si.iter(NS + "t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml"))
    ]
    folha = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    for linha in folha.iter(NS + "row"):
        celulas = {}
        for c in linha.iter(NS + "c"):
            col = re.match(r"([A-Z]+)", c.get("r")).group(1)
            v = c.find(NS + "v")
            if v is None:
                celulas[col] = ""
            elif c.get("t") == "s":
                celulas[col] = textos[int(v.text)]
            else:
                celulas[col] = v.text
        yield int(linha.get("r")), celulas


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)

    alimentos = []
    recuos = []
    grupo = None
    fonte = None

    for _, c in ler(sys.argv[1]):
        a = (c.get("A") or "").strip()

        if a.startswith("Fonte:"):
            fonte = a
            continue

        rotulo = next(
            (c[k].strip() for k in COLUNAS_GRUPO if (c.get(k) or "").strip()), None
        )
        if a and not a.isdigit() and not a.startswith("Código"):
            rotulo = a
        if rotulo:
            grupo = rotulo

        if not a.isdigit():
            continue

        valores = {nome: numero(c.get(col)) for col, nome in COLUNAS.items()}

        energia = None
        for col in COLUNAS_ENERGIA:
            energia = numero(c.get(col))
            if energia is not None:
                if col != COLUNAS_ENERGIA[0]:
                    recuos.append(a)
                break
        valores["energia_kcal"] = energia
        alimentos.append(
            {
                "codigo": a,
                "nome": (c.get("B") or "").strip(),
                "grupo": grupo,
                # O prefixo do código: a planilha não rotula todos os grupos,
                # e com ele dá para reagrupar depois sem adivinhar agora.
                "grupo_codigo": a[:2],
                "preparo_codigo": (c.get("G") or "").strip(),
                "preparo": (c.get("I") or "").strip(),
                **valores,
            }
        )

    ausentes = {
        nome: sum(1 for x in alimentos if x[nome] is None) for nome in COLUNAS.values()
    }

    json.dump(
        {
            "fonte": "ibge_pof_2008_2009",
            "nome": "Tabela de Composição Nutricional dos Alimentos Consumidos no "
            "Brasil — tabela reduzida",
            "instituicao": "IBGE, Pesquisa de Orçamentos Familiares 2008-2009",
            "base": "valores por 100 g",
            "gerado_de": sys.argv[1].split("/")[-1],
            "nota_da_fonte": fonte,
            "ausentes": ausentes,
            "energia_lida_na_coluna_recuada": len(recuos),
            "total": len(alimentos),
            "alimentos": alimentos,
        },
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
