# As tabelas de composição de alimentos

Duas bases estão aqui, extraídas de planilhas que a nutricionista forneceu.
Nenhuma delas foi baixada da internet por este código: este ambiente não
alcança a rede, e uma base nutricional que ninguém consegue auditar de onde
veio não serve para prescrever.

## O que tem

| arquivo | fonte | linhas | nutrientes |
|---|---|---|---|
| `taco.json` | TACO 4ª edição revisada e ampliada (NEPA/UNICAMP) | 597 alimentos | 66 |
| `ibge.json` | Tabela de Composição Nutricional dos Alimentos Consumidos no Brasil — tabela reduzida (IBGE, POF 2008-2009) | 1.971 linhas / 1.122 alimentos | 5 |

O IBGE tem menos nutrientes e muito mais alimentos, **com preparo**: o mesmo
código aparece cru, cozido, grelhado, frito, refogado. São 16 preparos, e em
152 alimentos os valores realmente mudam de um preparo para outro. Por isso
cada linha é um registro próprio; juntar "arroz cru" com "arroz cozido"
seria inventar um alimento que não existe na fonte.

## A regra que vale para as duas

Ausência **nunca** vira zero.

* na TACO, `NA`, `Tr` e `*` são coisas diferentes entre si e nenhuma é zero;
* no IBGE, `-` é valor ausente e `0,00` é medida real abaixo do limite de
  quantificação — é o próprio IBGE quem diz isso na nota de rodapé da
  planilha.

No JSON, ausência é `null`. Um alimento sem fibra medida some da conta de
fibra; não entra nela valendo zero.

No IBGE isso é grande: de 1.971 linhas, **858 não têm fibra** e **573 não
têm carboidrato**. Uma dieta montada tratando esses `-` como zero pareceria
ter metade da fibra que tem.

## O escorregão de coluna que quase custou 28 alimentos

A planilha do IBGE é um layout de impressão, não uma tabela de dados: o
cabeçalho se repete a cada página e o nome do grupo aparece ora na coluna C,
ora na D, E ou F.

Na última página — as 28 linhas a partir de "Macarrão pronto light" — **a
energia escorregou uma coluna para a esquerda**, de K para J. Proteína,
lipídio, carboidrato e fibra ficaram no lugar. Um leitor que confiasse na
coluna K traria esses 28 alimentos sem caloria nenhuma, e nada avisaria: uma
pizza portuguesa de 229 kcal somaria zero no cardápio.

`scripts/extrair-ibge.py` lê K e recua para J quando K está vazia, e imprime
quantas vezes precisou recuar (`energia_lida_na_coluna_recuada`). Se um dia
a planilha for corrigida, esse número cai para zero e o recuo deixa de
acontecer sozinho.

## Os grupos

A planilha só rotula 12 grupos, e não rotula todos os prefixos de código —
"Carnes e vísceras" cobre os prefixos 70 a 78, o que provavelmente esconde
pescados e ovos como subgrupos sem etiqueta. Não inventei os que faltam:
cada registro guarda `grupo` (o que está escrito) e `grupo_codigo` (os dois
primeiros dígitos do código IBGE), para reagrupar depois sem adivinhar
agora.

## Como refazer

```
python3 scripts/extrair-taco.py  <planilha-taco.xlsx>  > dados/taco.json
python3 scripts/extrair-ibge.py  <tabela_reduzida.xlsx> > dados/ibge.json
```

## Licença e origem

TACO é publicação do NEPA/UNICAMP. A tabela reduzida é publicação do IBGE
(POF 2008-2009). Ambas são material público brasileiro, com citação da
fonte preservada dentro do próprio JSON (campos `nome`, `instituicao`,
`gerado_de` e, no IBGE, `nota_da_fonte`).

A TBCA (USP/FoRC) **não está aqui** e não foi coletada. Ver o relatório em
`/tbca/LEIA-ME.md`.
