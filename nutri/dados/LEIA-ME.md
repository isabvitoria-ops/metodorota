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

## USDA FoodData Central — `usda.json`

1.882 alimentos com 14 nutrientes, do pacote *Supporting Data* do FoodData
Central (USDA), arquivo `fndds_ingredient_nutrient_value.csv`. São os
ingredientes que a FNDDS usa, boa parte vinda da SR Legacy.

**Por que esta entra no site e a TBCA não:** o FoodData Central é obra do
governo dos Estados Unidos e é de **domínio público** — pode ser
redistribuído, inclusive num produto pago. A TBCA é CC BY-NC-ND, e por isso
fica no navegador dela (ver `tabelaImportada.mjs`).

**Os nomes ficam em inglês.** "Butter, stick, salted" continua assim.
Traduzir 1.882 nomes por máquina, sem ninguém conferir, produziria erro de
alimento — e errar o alimento é errar a prescrição. O que existe é uma lista
curta de **apelidos de busca**: "manteiga" encontra "butter", e o nome
mostrado continua o original, com a etiqueta USDA ao lado.

O casamento do apelido é por **palavra inteira**. Por pedaço, "buttermilk"
(leite fermentado) entrava na busca por "manteiga" — e um apelido errado faz
escolher o alimento errado, que é pior do que não achar.

Gerado por `scripts/extrair-usda.py`.

## Medidas caseiras — `medidas.json`

"1 unidade de kiwi = 69 g." O peso vem da tabela oficial de porções do
USDA, a SR28 (`WEIGHT.txt`, USDA/ARS, domínio público) — a mesma família de
dados dos alimentos USDA acima. Nenhum peso foi escrito de cabeça.

* **Alimento USDA:** recebe as porções do próprio código, com o texto em
  inglês como veio (`fruit (2" dia)`). Fica de fora só a "NLEA serving",
  que é porção de rótulo e não medida de prato.
* **TACO e IBGE:** só recebem peso quando o alimento é o mesmo, e para
  fruta, a mesma variedade — pêra Williams é a Bartlett; limão tahiti é a
  Persian lime; banana nanica é Cavendish. Banana-prata, laranja-pera,
  goiaba, maracujá amarelo, abacate e tangerina poncã **não** têm: a
  variedade americana pesa outra coisa.
* **A exceção:** banana-prata, 70 g, valor informado pela nutricionista, e
  marcado assim na própria tela.

Cada medida leva `ref` com o código SR28 e a porção original — na tela,
aparece ao parar o mouse sobre a opção. Para conferir: FoodData Central,
tipo SR Legacy, buscar pelo código.

A medida que ela cria vence a da tabela quando têm o mesmo nome.

```
python3 scripts/gerar-medidas.py WEIGHT.txt FOOD_DES.txt > dados/medidas.json
```

Os dois arquivos SR28 foram lidos da cópia em
`github.com/alyssaq/usda-sqlite` (pasta `data/`), porque o site do USDA
não abre deste ambiente. Por isso ainda não foram comparados com o site
oficial: a `ref` de cada medida tem o código para essa conferência.
