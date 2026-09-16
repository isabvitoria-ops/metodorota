# Central do Paciente

Aplicação web mobile-first para os pacientes de nutrição: troca de alimentos
com cálculo automático, estratégias para comer fora, substituições por grupo
alimentar, guias e favoritos — com área administrativa, login e controle de
validade de acesso.

React + Vite + TypeScript + Supabase, publicado na Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha, ou deixe vazio para o modo demonstração
npm run dev                  # http://localhost:5173
```

Sem as variáveis do Supabase o app abre em **modo demonstração**: funciona
inteiro, sem login, com dados de exemplo que ficam só no navegador.

## Comandos

```bash
npm test             # motor de cálculo e contraste da paleta
npm run test:banco   # bateria de segurança do banco (precisa de Postgres local)
npm run typecheck
npm run lint
npm run build
npm run seed         # regenera os dados iniciais do banco a partir das sementes
npm run instalador   # regenera supabase/instalar.sql
npm run artefato     # build da prévia para host estático (rotas por hash)
npm run html-unico   # gera site/index.html — a Central inteira num arquivo só
npm run html-pages   # gera site-pages/ — index.html + 404.html para o GitHub Pages
```

## Documentação

- **[PUBLICAR.md](PUBLICAR.md)** — como colocar no ar, passo a passo, sem saber
  programar: Supabase, GitHub, Vercel, domínio próprio e o que fazer quando
  algo der errado.
- **[CENTRAL.md](CENTRAL.md)** — arquitetura, banco de dados, controle de
  acesso e como cadastrar alimentos, equivalências, restaurantes e guias.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — o app anterior de acompanhamento
  diário, que continua no repositório e hoje fica desligado por padrão
  (ver seção 9 do CENTRAL.md).

## A regra central

> **Convite não é acesso.**
> Acesso = conta autenticada + paciente cadastrado e vinculado + não suspenso +
> hoje dentro do período.

Ela está implementada no banco (`tem_acesso()`), não no frontend, e é
verificada por 61 testes que rodam num Postgres de verdade.
