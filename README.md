# Método Rota — Central do Paciente

Este repositório guarda **as duas metades do mesmo aplicativo**:

| O quê | Onde | Para quê |
|---|---|---|
| O app publicado | `index.html` e `404.html`, na raiz | É o que a paciente abre. Arquivo único, gerado — **não se edita à mão** |
| O código-fonte | pasta `fonte/` | É de onde o arquivo acima é gerado. Toda alteração começa aqui |

Os dois precisam existir. O `index.html` é o app montado e espremido; sem a
pasta `fonte/` não há como mudar uma tela, um texto ou uma regra — só
refazendo o aplicativo do zero.

Para publicar uma alteração, dentro de `fonte/`:

```bash
npm run html-pages        # gera site-pages/index.html + 404.html
cp site-pages/*.html ..   # substitui os arquivos da raiz
```

O resto das instruções está em `fonte/CLAUDE.md` e `fonte/PUBLICAR.md`.
