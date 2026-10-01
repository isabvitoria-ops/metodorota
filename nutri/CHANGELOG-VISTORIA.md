# Changelog de vistoria — Gasto calórico e antropometria

Para a Isabela conferir item por item **antes de usar com paciente**. Nada aqui está
"validado": "em vistoria" quer dizer que o código bate com a especificação do DietSystem
e, onde indicado, com a fonte primária. Cada equação, na calculadora, mostra a fonte, a
fórmula, a conta com os números do paciente e o selo **em vistoria**.

Como conferir uma equação: abra *Composição corporal → Gasto energético*, escolha a
equação, digite os dados do vetor e compare com o valor esperado abaixo.

## Etapa 1 — Motor + gasto (01/10/2026)

### Mudanças que alteram o que a tela fazia antes (destrutivas)
| O que mudou | Antes | Agora | Por quê |
|---|---|---|---|
| Painel "Gasto energético" | 4 linhas fixas (Mifflin, Harris-Benedict, Cunningham, FAO/OMS) | Categoria → equação, com "Como este cálculo é feito" e comparação | Spec: motor orientado a dados, fórmula + substituição visíveis |
| Fator de atividade e MET | só fator; sem MET | **duas opções que não se misturam**: fator, ou sedentário (1,2) + exercícios por MET líquido | Evitar a atividade contada duas vezes (defeito do DietSystem) |
| Harris-Benedict | só a revisão de 1984, sem avisar | as duas (1919 e 1984), separadas | Spec lista as duas |
| Aviso de validade | só "menor de 18" | idade e IMC fora da faixa de cada equação avisam; total absurdo (< 600 ou > 6000 kcal) avisa | Spec: guardas clínicas |

### Regras de composição (para conferir)
- Equações que devolvem **GEB** (Mifflin, Harris-Benedict, Schofield, Henry & Rees, Cunningham,
  Katch-McArdle, Ten Haaf, Tinsley, Horie, FAO/OMS): `GET = GEB × fator`.
- Equações que **já devolvem o total** (DRI 2023, EER/IOM, IOM obesidade): o nível de
  atividade entra **dentro** da fórmula; não se multiplica de novo.
- Modo **MET**: base sedentária (GEB × 1,2, ou o nível sedentário da fórmula) **+** exercícios.
  MET líquido: `kcal/dia = (MET − 1) × peso × (min ÷ 60) × (vezes/semana ÷ 7)`.
  A versão bruta (MET, sem o −1) é a do DietSystem e conta o repouso de novo.
- O fator 1,2 já inclui o movimento do dia a dia; o MET entra só para exercício de verdade.

### Equações implementadas (todas "em vistoria")
| Equação | Fonte | Vetor para conferir | Esperado |
|---|---|---|---|
| Mifflin-St Jeor 1990 | Mifflin et al., Am J Clin Nutr 1990;51:241 | F, 21 a, 77,05 kg, 158 cm | GEB 1492; ×1,55 = 2312,6 |
| Harris-Benedict 1984 | Roza & Shizgal, 1984 | F, 21 a, 90 kg, 178 cm | GEB 1740,34 |
| Harris-Benedict 1919 | Harris & Benedict, 1919 | idem | GEB 1746,84 |
| DRI 2023 19+ | NASEM 2023 | F, 21 a, 90 kg, 178 cm, pouco ativo | 2695,96 |
| DRI 2023 3 a 18 | NASEM 2023, tab. S-3 | F, 15 a, 55 kg, 160 cm, pouco ativo | 2222,06 |
| EER/IOM 2005 adulto | IOM 2005 | F, 21 a, 90 kg, 178 cm, PA 1,12 | 2599,7 |
| Schofield 1985 | FAO/WHO/UNU 1985 | F, 21 a, 90 kg | 1820,22 |
| Henry & Rees 1991 | Eur J Clin Nutr 1991;45:177 | F, 21 a, 90 kg | 1625,2 |
| Cunningham 1980 | Am J Clin Nutr 1980;33:2372 | MM 50,5 kg | 1611 |
| Katch-McArdle 1996 | Exercise Physiology | MM 50,5 kg | 1460,8 |
| Ten Haaf 2014 (MM e peso) | PLoS ONE 9(9):e108460 | F, 21 a, 90 kg, 178 cm, MM 50,5 | MM 1634,2; peso 1978,97 |
| Tinsley 2019 (MM e peso) | Appl Physiol Nutr Metab 44(4):397 | MM 50,5 / peso 90 | 1591,95 / 2242 |
| IOM/DRI 2005 obesidade | IOM 2005 tab. 5-23/5-24 | F, 21 a, 90 kg, 178 cm, PA 1,16 | 2749,3 |
| Horie-Waitzberg-Gonzalez 2011 | Horie et al., 2011 | peso 90, MM 50,5 | 1759,6 |
| FAO/OMS 1985 (extra, mantida) | manual CEPRAN | F, 21 a, 90 kg | 1819 |
| MET | Compêndio de Atividades Físicas | MET 8, 77,05 kg, 60 min, 3×/sem | bruto 264,2; líquido 231,2 |

### Conferido contra a fonte primária (PubMed)
- **Ten Haaf 2014** (doi:10.1371/journal.pone.0108460): `REE = 95,272·MM + 2026,161` e
  `REE = 49,940·P + 2459,053·E_m − 34,014·I + 799,257·S + 122,502`, em **kJ/dia**; ÷ 4,184 reproduz
  22,771·MM + 484,264 e os coeficientes em kcal usados aqui. Citação correta: **9(9)** (a spec dizia
  9(10); o DietSystem estava certo).
