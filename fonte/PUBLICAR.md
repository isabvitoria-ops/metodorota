# Como eu coloco minha Central no ar

Este guia é para ser seguido do começo ao fim, na ordem, sem saber programar.
Reserve cerca de uma hora na primeira vez. Depois disso, publicar uma
alteração leva menos de um minuto.

Se em algum passo a tela que você vê não for exatamente igual à descrita, procure
pela **palavra em negrito** — os nomes dos botões mudam de lugar às vezes, mas
raramente mudam de nome.

---

## Antes de começar: quem faz o quê

Quatro serviços, cada um com um papel. Vale entender, porque quando algo der
errado você vai saber onde olhar.

| Serviço | O que é | O que guarda |
|---|---|---|
| **Claude Code** | Onde o código é escrito e alterado | Nada permanente |
| **GitHub** | O arquivo do código, com histórico | O código |
| **Vercel** | Quem transforma o código em site no ar | O site publicado |
| **Supabase** | O banco de dados e o login | Seus pacientes e conteúdos |

Em uma frase: **o código vive no GitHub, o site vive na Vercel, e seus dados
vivem no Supabase.** Apagar o site da Vercel não apaga nenhum paciente. Trocar
de computador não apaga nada.

---

## Passo 1 — Criar o projeto no Supabase

1. Acesse **supabase.com** e clique em **Start your project**. Entre com sua
   conta do GitHub (é o caminho mais curto).
2. Clique em **New project**.
3. Preencha:
   - **Name**: `central-do-paciente`
   - **Database Password**: clique em **Generate a password** e **guarde essa
     senha** num lugar seguro. Você não vai usá-la no dia a dia, mas se
     perder, recuperar dá trabalho.
   - **Region**: escolha **South America (São Paulo)**. É o servidor mais perto
     das suas pacientes, e isso aparece na velocidade do app.
4. Clique em **Create new project** e espere. Leva de 1 a 3 minutos.

---

## Passo 2 — Criar as tabelas

1. Dentro do projeto, no menu da esquerda, clique em **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase/instalar.sql` deste projeto, copie **todo** o
   conteúdo e cole na caixa.
4. Clique em **Run** (ou aperte Ctrl+Enter).
5. Deve aparecer **Success. No rows returned**. É isso mesmo — significa que
   deu certo.

Para conferir: menu da esquerda → **Table Editor**. Você deve ver as tabelas
`alimentos`, `pacientes`, `planos`, `conteudos`, entre outras. A tabela
`alimentos` já vem com os alimentos iniciais.

> Se você rodar esse arquivo de novo um dia, nada é apagado nem duplicado. Ele
> foi escrito para ser seguro de repetir.

---

## Passo 3 — Pegar as duas chaves

1. Menu da esquerda → **Project Settings** (o ícone de engrenagem) → **API**.
2. Anote dois valores:
   - **Project URL** — algo como `https://abcdefgh.supabase.co`
   - **anon public** — um texto longo começando com `eyJ...`

Guarde os dois num bloco de notas por enquanto.

> **A terceira chave dessa tela, a `service_role`, nunca deve ser usada.** Não
> cole ela em lugar nenhum deste projeto, nem na Vercel, nem em mensagem. Ela
> dá acesso total ao banco ignorando todas as regras de proteção. A chave
> `anon` pode ser pública sem problema: quem protege os dados é a regra que já
> está instalada no banco, não o segredo da chave.

---

## Passo 4 — Configurar os e-mails de convite

Esse passo é o que mais gera confusão depois, então vale fazer com calma.

1. Menu da esquerda → **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque `http://localhost:5173` por enquanto. Você troca
   isso no Passo 7, quando o site estiver no ar.
3. Em **Redirect URLs**, clique em **Add URL** e adicione:
   ```
   http://localhost:5173/definir-senha
   ```
4. Clique em **Save**.

Sem isso, o link que chega no e-mail da paciente não abre a tela certa.

---

## Passo 5 — Subir o código para o GitHub

O código já está no repositório `isabvitoria-ops/diet-app`, no branch
`claude/nutrition-patient-webapp-5myhmt`.

Para deixar mais simples daqui em diante, junte esse branch no principal:

1. Abra o repositório no GitHub.
2. Clique em **Pull requests** → **New pull request**.
3. Em **compare**, escolha `claude/nutrition-patient-webapp-5myhmt`.
4. **Create pull request** → **Merge pull request** → **Confirm merge**.

Agora o branch `main` tem a Central.

---

## Passo 6 — Publicar na Vercel

1. Acesse **vercel.com** e entre com a conta do **GitHub**.
2. Clique em **Add New** → **Project**.
3. Ache `diet-app` na lista e clique em **Import**.
4. A Vercel reconhece o projeto sozinha (Framework: **Vite**). Não mexa em
   Build Command nem em Output Directory.
5. Abra **Environment Variables** e adicione as duas chaves do Passo 3:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | a Project URL |
   | `VITE_SUPABASE_ANON_KEY` | a chave `anon public` |

   Deixe marcado para os três ambientes (Production, Preview, Development).
