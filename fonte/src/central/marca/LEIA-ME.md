# A marca — arquivos oficiais

Vieram do manual entregue pela designer (`ENTREGAISABELA.pdf`, no Drive da
Isabela, pasta `Isabela Marçal / rgb (telas)`). São **a arte original**,
extraída em vetor do próprio PDF — não foram redesenhados, refeitos com
outra fonte, nem tiveram proporção, símbolo ou cor alterados.

| arquivo | o que é | onde usar |
|---|---|---|
| `isabela-marcal.svg` | horizontal, azul da marca | cabeçalho, login, PDFs — sobre fundo claro |
| `isabela-marcal-clara.svg` | horizontal, clara | sobre o azul da marca ou foto escura |
| `monograma.svg` | só o símbolo, azul | espaço apertado, onde o nome já aparece do lado |
| `monograma-claro.svg` | só o símbolo, claro | idem, sobre fundo escuro |
| `../favicon.svg` | o símbolo claro dentro de um quadrado azul | aba do navegador e ícone do app |

## Três coisas que decidiram esses arquivos

**Vetor, e não PNG.** A logo é de traços finíssimos. Em PNG, ela borra ao
imprimir e ao crescer; em vetor, sai nítida em qualquer tamanho e ainda pesa
menos dentro do arquivo único que o site publica.

**Fundo transparente.** O original vem sobre o creme `#F7EEE7`. Ela pediu
fundo branco, então o retângulo de fundo foi removido — a logo fica sobre o
fundo da tela, seja ele qual for.

**O ícone tem fundo cheio, e é o único que tem.** O monograma é de linha
fina: solto num ícone de 16 px, ele some. Como silhueta clara sobre o azul
cheio, o formato continua legível. É o mesmo par de cores que o manual usa
nas páginas de aplicação sobre o azul, não uma combinação inventada aqui.

## Proporções, para não deformar

Horizontal: **4,58 : 1**. Monograma e ícone: **quadrados**. Use só uma das
duas medidas (largura *ou* altura) e deixe a outra em `auto`.
