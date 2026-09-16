# Arquitetura — Consultório (PWA)

Documento de entrega da refatoração descrita no briefing técnico (nutricionista + app do paciente, protótipo → PWA). Cobre os oito entregáveis do briefing §25: auditoria, lista de problemas priorizada, justificativa das alterações, arquitetura nova, arquivos criados, alterações feitas, e confirmação de paridade funcional.

> Este documento descreve o *código*, não o produto. Para as regras de negócio inegociáveis, ver o Anexo do briefing original — nenhuma delas foi alterada aqui; a seção "Confirmação de paridade" no fim lista onde cada uma está implementada.

---

## 1. Auditoria do código de partida

Os dois arquivos-fonte (`app-paciente.jsx`, ~2.260 linhas; `painel-nutricionista.jsx`, ~1.100 linhas) eram protótipos de validação de produto, não código de produção — e cumpriram bem esse papel: a lógica clínica estava correta, a identidade visual estava definida, os fluxos faziam sentido. Os problemas eram todos estruturais:

| # | Achado | Evidência |
|---|---|---|
| A1 | Toda tela, modal e dado de exemplo em dois arquivos únicos | `app-paciente.jsx` continha 14 componentes de tela/modal + 20 constantes de dados no mesmo escopo de módulo |
| A2 | Estado local espalhado, sem store central | `AppPaciente` tinha 19 `useState` próprios; `unidade`, `trocas`, `avisar` desciam manualmente por várias camadas de props |
| A3 | Dado de exemplo == estrutura de domínio | `PLANO`, `FICHAS`, `PACIENTES` eram literais de objeto sem separação entre "forma dos dados" e "dados de exemplo" |
| A4 | Sem camada de serviço | Componentes liam constantes globais diretamente; não havia um ponto único para trocar "mock" por "API real" |
| A5 | Parser de importação frágil | `parsePlano` (regex sobre texto colado) sem tipo de retorno estável, sem teste, sem tratamento de erro além do "não reconheceu" |
| A6 | Zero TypeScript | Nenhum contrato de tipo; `Alimento`, `Paciente`, `CheckIn` etc. eram só a forma implícita dos literais |
| A7 | Zero estado de carregamento/erro | Todo dado era síncrono (mock), então nenhuma tela sabia lidar com "carregando" ou "falhou" |
| A8 | `localStorage`/`IndexedDB` ausentes | Restrição do ambiente de protótipo — nada persistia entre recarregamentos |
| A9 | Login decorativo | Qualquer e-mail com "@" e senha com 4+ caracteres entrava; um e-mail hardcoded simulava conta desativada |
| A10 | Sem PWA | Sem manifest, sem service worker, sem instalabilidade |
| A11 | Viewport fixo em celular | CSS assumia `max-width: 430px` (paciente) / `1080px` (painel) sem estratégia de tela larga |
| A12 | Contraste `--ink-3` sobre `--paper` | 2.97:1 medido (WCAG AA exige 4.5:1 para texto normal) — token de marca existente no protótipo, não introduzido por esta refatoração |

Nenhum desses pontos é um erro de lógica clínica. É exatamente o que a seção 7 do briefing já esperava encontrar.

---

## 2. Lista de problemas priorizada (o que foi resolvido, em ordem)

