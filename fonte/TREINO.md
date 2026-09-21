# FASE 0 — auditoria, antes de escrever uma linha

O pedido foi explícito: analisar primeiro, dizer o que já existe e o que
será reutilizado, e só então implementar. Este arquivo é esse relatório, e
vai sendo atualizado a cada fase.

## O que o aplicativo é hoje

| camada | o que é |
|---|---|
| front | Vite 5 + React 18 + TypeScript estrito, react-router v6. Sem framework de componente — o CSS é próprio |
| dados | Supabase (Postgres). **28 tabelas**, RLS em todas |
| acesso | funções `security definer` guardadas por `e_admin()` e `meu_paciente_id()` |
| leitura/escrita | tudo passa por uma interface `Repositorio`, com duas implementações: `repositorioSupabase` e `repositorioLocal` (a demonstração) |
| publicação | build de arquivo único (~1,24 MB) servido pelo GitHub Pages |

## O que JÁ existe e vai ser reutilizado

**Impressão e PDF.** Existe, e funciona: `RastreioAlimentar.tsx` chama
`window.print()`, e o `@media print` do `central.css` tira do fluxo o que não
vai para o papel — de propósito, porque esconder por visibilidade deixava o
espaço ocupado e rendia uma segunda página em branco no arquivo salvo.

**Não há biblioteca de PDF, e não vai haver.** Um gerador em JavaScript
custaria centenas de kilobytes no celular dela para produzir o que o próprio
navegador já produz — e produziria pior: o "Salvar como PDF" do sistema
respeita a fonte, a quebra de página e a impressora de verdade. A Central de
Documentos usa o caminho que já está de pé.

**Gráfico.** Passou a existir agora, na avaliação física:
`utils/evolucaoAvaliacoes.ts` calcula os pontos e a tela desenha um `<svg>` à
mão. É a base para os gráficos de carga e de repetições — sem dependência
nova.

**Desenho de tela.** `c-bloco`, `c-secao`, `c-destaques`, `c-tabela-medidas`,
`c-linha-tempo`. Toda cor é variável CSS no bloco `.central`. Nada de paleta
nova para o treino: um módulo com cor própria pareceria um aplicativo
diferente colado dentro deste.

**Padrão de acesso.** `e_admin()` para ela, `meu_paciente_id()` para a
paciente, `security definer` com `search_path = public`, e uma bateria de
testes em `supabase/testes/` que roda num Postgres limpo antes de qualquer
coisa subir. Toda tabela nova entra por aí.

## O que NÃO existe, e portanto é estrutura nova

* **nenhuma tabela de treino, cardio ou meta.** Das oito estruturas do
  pedido, oito são novas. Não há o que ampliar: não existe nada parecido;
* **nenhum Storage.** O aplicativo não guarda arquivo nenhum hoje — não há
  bucket, não há upload. A importação do treino em PDF (FASE 5) precisa
  disso criado do zero, com política de acesso própria;
* **nenhum asset de marca.** O `public/favicon.svg` é um ícone genérico
  (um quadrado roxo com barras), não a logo dela. A logo oficial ainda não
  está no projeto.

## O que trava agora

~~**A FASE 1 depende do arquivo da logo.**~~ **Resolvido.** Ela conectou o
Google Drive e a arte veio de lá, do manual da designer — em vetor,
extraída do próprio PDF de entrega. Ver `src/central/marca/LEIA-ME.md`.

**A FASE 5 depende de decidir onde o PDF do treino é lido.** Este ambiente
não alcança a internet, e a extração de PDF no navegador precisa de uma
biblioteca (pdf.js, ~300 KB). É decisão de peso do pacote contra comodidade,
e fica para quando as fases anteriores estiverem de pé.

## FASE 2 — feita

O que entrou:

* **banco**: `treinos`, `treino_exercicios` (o plano) e `treino_sessoes`,
  `treino_series` (o realizado). Quatro tabelas, RLS em todas, oito funções
  `security definer`. **40 verificações de acesso** novas na bateria
  `05_treino.sql`, incluindo as duas portas que importam: pedir a lista de
  outra paciente pelo id (recusado com 42501) e registrar na ficha de outra
  mandando o id dela (grava na de quem chamou, não na dela);
* **regra**: `utils/progressaoTreino.ts`, com o teste obrigatório do
  enunciado — 60×6, 60×7, 60×8, 60×10, 62×6, 62×7 → +1, +1, +2, carga, +1 —
  e um teste que varre as mensagens procurando verbo de prescrição
  ("use", "tente", "aumente", "reduza", "recomendo"). Se algum dia alguém
  escrever uma sugestão de carga numa mensagem, esse teste quebra;
* **tela da paciente** (`/evolucao`): card educativo, plano do dia,
  registro por série, e um histórico por exercício com o que mudou;
* **tela dela** (`/admin/treinos`): monta o plano, e lê a evolução da
  paciente na aba ao lado.

O que NÃO entrou, de propósito, porque é fase seguinte: cardio, metas,
gráficos e importação de PDF.

## FASE 3 — feita

**Cardio** é registro da paciente: ela anda, ela anota. Tipo, minutos,
distância e intensidade — os dois últimos opcionais e **nulos** quando em
branco, porque a bicicleta da academia não dá distância e nem toda paciente
tem zona de intensidade. Zero diria que ela andou zero quilômetro.

**Meta** é decisão da profissional. O aplicativo não cria, não ajusta e não
sugere meta. Uma por tipo por semana — duas metas de treino na mesma semana
fariam a tela mostrar "3/4" e "3/5" lado a lado, e nenhuma seria a resposta.

**O progresso não tem tabela.** O desenho original previa
`weekly_goal_progress`; guardado, ele envelheceria — a paciente apaga uma
sessão lançada por engano e o contador continuaria em 3/4. Contado das
sessões, o número é sempre o que está lá, e não existe um segundo lugar para
a verdade morar.

Duas contas que valem a pena registrar: **treino conta DIA** (dois registros
no mesmo dia são um dia de treino, não dois) e **cardio conta MINUTO** (três
caminhadas de dez minutos não valem o mesmo que três de trinta).

A **consistência** são sempre sete quadradinhos, de segunda a domingo: a
régua não pode mudar de tamanho a cada semana, senão comparar uma semana com
a outra deixa de funcionar de olho. E o dia feito não se distingue só pela
cor — ganha borda cheia e texto escuro, que é o que sobrevive a uma
impressão em preto e branco.

## A ordem que está sendo seguida

FASE 0 auditoria ✓ · FASE 1 marca ✓ · FASE 2 treino ✓ ·
FASE 3 cardio e metas ✓ · FASE 4 painéis e gráficos · FASE 5 importar PDF ·
FASE 6 Central de Documentos · FASE 7 PDF do protocolo · FASE 8 PDF da
avaliação · FASE 9 rastreabilidade integrada · FASE 10 revisão.
