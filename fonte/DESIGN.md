# Método Rota — sistema visual

Fonte única: o primeiro bloco `.central { ... }` de `src/central/styles/central.css`.
Nenhuma regra escreve cor solta; `npm test` confere o contraste (WCAG) de cada par.

## Identidade
Paleta tirada do material da designer (marfim, areia, azul gelo, azul médio, azul profundo).
Fundo branco (decisão da Isabela). Títulos em Fraunces, texto em Public Sans.
Logo: só no cabeçalho (34 px, claro), na tela de entrada e nos documentos impressos.
Verde/amarelo/vermelho ficam só para sucesso/aviso/erro.

## Regras
- Texto mínimo 12 px; alvo de toque ≥ 44 px no celular; foco visível (`--foco`).
- Um botão primário por tela; secundário contornado; perigo só em vermelho.
- Campos: borda `--border-campo` (contraste ≥ 3:1), rótulo sempre visível.
- Carregando: `<Esqueleto />` (nunca texto "Carregando…"); vazio: frase + próximo passo.
- `prefers-reduced-motion` desliga transições.
- Início da paciente: "o que fazer hoje" primeiro, atalhos agrupados.
- Ficha da nutricionista: faixa de situação (ativa/retorno/sem acompanhamento) + 3 números antes das abas.

## Auditoria (o que estava errado → o que foi feito)
Verde hardcoded fora dos tokens → tokens da marca; fontes de 10–11 px → ≥ 12 px;
quatro estilos de input/botão/chip → um só; "Carregando…" em 26 telas → Esqueleto;
abas do prontuário estouravam no celular → rolagem com máscara; alvos de toque pequenos → 44 px;
cabeçalho do admin sem marca → logo + "Área da nutricionista"; home da paciente com lista longa → grupos.
Nada de regra, cálculo, permissão ou banco foi alterado.
