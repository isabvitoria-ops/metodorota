# Central do Paciente — como trabalhar neste projeto

Quem usa isto é a Isabela, nutricionista, não pessoa técnica. Ela pede a
mudança; quem decide o caminho técnico é você.

## Regra permanente: dizer se ela precisa fazer alguma coisa

**Ao fim de toda alteração que ela pedir, termine a resposta dizendo se ela
precisa mexer no Supabase e se precisa mexer no GitHub.** Sempre, nos dois —
inclusive quando a resposta for "não precisa". Ela pediu isso explicitamente,
porque não tem como saber sozinha o que é código, o que é banco e o que é
hospedagem.

Use este formato, no fim da mensagem:

> **Precisa mexer no Supabase?** Não.
> **Precisa mexer no GitHub?** Não — já publiquei, é só recarregar segurando
> Shift.

ou, quando for sim:

> **Precisa mexer no Supabase?** Sim, uma coisa: [o que é, e por quê].
> Cole isto no SQL Editor (New query → colar → Run):
> ```sql
> ...
> ```
> Deve voltar [o que ela tem que ver na tela para saber que deu certo].
>
> **Precisa mexer no GitHub?** Não.

Quando o Supabase for "sim", entregue o SQL **pronto para colar**, com
`returning` ou um `select` de conferência no fim — sem isso ela não tem como
saber se o comando pegou. Foi exatamente o que falhou no `tornar-admin.sql`:
rodou, alterou zero linhas e não avisou.

Quando o GitHub for "sim", diga **onde clicar**, não o que fazer por linha de
comando. Ela não usa terminal.

### Quem faz o quê

| Ela vai ao Supabase | Ela vai ao GitHub | Você resolve sozinho |
|---|---|---|
| Coluna, tabela, índice, RLS | Dar acesso ao repositório numa sessão nova | Tela, botão, texto fixo, cor |
| Função ou trigger em `supabase/migracoes/` | Ligar/desligar o GitHub Pages, trocar o domínio | Corrigir defeito no app |
| Promover conta a `admin` | Aprovar algo que exija a conta dela | Qualquer coisa em `src/` |
| `Authentication → URL Configuration` | | Publicar o site |
| SMTP próprio, limite de e-mails | | Commit, push, deploy |

Cadastrar paciente, alimento, equivalência, guia ou restaurante **não é
nenhum dos três**: ela faz em `/admin` e já está no ar. Quando o pedido for
desses, diga isso em vez de alterar código.

Mudou algo em `supabase/migracoes/`? Rode `npm run instalador` para regerar
`supabase/instalar.sql`, e entregue a ela **só o trecho novo**, não o arquivo
inteiro de 900 linhas.

## Publicar

Ela não sobe arquivo. Você publica:

```bash
npm run html-pages                 # gera site-pages/index.html + 404.html
cp site-pages/*.html ..            # a raiz do repositório
cd .. && git add -A && git commit && git push origin main
```

**Repositório único: `isabvitoria-ops/metodorota`.** Ele guarda as duas
metades do aplicativo — `index.html` e `404.html` na raiz (o app montado,
que a paciente abre) e `fonte/` (o código de onde esses arquivos saem, que
é onde você trabalha). Se não estiver anexado à sessão, use `add_repo`.

O `isabvitoria-ops/diet-app` **não existe mais**: ela o apagou em 16/09/26
achando que fosse uma versão velha, porque a branch principal dele estava
parada em agosto enquanto o trabalho vivia numa ramificação. O código foi
recuperado desta máquina e trazido para `fonte/`, com o histórico inteiro.
Não recrie aquele repositório nem mande ela procurá-lo.

Os dois arquivos têm que subir com os nomes **exatos** `index.html` e
`404.html`. Um upload pelo navegador já virou `index (1).html` uma vez, e o
site ficou na versão antiga sem dar erro nenhum.

Depois de publicar, confirme que o deploy do Pages passou antes de dizer que
está no ar.

### Quando o GitHub vira tarefa dela

Quase nunca. No fluxo normal ela **não toca no GitHub** — você commita, faz
push e o Pages publica. Os casos em que ela precisa entrar:

- **Sessão nova sem o repositório anexado.** Peça que ela mande
  `isabvitoria-ops/metodorota`, e use `add_repo`. É um só, e é pedido de
  informação, não tarefa no site.
- **Configuração do GitHub Pages** (Settings → Pages): ligar, desligar, mudar
  a branch ou apontar domínio próprio. Só ela tem esse botão.
- **Plano B**, se você não conseguir publicar: repositório `metodorota` →
  Add file → Upload files → soltar os dois arquivos → Commit changes. Avise
  que o navegador renomeia arquivo repetido para `index (1).html`, e que nesse
  caso é preciso apagar o antigo e renomear o novo.

Se nenhum desses for o caso, a resposta é "não precisa mexer no GitHub".

## O que você não consegue fazer daqui

Este ambiente bloqueia `*.supabase.co` e `isabvitoria-ops.github.io`. Então
login, convite e leitura de paciente **não dá para testar daqui** — só do lado
dela. Quando algo não bater, peça um print de
`https://isabvitoria-ops.github.io/metodorota/diagnostico`: essa tela é pública
de propósito e mostra papel, situação, acesso e se o banco respondeu.

Não diga que testou o que não testou.

## Antes de publicar

`npm test` (48), `npm run typecheck`, `npm run lint` (0 erros). O resto da
arquitetura está em `CENTRAL.md`; o manual não técnico dela é `PUBLICAR.md`.
