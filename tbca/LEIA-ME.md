# TBCA — a FASE A parou por falta de rede; a planilha dela destravou

**Atualização de 21/09/2026.** A nutricionista entregou a planilha
`tbca_alimentos_selecionados.xlsx` — 24 alimentos escolhidos por ela,
consultados na TBCA em 21/09/2026, com medidas caseiras. Era exatamente o
que faltava no item 2 de "o que falta para destravar", abaixo: a fonte em
arquivo, melhor que scraping por qualquer critério.

O que foi feito com ela:

* `nutri/scripts/converter-tbca.py` converte a planilha no arquivo que a
  ferramenta importa. "tr", "NA" e "-" viram **nulo, nunca zero**; o código
  BRC da TBCA é preservado para auditoria; a citação e a licença viajam
  dentro do arquivo;
* `nutri/tabelaImportada.mjs` guarda a tabela **no navegador dela**, e a
  busca passa a mostrar os 24 alimentos com a etiqueta TBCA, com as medidas
  caseiras da própria tabela.

## E por que os dados NÃO estão neste repositório

A aba "Fonte e notas" da planilha diz, com todas as letras:

> Uso: seleção pessoal, sem fins comerciais, para apoio à prática clínica.
> **Não redistribuir.** Os direitos sobre os dados são da TBCA/USP (licença
> **CC BY-NC-ND 4.0**).

NC é não comercial; ND é sem obras derivadas. A Central do Paciente é um
serviço cobrado e este site é público: commitar os 24 alimentos aqui seria
publicar uma cópia da base, que é o que a licença proíbe — e é o caso que a
REGRA ZERO dela manda parar e documentar em vez de resolver por conta.

O caminho que a licença permite é o que está implementado: **o arquivo é
dela, fica no navegador dela, e nada sobe**. O script de conversão é
versionado; a saída do script, não. `.gitignore` guarda essa regra.

A recomendação da seção 2 continua de pé: para embutir a TBCA no produto,
é preciso autorização escrita do FoRC/USP. É um e-mail.

---

# O relatório original da FASE A

A nutricionista pediu uma pipeline completa de coleta, normalização,
validação e importação da TBCA (Tabela Brasileira de Composição de
Alimentos, USP/FoRC), com a instrução explícita:

> Se encontrar qualquer bloqueio técnico, mudança na estrutura da TBCA ou
> dúvida sobre a licença, pare nessa etapa, documente o problema e não
> invente uma solução.

Foi o que aconteceu. Este arquivo é o relatório da FASE A.

## 1. O bloqueio: não há rede neste ambiente

A ETAPA 1 manda acessar a TBCA e ler a estrutura da página antes de escrever
o crawler. Não é possível daqui. O ambiente onde este código roda sai para a
internet por um proxy que recusa a conexão:

```
$ curl https://www.tbca.net.br/
curl: (56) CONNECT tunnel failed, response 403

$ curl https://www.tbca.net.br/base-dados/composicao_estatistica.php
curl: (56) CONNECT tunnel failed, response 403

$ curl http://www.tbca.net.br/
403
```

O mesmo vale para `robots.txt`, que a ETAPA 1 manda respeitar — não dá para
respeitar um arquivo que não dá para ler. E o bloqueio não é da TBCA: é a
política de rede deste ambiente, que recusa qualquer destino externo.

**Consequência direta:** escrever o crawler agora seria escrever contra um
HTML imaginado. Seletores de CSS inventados, nomes de campo inventados,
paginação inventada. O código rodaria, produziria arquivos, e os arquivos
estariam errados sem parecer errados — que é exatamente o modo de falha
contra o qual todas as regras deste projeto foram escritas. Por isso as
ETAPAS 3 a 6 (crawler, resiliência, raw, parser) **não foram implementadas**.

Não há solução alternativa honesta: nem uma API "provável", nem um parser
"genérico", nem um exemplo "ilustrativo" que depois vira produção.

## 2. A licença, que é a pergunta mais séria e não foi respondida

A REGRA ZERO manda identificar os termos **atualmente** aplicáveis, na
página oficial, antes de qualquer extração massiva. Sem acesso à página, não
há como fazer isso, e responder de memória seria pior que não responder:
licença é justamente o tipo de informação que muda e que não se chuta.

O que dá para dizer com segurança é o desenho do risco:

* a TBCA é obra de uma instituição acadêmica (USP/FoRC), publicada para
  consulta, com pedido de citação;
* "está disponível online" não é o mesmo que "pode ser reproduzida por
  inteiro dentro de um produto pago", que é o uso pretendido aqui — a
  Central do Paciente é um serviço cobrado;
* a diferença entre *consultar* a TBCA e *redistribuir a base completa*
  costuma ser exatamente onde a autorização passa a ser exigida.