1. **Sem tipos → tipos primeiro.** Todo o domínio (`src/types/`) foi modelado antes de qualquer componente, porque toda decisão depois (services, hooks, mocks, telas) depende dele.
2. **Dado de exemplo == estrutura → separação em camadas.** `data/mocks/` (fixtures tipados) → `repositories/` (uma função por operação) → `services/` (regra de negócio) → `hooks/` (ponte pra tela). Trocar por Supabase é reescrever só `repositories/`.
3. **Prop drilling → Zustand + Context.** `store/uiPacienteStore.ts` (abas, modais, badges) e `store/checkinHojeStore.ts` (ver §7, achado durante a verificação) substituem o que descia por props manualmente; `FichaPacienteContext` cobre o único caso realmente hierárquico (painel, ficha de um paciente aberta).
4. **Zero estado de carregamento → `Estado<T>` em todo lugar.** `hooks/useAsync.ts` converte toda chamada de serviço em `{carregando|erro|pronto}`; `components/ui/EstadoAsync.tsx` (+ `Skeleton`, `EstadoErro`, `EstadoVazio`) é o único jeito de renderizar isso.
5. **Login decorativo → autenticação real contra dados de domínio.** `authService` valida e-mail contra pacientes/nutricionista de verdade e respeita `paciente.ativo` (regra #8/#14); sessão persistente em localStorage (proxy do refresh token do Supabase Auth real); MFA real para a nutricionista em dispositivo novo (regra §5, exceção deliberada).
6. **Sem persistência offline → fila IndexedDB no check-in.** `lib/db.ts` (Dexie) + `checkinSyncService` — grava local primeiro, nunca bloqueia esperando rede (regra §10), sincroniza quando volta a conexão.
7. **Sem PWA → manifest + service worker + ícones reais**, com estratégia de cache diferenciada por sensibilidade de dado (briefing §16): estático agressivo, dado clínico nunca em cache.
8. **Viewport fixo → responsivo.** `.phone` ganha moldura e respiro em telas largas; painel ganha terceira coluna de grid acima de 1280px.
9. **Parser frágil → mantido frágil de propósito, mas isolado e testável.** `services/planoParserService.ts` é uma função pura (texto → rascunho tipado) que qualquer teste unitário futuro pode chamar sem montar um componente. O comportamento (bloquear publicação com item pendente, regra #9) foi preservado e verificado rodando.
10. **Contraste `--ink-3`** — documentado (achado A12), **não alterado**: mudar um token de paleta é decisão de design, fora do escopo de uma refatoração de arquitetura que tem instrução explícita de não alterar identidade visual (briefing §6). Fica registrado aqui para a nutricionista/designer decidir.

---

## 3. Justificativa das decisões de arquitetura

**Por que camadas `repositories/` → `services/` → `hooks/` → componente, em vez de os componentes chamarem os dados direto?**
Porque essa é a única forma de trocar "mock" por "Supabase real" sem reescrever tela nenhuma. Cada `repository` tem uma função por operação (`buscarPacientePorId`, `salvarCheckin`...) que hoje lê `repositories/mockDb.ts` (um "banco" em memória, clonado dos fixtures) e devolve `Promise<T>` — a mesma forma que uma chamada Supabase teria. `services/` é onde mora regra de negócio que não é "ler ou escrever uma linha" (o motor do montador, o parser, a decisão de alerta clínico, a "faixa de incômodo" do questionário). `hooks/` é a única ponte para React — cada hook devolve `Estado<T>` mais as ações que a tela precisa, e é aí que a store de UI (`uiPacienteStore`) entra quando o estado precisa ser visível em mais de um componente ao mesmo tempo.

**Por que Zustand em vez de só Context, ou só prop drilling?**
Briefing §9 já pede essa divisão: Context só onde o escopo é hierárquico de verdade (a ficha de um paciente aberta no painel — `FichaPacienteContext`), Zustand para o resto (aba ativa, modal aberto, badge de não lidas, preferência de unidade). A prova de que a escolha certa foi cross-cutting e não hierárquico apareceu na prática: `useCheckin` é chamado por `Hoje.tsx` **e** por `AppPaciente.tsx` ao mesmo tempo — sem um estado compartilhado (`checkinHojeStore`), a atualização otimista feita a partir de um not aparecia no outro (bug real, encontrado e corrigido durante a verificação — ver §7).

**Por que TACO fica em dois arquivos (`tacoRaw.ts` + `taco.ts`)?**
`tacoRaw.ts` é o array de 591 tuplas copiado literalmente do protótipo (sem risco de erro de transcrição). `taco.ts` faz a única transformação necessária (tupla → `Alimento` tipado) uma vez, no load do módulo. Não existe uma camada `models/` separada porque não havia necessidade real de mapear "linha de banco → tipo de app" em mais de um lugar — criar a pasta só para bater com a estrutura do briefing seria abstração prematura (instrução explícita do projeto: não introduzir abstração além do que a tarefa pede).

**Por que a base TACO (`alimentoRepository`/`alimentoService`) é um caminho de import separado de `fichaAlimentoRepository`/`fichaAlimentoService`?**
Regra #1/#2 (inegociável): o paciente nunca pode ver valor nutricional numérico, e a base completa é uso interno da nutricionista. Separar os arquivos torna essa regra visível no import: qualquer tela do paciente que tentasse `import { alimentoService } from "@/services"` e usar dado nutricional é um code smell fácil de pegar em review, porque o padrão do projeto é que o paciente só fala com `fichaAlimentoService` (nome, tags, texto educativo — nunca kcal/proteína/etc.).

**Por que o parser de importação (`planoParserService`) não foi "melhorado" além do porte?**
Porque o briefing pede portar a lógica clínica sem reinventá-la — o parser é regra de produto (o formato que a nutricionista já usa no Notion), não bug de arquitetura. O que mudou é que ele virou uma função pura, testável, com tipo de retorno estável (`RefeicaoRascunho[]`), em vez de estado dentro de um componente de 300 linhas.

**Por que MFA foi implementado agora, e não deixado só de arquitetura?**
Porque o briefing §5 é explícito: sessão persistente é a exceção clara para paciente, mas para a nutricionista o MFA continua sendo regra ativa, não um "preparar para depois". Implementá-lo de verdade (ainda que com verificação de código mockada — `mfaService.verificarCodigo` aceita qualquer código de 6 dígitos, documentado como o ponto de troca para Supabase Auth MFA real) evita que o dia da integração Supabase precise redesenhar o fluxo de login inteiro.

---

## 4. Arquitetura nova, em uma passada

```
src/
  app/              # App.tsx (rotas), Login.tsx, Mfa.tsx, paciente/AppPaciente.tsx, nutricionista/AppNutri.tsx
  components/
    ui/             # Primitivos compartilhados: Sheet, Chip, Btn, Card, Switch, Tag, Toast, EstadoAsync, Fita, DesenhoBristol
    patient/        # Telas do paciente: Hoje, Plano, Diario, Evolucao, Feed
    nutri/          # Telas do painel: Dashboard, ListaPacientes, PainelFeed, PainelBase, PainelBiblioteca
    nutri/ficha/    # As 6 abas da ficha de um paciente
  modals/patient/   # CheckIn, Montador, Chat, Fotos, Perfil, Biblioteca, Questionario, Lembretes, Ficha
  hooks/            # Uma ponte por domínio entre services e componentes (usePlano, useCheckin, useChat...)
  store/            # Zustand: authStore, uiPacienteStore, checkinHojeStore, toastStore
  contexts/         # FichaPacienteContext (único caso hierárquico real)
  services/         # Regra de negócio: planoService, montadorService, checkinService, alertaService...
  repositories/     # Uma função por operação, hoje sobre mockDb.ts — é aqui que Supabase entra depois
  types/            # Todo o contrato de domínio (ver §23 do briefing)
  utils/            # Formatação de quantidade/data, busca fuzzy, device id
  constants/        # Bristol, sintomas, adesão, cores por refeição, textos fixos
  data/
    taco.ts / tacoRaw.ts   # Base TACO (591 itens), tipada
    mocks/                 # Fixtures — hoje alimentam mockDb.ts; amanhã viram seed de banco real
  lib/db.ts         # IndexedDB (Dexie) — fila offline-first do check-in
  styles/           # tokens.css, reset.css, patient.css (.app-root), nutri.css (.root)
public/
  icons/, favicon.svg, robots.txt
vite.config.ts      # Vite + vite-plugin-pwa (manifest + service worker + cache por sensibilidade)
```

**Fluxo de uma tela típica:** componente → `hooks/useX` → `services/xService` (regra de negócio) → `repositories/xRepository` (uma operação) → `repositories/mockDb.ts` (hoje) ou Supabase (amanhã, trocando só o repository).

**Roteamento:** `/login` (implícito — tela de login quando não há sessão) → `/paciente/*` ou `/nutricionista/*`, decidido pelo papel da sessão. Cada app gerencia sua própria navegação por abas internamente; não há sub-rotas por tela (não era um requisito do briefing e o protótipo também não tinha esse conceito). `AppPaciente`/`AppNutri` carregam via `React.lazy` — papéis diferentes nunca baixam o bundle um do outro.

**Autenticação:** `authService` (login/logout/sessão) + `mfaService` (MFA da nutricionista) + `useAuth` (ponte pra React, decide `sessao` vs. `aguardandoMfa` vs. `carregando`). Hoje fala com `mockDb`; a assinatura já é a mesma que `@supabase/supabase-js` (`supabase.auth.signInWithPassword`, `getSession`) vai usar.

**Offline-first:** só o check-in tem fila real (`lib/db.ts` + `checkinSyncService`) porque é o único fluxo com requisito explícito de "nunca bloquear esperando rede" (briefing §10 — o paciente registra no banheiro, onde o sinal costuma ser pior). Grava no IndexedDB primeiro, tenta sincronizar na hora se `navigator.onLine`, senão fica pendente até o próximo `sincronizarFilaPendente()` (chamado ao abrir o app e no evento `online` — o fallback manual que o briefing §16 pede para navegadores sem Background Sync API real).

**PWA:** `vite-plugin-pwa` em modo `generateSW`. Cache diferenciado por sensibilidade (briefing §16): fontes e assets estáticos em `CacheFirst`; conteúdo de biblioteca/feed já publicado em `StaleWhileRevalidate`; qualquer chamada a `/rest/v1` ou `/auth/v1` (dado clínico — check-in, chat, plano, fotos) em `NetworkOnly`, nunca em cache.

**Multi-tenant leve (briefing §21):** todo tipo que estende `RegistroDominio` carrega `nutricionistaId` desde a primeira definição de tipo — hoje só existe um valor possível (`NUTRICIONISTA_ID`), mas a coluna já existe. Nenhuma lógica de RLS multi-organização, billing ou onboarding de conta foi construída (instrução explícita: caro e prematuro agora).

---

## 5. Arquivos criados

157 arquivos-fonte em `src/`, mais `public/` (ícones, favicon, robots.txt) e config de projeto (`vite.config.ts`, `tsconfig*.json`, `package.json`). Lista completa por pasta:

<details>
<summary>Ver árvore completa (clique para expandir)</summary>

```
public/favicon.svg
public/icons/icon-192.png
public/icons/icon-512-maskable.png
public/icons/icon-512.png
public/robots.txt

src/app/App.tsx
src/app/Login.tsx
src/app/Mfa.tsx
src/app/nutricionista/AppNutri.tsx
src/app/paciente/AppPaciente.tsx

src/components/nutri/Dashboard.tsx
src/components/nutri/ListaPacientes.tsx
src/components/nutri/PainelBase.tsx
src/components/nutri/PainelBiblioteca.tsx
src/components/nutri/PainelFeed.tsx
src/components/nutri/ficha/AbaAcesso.tsx
src/components/nutri/ficha/AbaAlimentos.tsx
src/components/nutri/ficha/AbaEquivalencias.tsx
src/components/nutri/ficha/AbaMateriais.tsx
src/components/nutri/ficha/AbaPlano.tsx
src/components/nutri/ficha/AbaRegistros.tsx
src/components/nutri/ficha/FichaPaciente.tsx

src/components/patient/Diario.tsx
src/components/patient/Evolucao.tsx
src/components/patient/Feed.tsx
src/components/patient/Hoje.tsx
src/components/patient/Plano.tsx

src/components/ui/Button.tsx
src/components/ui/Card.tsx
src/components/ui/Chip.tsx
src/components/ui/DesenhoBristol.tsx
src/components/ui/EstadoAsync.tsx
src/components/ui/Fita.tsx
src/components/ui/Sheet.tsx
src/components/ui/Switch.tsx
src/components/ui/Tag.tsx
src/components/ui/Toast.tsx
src/components/ui/index.ts

src/constants/adesao.ts
src/constants/alimentos.ts
src/constants/bristol.ts
src/constants/checkin.ts
src/constants/cores.ts
src/constants/evolucao.ts
src/constants/textos.ts

src/contexts/FichaPacienteContext.tsx

src/data/mocks/biblioteca.ts
src/data/mocks/chat.ts
src/data/mocks/checkins.ts
src/data/mocks/diario.ts
src/data/mocks/evolucaoFotos.ts
src/data/mocks/feed.ts
src/data/mocks/fichasAlimento.ts
src/data/mocks/ids.ts
src/data/mocks/index.ts
src/data/mocks/materiais.ts
src/data/mocks/montador.ts
src/data/mocks/pacientes.ts
src/data/mocks/planos.ts
src/data/mocks/preferencias.ts
src/data/mocks/questionario.ts
src/data/taco.ts
src/data/tacoRaw.ts

src/hooks/index.ts
src/hooks/useAsync.ts
src/hooks/useAuth.ts
src/hooks/useBiblioteca.ts
src/hooks/useChat.ts
src/hooks/useCheckin.ts
src/hooks/useDashboard.ts
src/hooks/useDiario.ts
src/hooks/useEvolucao.ts
src/hooks/useFeed.ts
src/hooks/useFicha.ts
src/hooks/useMontador.ts
src/hooks/usePaciente.ts
src/hooks/usePacientes.ts
src/hooks/usePlano.ts
src/hooks/usePreferencias.ts
src/hooks/useQuestionario.ts
src/hooks/useSincronizacaoOffline.ts
src/hooks/useToast.ts

src/lib/db.ts
src/main.tsx

src/modals/patient/Biblioteca.tsx
src/modals/patient/Chat.tsx
src/modals/patient/CheckIn.tsx
src/modals/patient/Ficha.tsx
src/modals/patient/Fotos.tsx
src/modals/patient/Lembretes.tsx
src/modals/patient/Montador.tsx
src/modals/patient/Perfil.tsx
src/modals/patient/Questionario.tsx

src/repositories/alertaRepository.ts
src/repositories/alimentoRepository.ts
src/repositories/bibliotecaRepository.ts
src/repositories/chatRepository.ts
src/repositories/checkinRepository.ts
src/repositories/diarioRepository.ts
src/repositories/evolucaoRepository.ts
src/repositories/feedRepository.ts
src/repositories/fichaAlimentoRepository.ts
src/repositories/index.ts
src/repositories/materialRepository.ts
src/repositories/mfaRepository.ts
src/repositories/mockDb.ts
src/repositories/pacienteRepository.ts
src/repositories/planoRepository.ts
src/repositories/preferenciasRepository.ts
src/repositories/questionarioRepository.ts

src/services/alertaService.ts
src/services/alimentoService.ts
src/services/authService.ts
src/services/chatService.ts
src/services/checkinService.ts
src/services/checkinSyncService.ts
src/services/dashboardService.ts
src/services/diarioService.ts
src/services/evolucaoService.ts
src/services/feedService.ts
src/services/fichaAlimentoService.ts
src/services/index.ts
src/services/materialService.ts
src/services/mfaService.ts
src/services/montadorService.ts
src/services/pacienteService.ts
src/services/planoParserService.ts
src/services/planoService.ts
src/services/preferenciasService.ts
src/services/questionarioService.ts

src/store/authStore.ts
src/store/checkinHojeStore.ts
src/store/index.ts
src/store/toastStore.ts
src/store/uiPacienteStore.ts

src/styles/global.css
src/styles/nutri.css
src/styles/patient.css
src/styles/reset.css
src/styles/tokens.css

src/types/alerta.ts
src/types/alimento.ts
src/types/artigo.ts
src/types/auth.ts
src/types/chat.ts
src/types/checkin.ts
src/types/common.ts
src/types/dashboard.ts
src/types/diario.ts
src/types/evolucao.ts
src/types/feed.ts
src/types/index.ts
src/types/material.ts
src/types/paciente.ts
src/types/plano.ts
src/types/preferencias.ts
src/types/questionario.ts

src/utils/buscaAlimento.ts
src/utils/datas.ts
src/utils/deviceId.ts
src/utils/quantidade.ts
src/utils/tempoRelativo.ts

package.json, tsconfig.json, tsconfig.node.json, vite.config.ts, index.html, .gitignore
```
</details>

---

## 6. Alterações feitas (resumo cronológico dos commits)

1. **Scaffold** — projeto Vite+React+TS+PWA, estrutura de pastas, tipos de domínio completos, CSS/tokens portados literalmente, constantes, utils, base TACO extraída.
2. **Dados** — TACO tipada + todos os fixtures de mock (plano, pacientes, chat, feed, questionário, preferências, check-ins, fotos).
3. **Repositories + services** — camada completa de acesso a dado e regra de negócio sobre o mock.
4. **UI compartilhada + hooks** — primitivos de interface e um hook por domínio.
5. **App do paciente** — todas as telas e modais, verificado rodando.
6. **Painel da nutricionista** — todas as telas, as 6 abas da ficha do paciente, e o dashboard novo (briefing §15).
7. **Roteamento + autenticação** — login real, MFA da nutricionista, sessão persistente, redirecionamento por papel.
8. **PWA + offline** — ícones, manifest, service worker, fila de check-in offline-first, code-splitting; correção de um bug real de estado compartilhado encontrado durante a verificação (ver §7).

Nenhuma tela, modal, ou fluxo do protótipo original foi removido. A única tela nova é o Dashboard (explicitamente pedido no briefing §15, sem equivalente no protótipo).

---

## 7. O que foi verificado rodando (não só compilando)

`tsc --noEmit` limpo e `npm run build` (produção, com o service worker real) não bastam sozinhos para provar que o app funciona — então cada camada grande foi de fato aberta num navegador (Chromium via Playwright) depois de escrita, não só type-checada:

- **App do paciente**: login → Hoje → Plano (refeição expande, cor por refeição, folha de troca) → check-in multi-etapas abre e avança.
- **Painel da nutricionista**: dashboard com dado agregado real (não estático) → lista de pacientes → ficha de Marina → importação de plano colado reconhecendo/sugerindo alimentos da base de 591 itens → calculadora de equivalências com matemática real.
- **Autenticação**: nutricionista pede MFA em dispositivo novo e só entra depois de confirmar o código; paciente entra direto; conta encerrada (`paciente.ativo === false`) é rejeitada com a mensagem certa.
- **Offline**: com a rede desligada de propósito no navegador, o check-in salva no IndexedDB, a tela avisa "salvo neste aparelho, sincroniza sozinho", e ao voltar a conexão o registro sincroniza de verdade (confirmado inspecionando o IndexedDB antes/depois).

Uma rodada de verificação mais ampla depois da entrega inicial (clicando pelas telas que ainda não tinham sido abertas manualmente) encontrou e corrigiu três bugs reais, nenhum deles visível por typecheck ou build:

1. **`useCheckin` com estado local por instância** — a atualização otimista feita a partir do modal de check-in não aparecia na tela Hoje (outra instância do mesmo hook). Corrigido movendo esse estado para `store/checkinHojeStore.ts`, compartilhada entre todas as instâncias.
2. **Badge de mensagem não lida nunca zerava** — `Chat.tsx` chamava `marcarLidas("paciente")` num `useEffect` com deps `[]`, antes de `conversa` (carregado de forma assíncrona) existir; o guard `if (!conversa) return` dentro de `marcarLidas` fazia a chamada virar no-op silencioso toda vez. Corrigido disparando a chamada só quando `conversa` fica disponível (com guarda por `useRef` pra não repetir). Na mesma investigação, apareceu um segundo problema: o badge também não aparecia **antes** de abrir o chat pela primeira vez, porque nada buscava a contagem de não lidas no carregamento do app (o protótipo inicializava isso com um valor fixo). Corrigido com `useNaoLidasChatInicial`, chamado uma vez no topo do `AppPaciente`.
3. **Qualquer switch na ficha do paciente piscava a tela inteira para "Carregando…"** — `usePaciente.atualizar` chamava `recarregar()` depois de gravar, o que reseta o `Estado<T>` pra `"carregando"` e faz `FichaPaciente.tsx` (que gate toda a árvore de abas nesse status) sumir com tudo por um instante. Corrigido: `atualizar` agora escreve o resultado direto num estado local (`override`) em vez de forçar um refetch — a tela reflete a mudança na hora, sem flash, exatamente como no protótipo (que era só `setState` síncrono).

Fica registrado aqui como prova de que "rodando de verdade" encontra coisa que typecheck/build sozinhos não pegam — os três bugs acima passavam limpos em `tsc --noEmit` e `vite build`.

---

## 8. Confirmação de paridade funcional

Nenhuma tela ou funcionalidade dos protótipos foi removida ou simplificada. Tabela de correspondência:

| Tela/fluxo no protótipo | Onde está agora |
|---|---|
| Hoje (fita, check-in, água, próxima refeição, diário resumido) | `components/patient/Hoje.tsx` |
| Plano (refeições, trocas, montador) | `components/patient/Plano.tsx` + `modals/patient/Montador.tsx` |
| Diário alimentar | `components/patient/Diario.tsx` |
| Evolução (fita, gráfico de dor, fotos, peso, medidas) | `components/patient/Evolucao.tsx` |
| Feed | `components/patient/Feed.tsx` |
| Check-in (fluxo condicional completo) | `modals/patient/CheckIn.tsx` |
| Chat | `modals/patient/Chat.tsx` |
| Fotos de evolução | `modals/patient/Fotos.tsx` |
| Perfil, Biblioteca, Questionário, Lembretes, Ficha de alimento | `modals/patient/*` |
| Lista de pacientes | `components/nutri/ListaPacientes.tsx` |
| Ficha do paciente (6 abas) | `components/nutri/ficha/*` |
| Importação de plano do Notion | `services/planoParserService.ts` + `AbaPlano.tsx` |
| Calculadora de equivalências | `services/alimentoService.ts` (`calcularEquivalencias`) + `AbaEquivalencias.tsx` |
| Base TACO (consulta interna) | `components/nutri/PainelBase.tsx` |
| Feed do painel (publicar) | `components/nutri/PainelFeed.tsx` |
| Biblioteca/materiais do painel | `components/nutri/PainelBiblioteca.tsx` + `AbaMateriais.tsx` |
| Encerrar/reativar acesso | `AbaAcesso.tsx` |
| **Dashboard** | **Novo** (briefing §15) — `components/nutri/Dashboard.tsx` |

**Regras inegociáveis do Anexo — onde cada uma vive no código:**

1. Paciente nunca vê valor nutricional → `alimentoService`/`@/data/taco` nunca importados por código de paciente; paciente só fala com `fichaAlimentoService`.
2. TACO é uso interno → mesmo ponto acima.
3. Substituição sempre escrita pela nutricionista → `Substituicao` só existe dentro de `ItemPlano` publicado pela nutricionista; `calcularEquivalencias` é isolada em `AbaEquivalencias` (painel), nunca chamada pelo lado do paciente.
4. "Comer mais de um" só divide o que já foi autorizado → `services/montadorService.ts` (`montarRefeicao`), opera só sobre `ItemMontador[]` curado pela nutricionista.
5. Troca nunca conta como desvio → `services/diarioService.ts` (`registrarTrocaComoAdesao`) hardcoda `adesao: "troquei"`.
6. Cor fixa por refeição, opções compartilham cor → `constants/cores.ts` + `Refeicao.corId` + abas em `Plano.tsx`.
7. Unidade de exibição por decisão da nutricionista → `Paciente.preferenciaUnidade` + `utils/quantidade.ts`.
8. Encerrar acesso não apaga dado → `pacienteService.definirAcessoAtivo` só alterna `Paciente.ativo`.
9. Publicação bloqueada com item pendente → `planoService.publicarNovaVersao` lança erro se `contarPendenciasDeVinculo > 0`.
10. Preferências de escolha visíveis só à nutricionista → `AbaRegistros.tsx` (painel), sem equivalente no lado do paciente.
11. Fotos privadas, sem EXIF, exclusão real → `SessaoFoto.storagePathPorPose` (paths de bucket privado) + `evolucaoService.apagarSessaoFoto` (delete real, não soft-delete).
12. Chat assíncrono, sem IA, append-only, aviso de emergência → `Mensagem.retractedEm` (nunca edita `texto`), `AVISO_CHAT_EMERGENCIA` fixo em `Chat.tsx`.
13. Peso em modo cego → `Paciente.pesoModoCego` (tipo já modelado; tela de registro de peso é placeholder, como no protótipo).
14. Login só por convite → `authService.login` rejeita e-mail que não bate com paciente/nutricionista cadastrados.
15. IA nunca fala com o paciente → `types/alerta.ts` (`ResumoIA`, `AlertaClinico`) e `services/alertaService.ts` são só arquitetura (regra determinística if/then, briefing §22); nenhuma chamada a modelo de linguagem existe no código, e o contrato já garante que `ResumoIA`/`AlertaClinico` só têm campo de leitura pela nutricionista.

---

## 9. O que fica para depois (fora do escopo desta refatoração, de propósito)

- **Conectar Supabase de verdade** — trocar o corpo de `repositories/*.ts` e `authService`/`mfaService` por chamadas reais; criar as migrations SQL (schema já modelado 1:1 em `types/`).
- **Upload/compressão real de fotos** — `evolucaoService.prepararUploadFoto` está desenhado como o ponto de entrada, mas a captura de câmera/compressão/remoção de EXIF em si não foi implementada (briefing pedia arquitetura pronta, não a implementação completa).
- **Resumos de IA** (`ResumoIA`) — tipo e limites já modelados (briefing §22), geração em si não implementada (era pedido explícito do briefing: só arquitetura).
- **Background Sync API real** — hoje o fallback manual (retry ao reabrir/ao voltar `online`) cobre todos os navegadores; registrar o evento `sync` num service worker customizado (modo `injectManifest`) é um upgrade incremental para os navegadores que suportam.
- **Contraste `--ink-3`** (achado A12) — decisão de design, não de arquitetura.
- **Cache entre telas do painel** — `ListaPacientes` (contagem "X ATIVOS" no topo, lista de pacientes) usa sua própria busca (`usePacientes`), independente da `usePaciente` usada dentro da ficha. Uma mudança feita na ficha (ex.: encerrar acesso) aparece corretamente ao voltar pra lista (o dado já foi persistido, a lista busca de novo ao remontar), mas não atualiza em tempo real se as duas telas estivessem visíveis ao mesmo tempo. Resolver isso de verdade pede um cache compartilhado entre hooks (React Query ou uma store própria) — nenhum dos dois protótipos tinha esse problema porque tudo vivia no mesmo `useState` de nível de app; virou uma questão real só depois de dividir em camadas, e o alcance de uma correção completa (cache global com invalidação) é maior do que o resto dos ajustes desta rodada de verificação.
