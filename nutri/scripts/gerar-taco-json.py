#!/usr/bin/env python3
"""
Gera `supabase/dados/taco.json` — a TACO num formato compacto, para a tela de
importação da nutricionista baixar e carregar no banco dela.

    python3 scripts/gerar-taco-json.py /tmp/taco.json

POR QUE UM ARQUIVO, E NÃO UMA MIGRAÇÃO

São 20.164 valores. Em SQL isso dá 1 MB — grande demais para o instalador que
ela cola no SQL Editor, e grande demais para caber num passo de migração. E
o §28 do pedido dela já pedia ferramenta de importação com validação e
relatório. Então o dado vira arquivo, publicado ao lado do site, e a tela de
importação faz o resto: baixa, confere, importa em lotes e diz o que entrou.

O arquivo NÃO entra no HTML do site. Ele fica solto ao lado, e só é baixado
quando ela clica em importar — a paciente nunca o pede.

FORMATO

    nutrientes  lista de ids; o valor referencia a posição, não repete o nome
    alimentos   c=código  n=nome  g=grupo  p=preparo
                v=[[posição, valor], ...]   t=[posições com traço]

Traço (`t`) é separado de propósito: valor nulo com marcador, nunca zero.
"""

import json
import sys
import unicodedata

PREPAROS = {
    "cru", "crua", "cozido", "cozida", "assado", "assada", "frito", "frita",
    "grelhado", "grelhada", "refogado", "refogada", "ensopado", "ensopada",
    "ao forno", "à milanesa", "à dorê", "em conserva", "desidratado",
    "desidratada", "torrado", "torrada", "seco", "seca", "defumado",
    "defumada", "enlatado", "enlatada", "industrializado", "industrializada",
}


def normalizar(nome):
    sem = unicodedata.normalize("NFD", nome)
    return "".join(c for c in sem if unicodedata.category(c) != "Mn").lower()


def main():
    dados = json.load(open(sys.argv[1], encoding="utf-8"))
    alimentos = dados["alimentos"]

    ordem = sorted({k for a in alimentos for k in a["valores"]})
    pos = {k: i for i, k in enumerate(ordem)}

    saida = []
    for a in alimentos:
        valores, tracos = [], []
        for chave, x in sorted(a["valores"].items(), key=lambda kv: pos[kv[0]]):
            if x["marcador"] == "tr":
                tracos.append(pos[chave])
            else:
                valores.append([pos[chave], round(float(x["valor"]), 6)])
        ultimo = a["nome"].split(",")[-1].strip().lower()
        item = {
            "c": a["codigo"],
            "n": a["nome"],
            "b": normalizar(a["nome"]),
            "g": a["grupo"],
            "v": valores,
        }
        if ultimo in PREPAROS:
            item["p"] = ultimo
        if tracos:
            item["t"] = tracos
        saida.append(item)

    pacote = {
        "fonte": "taco4",
        "nome": dados["fonte"],
        "instituicao": dados["instituicao"],
        "base": dados["base"],
        "gerado_de": dados["planilha"],
        "nutrientes": ordem,
        "alimentos": saida,
        "resumo": {
            "alimentos": len(saida),
            "valores": sum(len(a["v"]) for a in saida),
            "tracos": sum(len(a.get("t", [])) for a in saida),
        },
        "avisos": dados["avisos"],
    }
    with open("supabase/dados/taco.json", "w", encoding="utf-8") as f:
        json.dump(pacote, f, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(pacete := pacote["resumo"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