- **RFM / Woolcott 2018** (doi:10.1038/s41598-018-29362-1): `64 − 20×(altura/cintura) + 12×sexo`
  (mulher = 1). Será usada na etapa de antropometria.

### NÃO conferido (precisa da sua vistoria)
- Todos os coeficientes que vêm só da spec do DietSystem (as demais linhas da tabela acima). Em
  especial **Horie-Waitzberg** (o resumo no PubMed não traz os coeficientes), **Henry & Rees** (fator
  239 em vez de 238,85) e **Schofield** (fronteiras de idade: 3, 10, 18, 30, 60 usam a faixa de cima).
- **Schofield ≠ FAO/OMS 1985**: coeficientes diferentes (F 18–30: 14,818·P + 486,6 contra 14,7·P + 496).
  As duas ficam, em categorias separadas.
- DRI 2023 3–18: sem vetor observado na spec; o valor esperado acima é conta à mão.

### Aguardando fonte (não calculam — não se inventa coeficiente)
| Equação | O que falta |
|---|---|
| DRI 2023 - 0 a 2 anos | tabela da NASEM 2023 |
| DRI 2005 - 0 a 3 anos | tabela da IOM 2005 |
| DRI 2005 - 3 a 8 anos | tabela da IOM 2005 |
| EER/IOM - 9 a 18 anos | tabela da IOM 2005 |

Os sites oficiais (NASEM, OMS, Compêndio) estão bloqueados no ambiente onde o código é escrito.
Mande os arquivos/tabelas e essas equações entram.

### Próximas etapas
2. Gestantes, lactantes e fator de injúria · 3. Dobras (protocolos que faltam) e protocolos de
obesidade (Weltman, Lahav, Woolcott, US Navy) · 4. Circunferências, RCQ (Bray & Gray), diâmetros e
fracionamento · 5. Bioimpedância e estimativas de peso/estatura · 6. Pediatria (curvas OMS) ·
7. Bolso e VENTA com guardas.

## 01/10/2026 — Lista de METs (planilha da nutricionista)
- `motor/met-dados.mjs`: 602 atividades, na ordem da planilha `tabela_met_dietsystem.xlsx`, nomes
  como vieram (inclusive erros de digitação do original). Status: em vistoria — o MET de cada item
  é o da planilha; conferir amostras contra o Compêndio oficial.
- Tela de gasto, modo "Sedentário + exercícios": o nome da atividade tem busca (lista de 602) e
  escolher um item preenche o MET (editável). Conta continua LÍQUIDA (MET − 1).
- Vetor da spec: pular corda 12 MET, 70 kg, 60 min × 3/sem = 360 kcal/dia na conta BRUTA
  (a do DietSystem); líquida = 330 kcal/dia.

## 01/10/2026 — Etapa 2 do gasto energético (documento `prompt_code_antropometria_gasto_energetico.docx`)
Catálogo completo: **28 equações** (as do DietSystem). 24 calculam; 4 seguem "aguardando fonte".

Entraram (todas "em vistoria"):
- **EER/IOM 9-18 anos** e **DRI 2005 3-8 anos** (menina e menino, 4 níveis de PA). Vetor medido no
  DietSystem: menina 22 a, 170 cm, 70 kg, PA 1,00 = 1.771 kcal ✔. Menino e 3-8 anos vêm da literatura
  (o documento diz isso): sem conferência independente.
- **DRI 2005 0-3 anos** (EER por meses: +175 / +56 / +22 / +20). Pede a idade em MESES.
- **Gestante 19+ (IOM)**: EER adulta feminina + 0 / 340 / 452 por trimestre. Vetor ✔ 2.091 / 2.431 / 2.543.
- **DRI 2023 Gestante**: fórmula por nível + 9,16×SG + deposição pelo IMC pré-gestacional
  (+300 / +200 / +150 / −50). Só 2º e 3º trimestres (SG ≥ 14); no 1º a tela explica o que usar.
- **Lactante DRI 2023, 19+**: mulher adulta + 400 (1º semestre) ou + 380 (2º). Vetor ✔ 2.623 / 2.603.
- **Regra de bolso**: 20-25 kcal/kg (perder), 30-35 kcal/kg (ganhar) — 70 kg: 1.400-1.750 / 2.100-2.450.

DIVERGÊNCIAS / O QUE FICA PARA CONFERIR NA FONTE (nada foi escolhido em silêncio):
1. **DRI 2023 Gestante: qual peso é o "P"?** O documento só diz "P (kg)". Usei o peso ATUAL informado.
   Se a NASEM define P como peso pré-gestacional, o resultado muda. Conferir.
2. **Acréscimos de lactação (+400/+380) e de gestação IOM (+340/+452)** foram INFERIDOS pelo
   documento a partir de testes no DietSystem. Conferir na publicação.
3. **Lactante e gestante de 14-19 anos**, e **DRI 2023 0-2 anos**: o documento não traz as fórmulas.
   Continuam sem calcular (3 + 1 equações). Precisam das tabelas da NASEM/IOM.
4. **Fator de injúria**: o documento não traz valores (só diz que não existe na calculadora). Não implementado.
5. DRI 2005 0-3: o piso de digitação do peso passou a 2 kg quando a idade está vazia ou < 10 anos.