6. Clique em **Deploy** e espere uns dois minutos.
7. No fim aparece o endereço do seu site, algo como
   `central-do-paciente.vercel.app`. **Copie esse endereço.**

---

## Passo 6-B — Ou publicar no GitHub Pages (o caminho que você já usou)

É a alternativa à Vercel. Não precisa criar conta em lugar nenhum, e o
endereço é `https://isabvitoria-ops.github.io/metodorota/`.

A diferença é que o GitHub Pages não monta o site sozinho: ele só serve
arquivo pronto. Então o Claude Code roda `npm run html-pages`, que gera **dois
arquivos** — `index.html` e `404.html` — com o código, o estilo, as fontes e as
chaves do Supabase já embutidos.

1. Peça os dois arquivos ao Claude Code.
2. Abra o repositório `metodorota` no GitHub.
3. **Add file** → **Upload files** e solte os dois na raiz do repositório.
4. **Commit changes**.
5. Espere um ou dois minutos e abra
   `https://isabvitoria-ops.github.io/metodorota/`.

> Os dois arquivos são iguais por dentro, e os dois precisam subir. O
> `404.html` é o que faz as telas de dentro (`/metodorota/trocas`, por exemplo)
> abrirem direto, em vez de dar erro.

Toda vez que mudar alguma coisa no app, é gerar os dois de novo e subir por
cima. Quem só cadastra paciente, alimento ou conteúdo pela área da
nutricionista **não precisa mexer nisso**: isso vive no banco, não no arquivo.

---

## Passo 7 — Voltar ao Supabase e apontar para o site

Agora que o site tem endereço, o Supabase precisa saber qual é.

1. Supabase → **Authentication** → **URL Configuration**.
2. Em **Site URL**, troque para o endereço da Vercel, com `https://` na frente:
   ```
   https://central-do-paciente.vercel.app
   ```
3. Em **Redirect URLs**, adicione (mantendo as de localhost, que servem para
   testar no seu computador):
   ```
   https://central-do-paciente.vercel.app/definir-senha
   ```
4. **Save**.

> **Se publicou no GitHub Pages (Passo 6-B)**, os valores são estes:
>
> - Site URL: `https://isabvitoria-ops.github.io/metodorota/`
> - Redirect URLs: `https://isabvitoria-ops.github.io/metodorota/**`
>
> O `**` no fim cobre todas as telas de dentro de uma vez. Sem isso, o link do
> e-mail chega mas não deixa entrar.

---

## Passo 8 — Criar a sua conta de nutricionista

1. Abra o endereço do seu site.
2. Você vai cair na tela **Entrar**.
3. Escreva o seu e-mail e clique em **Entrar por link no e-mail**.
4. Abra o e-mail e clique no link. Você cai na tela de criar senha. Crie uma.
5. Neste momento você entrou, mas ainda é uma conta comum, sem acesso a nada —
   e isso está certo.
6. Volte ao Supabase → **SQL Editor** → **New query**.
7. Abra o arquivo `supabase/tornar-admin.sql`, cole o conteúdo, **troque o
   e-mail pelo seu** e clique em **Run**.
8. Volte ao site e recarregue a página. Agora existe o botão **Abrir a área da
   nutricionista**.

> Esse passo é manual de propósito. Se qualquer conta pudesse virar
> administradora sozinha, bastaria alguém se cadastrar para ver todos os seus
> pacientes.

---

## Passo 9 — Antes de convidar pacientes: o e-mail

O Supabase manda e-mails de graça, mas com um limite baixo — algo em torno de
**poucos e-mails por hora**, e serve só para testar. Com dez pacientes você já
esbarra nesse limite.

Para uso de verdade, conecte um serviço de e-mail próprio:

1. Crie uma conta em **resend.com** (tem plano gratuito para alguns milhares de
   e-mails por mês) ou em Brevo, SendGrid, Mailgun — qualquer um serve.
2. Lá, gere as credenciais **SMTP** (servidor, porta, usuário e senha).
3. Supabase → **Project Settings** → **Authentication** → role até **SMTP
   Settings** → ligue **Enable Custom SMTP** e preencha com esses dados.
4. Em **Sender email**, use um e-mail do seu domínio, se tiver.

Faça esse passo antes de cadastrar pacientes de verdade. Senão os convites
simplesmente param de sair no meio do caminho e é difícil perceber.

---

## Passo 10 — Cadastrar sua primeira paciente

1. No site, entre na **área da nutricionista** → aba **Pacientes**.
2. **Adicionar paciente**.
3. Preencha nome, e-mail, escolha o plano e confira as datas — a data de fim é
   sugerida a partir do plano, e você pode mudar na mão.
4. Deixe marcado **Enviar convite por e-mail agora**.
5. **Cadastrar**.

O que acontece: a paciente recebe um e-mail com um link, clica, escolhe uma
senha, e entra. A partir daí ela usa e-mail e senha.

**Importante entender:** receber o convite não é ter acesso. O acesso depende
de quatro coisas ao mesmo tempo — conta criada, cadastro feito por você, não
estar suspensa, e a data de hoje estar dentro do período. Se qualquer uma
falhar, ela entra e vê a tela de "acesso não liberado", com o botão do seu
WhatsApp.

