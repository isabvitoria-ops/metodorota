# Documento de inspiração — para o Claude do navegador

Isabela: cole **tudo** o que está abaixo na conversa do Claude (extensão do
Chrome), e no fim diga qual app quer que ele olhe (ex.: "olhe o DietSystem
em my.dietsystem.com.br"). O documento tem duas partes: as **instruções**
(como ele deve explorar e o que trazer) e o **inventário** (tudo o que meu
app já tem, para ele não perder tempo com o que já existe).

Sempre que eu mudar o app, o Claude Code atualiza a Parte 2 aqui. Se a data
lá embaixo estiver velha, peça a ele para atualizar antes de usar.

---

## PARTE 1 — Instruções para o Claude (cole isto)

Você é meu explorador de inspiração. Vou te apontar um aplicativo de
nutrição concorrente ou de referência. Sua tarefa **não** é me listar tudo o
que ele tem — é encontrar o que **agrega ao MEU app** e que eu **ainda não
tenho**. O inventário do que já tenho está na Parte 2, abaixo. Leia-o antes
de começar e trate tudo que estiver lá como "já existe, não me traga".

Regras de exploração — siga à risca, porque é aqui que você costuma falhar:

1. **Entre em TODAS as abas e cantos, inclusive os escondidos.** Menus de
   três pontinhos, abas laterais, "Extras", "Arsenal da Nutri", áreas de
   configuração, telas que só aparecem depois de clicar em algo. Não
   presuma o conteúdo de uma aba pelo nome dela — abra e olhe.
2. **Assista aos vídeos e veja as imagens.** Se há vídeo demonstrando um
   recurso, ele existe para mostrar algo que o texto não mostra. Não pule.
3. **Clique de verdade nos botões e fluxos.** Crie um paciente de teste,
   monte uma dieta de teste, gere um relatório de teste. Um recurso só se
   entende usando.
4. **Não me traga o que eu já tenho.** Antes de escrever cada ideia,
   confira na Parte 2. Se já está lá, descarte em silêncio — não gaste
   linha me dizendo "você já tem X".
5. **Priorize pelo meu contexto**, não pelo que é chamativo. Eu sou
   nutricionista com foco em **saúde gastrointestinal** (SII, FODMAP,
   reintrodução alimentar, sintomas × alimentos). Método próprio chamado
   **ROTA** (Rastreio · Organização · Teste · Autonomia). Atendo por
   acompanhamento contínuo, não consulta avulsa. O que serve a esse
   perfil vale mais do que recurso genérico.

Formato da resposta — para cada ideia que passar no filtro:

- **O que é** (1–2 linhas).
- **Onde vi** (aba/tela do app que você explorou).
- **Por que agregaria ao meu**, dado meu foco em GI e método ROTA.
- **Esforço x retorno** (baixo/médio/alto para construir, e o quanto muda
  minha rotina ou a experiência da paciente).
- **Como eu levaria isso pro meu jeito** (não copiar igual — adaptar).

No fim, ordene as ideias da mais vale-a-pena para a menos, e seja honesto
quando algo que parece legal **não** cabe no meu foco (diga por quê). Não
invente recurso que você não viu de fato. Se não conseguir acessar uma
área (login, vídeo que não abre), diga qual ficou de fora em vez de
adivinhar o conteúdo.

---

## PARTE 2 — Inventário do meu app (o que JÁ existe)

> Atualizado em: **2026-10-01**
> Meu app: **Central do Paciente** (site em
> `isabvitoria-ops.github.io/metodorota`) + uma **Calculadora** separada em
> `.../metodorota/nutri/`. Banco no Supabase. Método **ROTA**.

O app tem **dois lados**: o que a **paciente** vê e a **Área da nutri** (só
eu). Mais a calculadora, que é uma ferramenta à parte para montar dieta e
fazer contas.

### A. O que a paciente vê (a "Central")

- **Tela inicial** com atalhos, frase e lema configuráveis por mim.
- **Trocas inteligentes**: a paciente escolhe um alimento e vê por quanto
  de outro ele pode ser trocado, com a gramatura calculada (igualando por
  kcal, proteína, carbo ou gordura).
- **Substituições por grupo**: listas de equivalência que eu monto
  (ex.: "pães", "frutas").
- **Comer fora**: guia de opções por categoria e por estabelecimento/
  restaurante, montado por mim.
- **Protocolo do método** (as etapas do ROTA para aquela paciente).
- **Avaliação física**: ela vê a evolução das avaliações (peso, medidas,
  composição corporal) em gráfico.
- **Evolução do treino** (gráficos de carga/volume).
- **Metas da semana**: o que eu defini, e ela acompanha.
- **Documentos**: arquivos que libero para ela.
- **Desafio** (gamificação): ações da semana que valem pontos, ranking,
  indicação de amiga com escada de recompensas, e **cupons** de marcas
  parceiras. (Já **não** tem mais "enviei meu diário alimentar".)
- **Rastreabilidade / Reintrodução**: ela registra alimento × sintoma ao
  longo do tempo — o coração do meu método para SII/FODMAP.
- **Exames**: ela envia PDF/foto de exame para um cofre privado, e vê os
  que eu guardei.
- **Check-in / Questionários**: responde questionários que eu criei
  (semanais, etc.), passo a passo.
- **Busca global** dentro do app. (A aba **Salvos** foi retirada em 01/10: as pacientes não usavam.)
- **Diário de fotos** da refeição (a paciente registra, a nutri curte; sem comentário).
- **Conversa por refeição** ligada à Rastreabilidade.
- **Meus pontos mês a mês** (evolução, posição no mês) dentro do Desafio.
- **Nome e ícone na tela inicial**: "Protocolo Nutricional", com o monograma.
- **Tela de diagnóstico** pública (`/diagnostico`) que mostra papel,
  situação de acesso e se o banco respondeu — para eu depurar do lado dela.
- **Conta**: entrar, definir/recuperar senha, aviso de acesso encerrado
  com meu WhatsApp.

### B. A Área da nutri (só eu)

- **Pacientes** (lista + ficha): junta painel, acompanhamento e cadastro.
  A ficha tem abas: **Consulta**, **Resumo** (peso no tempo, metas ativas),
  **Check-in**, **Exames**, **Cérebro** (ver adiante), **Histórico** (linha
  do tempo de consultas/metas/avaliações), **Carta de encaminhamento** e
  "o que ela vê no app".
- **Cadastro de paciente**, plano, datas, status (ativo/suspenso/expirado),
  convite por e-mail, renovação — tudo com histórico administrativo.
- **Check-in**: crио questionários reutilizáveis (modelos), com **gráfico
  por pergunta** e revisão das respostas.
- **Treino**: monto o treino, ou libero a paciente para escrever o dela;
  cardio e metas de treino.
- **Cobrança**: financeiro completo — valores por paciente, geração de
  cobranças por competência, baixa, recebimentos, **balanço** mensal,
  **lembrete automático de cobrança por WhatsApp e e-mail**, chave PIX.
- **Protocolo**: monto o protocolo do método por paciente; avaliação física
  com os **13 protocolos de dobras** (mostra só as dobras do protocolo
  escolhido) e grava qual foi usado.
- **Metas** por paciente e por semana.
- **Equivalências** e **Alimentos** (cadastro do banco de alimentos).
- **Conteúdos** (materiais/guias que libero).
- **Desafio**: o desafio do mês nasce sozinho; lanço pontos até 7 dias depois
  do fim do mês; registro indicação por uma paciente; histórico mensal com
  placar em PDF e texto de WhatsApp; limpeza de pontos antigos a cada 3 meses.
- **Rastreabilidade**: vejo o mapa de alimento × sintoma da paciente,
  registro retroativo, marcações minhas, painel de padrões.
- **Configurações**: nome da Central, frases, WhatsApp, dias de aviso de
  vencimento, PIX, cupons; **backup** (baixar/restaurar); carimbo de versão.
- **Cérebro do Nutri** (novo): minha base de conhecimento privada. Subo PDF
  ou colo texto (artigos, protocolos), e na ficha da paciente eu pergunto e
  o app traz os trechos do meu material com **citação**, e eu aceito/edito/
  rejeito a conduta, que fica no histórico daquela paciente. (Busca por
  palavra já funciona; busca por sentido com IA entra quando eu ligar as
  chaves.)

### C. A Calculadora (`/nutri/`) — ferramenta à parte

- **Montagem de dieta** por refeições, com **opções por refeição**
  (Principal, Opção 2, 3…). Cada opção pode ter substitutos por alimento,
  com gramatura calculada sozinha igualando por kcal/macro. Ao montar uma
  opção secundária, o rodapé mostra a **Referência** (macros da Principal)
  e a **Diferença**, para bater os macros.
- **Bancos de alimentos**: TACO, TBCA, USDA e "Meus alimentos"
  (cadastro meu), com tratamento de "traço" (Tr) e valores ausentes.
- **Cálculo de gasto energético**: 28 equações do DietSystem (24 calculam; 4
  aguardam fonte), com "como este cálculo é feito"; atividade por fator OU por
  MET líquido (602 atividades com busca); regra de bolso e VENTA. Gestantes,
  lactantes e infantil estão feitos, mas ficam parados até haver paciente.
- **Composição corporal / dobras**: os protocolos de avaliação física.
- **Fichas** salvas por paciente, **backup** (baixar/restaurar/apagar).
- **Grupos favoritos** de alimentos para inserir de uma vez.
- **Modelos de refeição**.

### D. Coisas que eu conscientemente NÃO quero (já avaliei e descartei)

Não me traga estas de volta como novidade:

- **Diário alimentar com comparação ao plano** — descartado; o Diário de fotos
  existe, mas só registra e recebe curtida (sem comentário nem conferência).
- **Recordatório alimentar como ação do desafio** — removido.
- **Recursos "por completude"** (ter porque o concorrente tem). Só entra o
  que passa pelo meu filtro de método e foco em GI.

### E. Meu foco, para calibrar o que agrega

- Nutrição com foco em **saúde gastrointestinal**: SII, FODMAP, intolerâncias,
  reintrodução alimentar, relação sintoma × alimento.
- Método próprio **ROTA**: Rastreio · Organização · Teste · Autonomia.
- Modelo de trabalho: **acompanhamento contínuo**, não consulta avulsa.
- Uso pessoal por mim (não sou técnica); a paciente usa pelo navegador.

---

**Fim.** Cole tudo isto no Claude do navegador e complete com: "agora olhe
o [nome/URL do app] e me traga só o que agrega e que eu ainda não tenho,
seguindo as regras acima."