**Recomendação:** antes de coletar qualquer coisa, escrever para o FoRC/USP
descrevendo o uso comercial pretendido e pedir autorização por escrito. É um
e-mail, e resolve de uma vez uma dúvida que nenhum código resolve.

## 3. E se a TBCA talvez nem seja necessária

Há duas bases brasileiras já extraídas e commitadas neste repositório, em
`nutri/dados/`, vindas de planilhas oficiais que a própria nutricionista
forneceu:

| base | alimentos | nutrientes | origem |
|---|---|---|---|
| TACO 4ª ed. | 597 | 66 | NEPA/UNICAMP |
| IBGE POF 2008-2009 (reduzida) | 1.122 (1.971 com preparo) | 5 | IBGE |

Juntas cobrem cálculo de calorias, macros, montagem de refeição, comparação
e substituição — a lista inteira do "para quê" da ETAPA inicial, menos os
micronutrientes fora da TACO. São publicações federais, o que torna o
terreno de licença bem mais firme que o da TBCA para um app pago.

Vale medir o buraco antes de cavar: quais alimentos a nutricionista usa na
prática e que faltam nessas duas? Se forem poucos, a TBCA é trabalho grande
para um ganho pequeno.

## 4. O que dá para responder sem rede: o banco

A ETAPA 18 manda examinar o schema atual e **não** duplicar estrutura. Foi
examinado, em produção.

A tabela `alimentos` (254 linhas) **não tem nenhuma coluna de nutriente**:

```
id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id,
medidas (jsonb), sem_gluten, sem_lactose, tags, imagem_url, observacao,
nivel_acesso, ativo, quantidade_livre, criado_em, atualizado_em
```

Ela é um **catálogo para a troca inteligente**: grupo, porção, medidas
caseiras e restrições. Não é tabela de composição, e nunca foi.

Então a resposta à ETAPA 18 é: não há estrutura existente para expandir, e
enfiar 66 colunas de nutriente dentro de `alimentos` estragaria a tabela que
hoje faz a troca funcionar. A base de composição é estrutura nova, ao lado,
com uma ligação **opcional** para `alimentos` — o alimento do catálogo dela
aponta para o alimento da tabela quando ela quiser, e a troca continua
funcionando para os que não apontam.

O desenho da ETAPA 19 serve quase inteiro, adaptado aos nomes daqui:

```
fontes_nutricionais   (id, nome, versao, url, licenca, obtido_em)
alimentos_fonte       (id, fonte_id, codigo_fonte, nome, nome_cientifico,
                       grupo, subgrupo, preparo, url_fonte, ...)
                      unique (fonte_id, codigo_fonte)
alimento_nutrientes   (id, alimento_fonte_id, nutriente, valor, unidade,
                       valor_original, unidade_original, tipo_dado)
                      unique (alimento_fonte_id, nutriente)
alimento_medidas      (id, alimento_fonte_id, medida, gramas, fonte)
alimentos.fonte_id    -> ligação opcional do catálogo dela com a base
```

Três detalhes que a arquitetura daqui já impõe e que reforçam o pedido dela:

* **RLS (ETAPA 22):** toda tabela deste banco tem RLS, e a base nutricional
  seria leitura para `authenticated` e escrita só para `e_admin()` — o mesmo
  padrão de `alimentos` hoje;
* **uma cópia só (ETAPA 23):** já é assim. `reintroducao_itens` e
  `equivalencias` referenciam `alimentos` por id, não copiam;
* **preparo (ETAPA 10):** o IBGE já obrigou isso. Cada preparo é uma linha,
  e `arroz cru` nunca vira `arroz cozido`.

## 5. O que falta para destravar

1. **Autorização da USP/FoRC**, ou a decisão de que TACO + IBGE bastam.
2. **Um ambiente com saída de rede**, ou a planilha/arquivo da TBCA
   entregue direto, como foram a TACO e a do IBGE. Se existir exportação
   oficial em arquivo, ela é melhor que scraping por qualquer critério —
   e é a primeira coisa a procurar na página.

Com a fonte em mãos, as ETAPAS 6 a 29 (parser, normalização, validação,
CSV, JSON, relatórios, schema, upsert, dry-run, testes, auditoria por
código) são trabalho direto: o extrator do IBGE em
`nutri/scripts/extrair-ibge.py` já segue essas regras, incluindo o `null`
para ausência e a preservação do código de origem.

## 6. O que NÃO foi feito, para não restar dúvida

* nenhum crawler foi escrito;
* nenhuma requisição foi feita à TBCA;
* nenhum HTML da TBCA foi presumido;
* nenhuma tabela foi criada no Supabase;
* nada da estética ou da navegação do app foi tocado (ETAPA 30).