---

## Passo 11 — Colocar seu WhatsApp

Área da nutricionista → aba **Configurações**. Preencha o WhatsApp com país e
DDD, só números: `5511999999999`. É esse número que aparece para quem está com
o acesso vencido.

Aproveite e ajuste o nome da Central e a frase da tela inicial.

---

## Passo 12 — Domínio próprio (opcional)

Se você tem um domínio, por exemplo `nutriisabela.com.br`:

1. Vercel → seu projeto → **Settings** → **Domains**.
2. **Add** → escreva `central.nutriisabela.com.br` → **Add**.
3. A Vercel mostra um registro **CNAME** para cadastrar.
4. Entre no site onde você comprou o domínio (Registro.br, GoDaddy, Hostinger…),
   procure **Zona DNS** ou **Gerenciar DNS**, e crie:
   - Tipo: **CNAME**
   - Nome/Host: `central`
   - Valor/Aponta para: o endereço que a Vercel mostrou
5. Espere. Costuma levar de minutos a algumas horas.
6. **Volte ao Passo 7** e troque a Site URL e a Redirect URL do Supabase pelo
   domínio novo. Se esquecer disso, os links de convite param de funcionar.

O HTTPS (o cadeado) é ligado pela Vercel sozinha, sem você fazer nada.

---

## Como atualizar o projeto daqui em diante

```
você pede uma alteração no Claude Code
        ↓
o Claude Code altera o código e envia (commit + push) para o GitHub
        ↓
a Vercel percebe sozinha e publica
        ↓
em ~1 minuto o site novo está no ar
```

Você não precisa fazer nada entre um passo e outro. Só recarregar a página.

**Quando a alteração mexe no banco** (uma coluna nova, uma regra nova), o
Claude Code vai te avisar que existe um arquivo novo em `supabase/migracoes/`
para você colar no SQL Editor. Fora esses casos, é automático.

---

## Trabalhar no seu computador sem estragar o que está no ar

1. Copie o arquivo `.env.example` para um novo chamado `.env.local`.
2. Preencha com as mesmas duas chaves — ou deixe **vazio** para abrir em modo
   demonstração, com dados de exemplo e sem tocar no banco de verdade.
3. Rode:
   ```bash
   npm install
   npm run dev
   ```
4. Abra `http://localhost:5173`.

O `.env.local` nunca vai para o GitHub: ele já está na lista de arquivos
ignorados.

> Se quiser separar completamente teste de produção, crie um **segundo projeto
> no Supabase** chamado `central-teste`, rode o mesmo `instalar.sql` nele, e use
> as chaves dele no `.env.local`. Aí você pode cadastrar, suspender e apagar
> paciente à vontade sem encostar no banco real.

---

## Quando algo der errado

| O que você vê | O que costuma ser | O que fazer |
|---|---|---|
| Faixa amarela "Modo demonstração" no site publicado | As variáveis não chegaram na Vercel | Vercel → Settings → Environment Variables. Confira os nomes (com `VITE_` na frente) e **publique de novo**: Deployments → ⋯ → Redeploy |
| Link do convite abre `localhost` | Site URL do Supabase ainda aponta para o seu computador | Passo 7 |
| "Acesso não liberado" para uma paciente que deveria entrar | Datas, suspensão, ou e-mail diferente | Abra a ficha dela no admin: confira o período, se está suspensa, e se o e-mail é exatamente o mesmo que ela usou para entrar |
| Convite não chega | Limite de e-mails do Supabase | Passo 9 — conectar SMTP próprio. Confira também a caixa de spam |
| Tela branca depois de publicar | Erro no build | Vercel → Deployments → clique no deploy que falhou → leia o log. Mande o erro para o Claude Code |
| Uma alteração não aparece | O navegador guardou a versão antiga | Recarregue segurando Shift, ou abra numa aba anônima |
| "Já existe um paciente com este e-mail" | Duplicado | Use a busca na lista de pacientes: provavelmente ela já está cadastrada |

### A tela que diz o que está acontecendo

Acrescente `/diagnostico` no fim do endereço do seu site — por exemplo
`https://isabvitoria-ops.github.io/metodorota/diagnostico`.

Ela abre **sem precisar de login**, de propósito: serve justamente para quando
o login é o problema. Mostra se o app achou o Supabase, qual projeto, qual
endereço vai nos convites, se a sua conta é administradora, se o plano está
valendo e se o banco respondeu.

Não aparece dado de paciente ali, e a chave aparece só pelo começo. Quando
algo não funcionar, abra essa tela, tire um print e mande para o Claude Code —
é o que responde a maior parte das dúvidas de uma vez.

---

## O que NUNCA colocar no GitHub

- A chave `service_role` do Supabase
- A senha do banco de dados
- O arquivo `.env.local`
- Qualquer dado de paciente

O arquivo `.gitignore` já bloqueia o `.env.local`. As outras três dependem de
você não colar em lugar nenhum.
