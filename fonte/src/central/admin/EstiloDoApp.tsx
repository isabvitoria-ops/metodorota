/**
 * Mais → Estilo do app: a régua que toda tela nova segue, num lugar só.
 *
 * Não é cópia: cada amostra usa a classe e a variável de verdade de
 * central.css. Se a cor ou o botão mudar lá, muda aqui junto — e esta tela
 * deixa de ser um retrato velho.
 */
import { useState } from "react";
import { BarraBusca } from "@/central/components/BarraBusca";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Esqueleto } from "@/central/components/Esqueleto";

const CORES: { nome: string; variavel: string; uso: string; origem: string }[] = [
  { nome: "Marfim", variavel: "--marca-marfim", uso: "fundo de bloco e de PDF", origem: "designer" },
  { nome: "Areia", variavel: "--marca-areia", uso: "linhas e divisórias", origem: "designer" },
  { nome: "Azul Gelo", variavel: "--marca-gelo", uso: "caixa de destaque", origem: "designer" },
  { nome: "Azul Médio", variavel: "--marca-azul-medio", uso: "apoio grande, ícone", origem: "designer" },
  { nome: "Azul Profundo", variavel: "--marca-azul-profundo", uso: "título, botão", origem: "designer" },
  { nome: "Nanquim", variavel: "--marca-nanquim", uso: "texto corrido", origem: "app" },
  { nome: "Cereja", variavel: "--marca-cereja", uso: "detalhe pequeno", origem: "moodboard" },
  { nome: "Rosa Algodão", variavel: "--marca-rosa", uso: "etiqueta", origem: "moodboard" },
  { nome: "Limão Siciliano", variavel: "--marca-limao", uso: "marca-texto", origem: "moodboard" },
  { nome: "Folha", variavel: "--marca-folha", uso: "detalhe de “ok”", origem: "moodboard" },
];

function hexDa(variavel: string): string {
  if (typeof window === "undefined") return "";
  const raiz = document.querySelector(".central") ?? document.documentElement;
  return getComputedStyle(raiz).getPropertyValue(variavel).trim().toUpperCase();
}

export function EstiloDoApp() {
  const [busca, definirBusca] = useState("");
  const [filtro, definirFiltro] = useState(true);
  return (
    <div className="c-es">
      <h1 className="c-titulo">Estilo do app</h1>
      <p className="c-subtitulo">A régua que toda tela nova segue. Só você vê esta página.</p>

      <h2 className="c-cz-secao">Cores, cada uma com um trabalho</h2>
      <div className="c-es-cores">
        {CORES.map((c) => (
          <div key={c.nome} className="c-es-cor">
            <span style={{ background: `var(${c.variavel})` }} />
            <strong>{c.nome}</strong>
            <small>
              {hexDa(c.variavel)} · {c.uso}
            </small>
          </div>
        ))}
      </div>
      <p className="c-dica">
        Texto nunca em preto puro, fundo de peça nunca em branco puro. Rosa, Limão, Areia e Azul Gelo não servem para texto sobre
        Marfim (contraste baixo).
      </p>

      <div className="c-es-grade">
        <section className="c-bloco">
          <h2 className="c-cz-secao c-cz-secao--dentro">Letras do app</h2>
          <p className="c-es-titulo">Título de tela</p>
          <p className="c-es-texto">Texto corrido em 16 px, fácil de ler no celular.</p>
          <p className="c-cz-numeros-rotulo c-es-rotulo">Rótulo em caixa alta</p>
          <h2 className="c-cz-secao c-cz-secao--dentro c-es-espaco">Letras dos PDFs</h2>
          <p className="c-es-josefin">TÍTULO DE PDF</p>
          <p className="c-es-lato">Texto do PDF em Lato, com rodapé de nome, CRN e contato em toda folha.</p>
          <p className="c-dica">Levar a Josefin Sans e a Lato também para as telas do app está em aberto na marca.</p>
        </section>

        <section className="c-bloco">
          <h2 className="c-cz-secao c-cz-secao--dentro">Botões</h2>
          <div className="c-es-linha">
            <button type="button" className="c-botao">
              Principal
            </button>
            <button type="button" className="c-botao c-botao-secundario">
              Secundário
            </button>
            <button type="button" className="c-link">
              Link
            </button>
          </div>
          <h2 className="c-cz-secao c-cz-secao--dentro c-es-espaco">Etiquetas e filtros</h2>
          <div className="c-es-linha">
            <span className="c-cz-etiqueta">Receita</span>
            <button type="button" className="c-cz-filtro" aria-pressed={filtro} onClick={() => definirFiltro(!filtro)}>
              Rápida
            </button>
            <span className="c-cz-filtro c-cz-filtro--leitura">Sem lactose</span>
            <button type="button" className="c-chip" aria-pressed="true">
              Todas
            </button>
            <button type="button" className="c-chip" aria-pressed="false">
              Lanche
            </button>
          </div>
          <h2 className="c-cz-secao c-cz-secao--dentro c-es-espaco">Busca e campo</h2>
          <BarraBusca valor={busca} aoMudar={definirBusca} placeholder="Buscar" />
          <label className="c-campo c-es-espaco">
            <span className="c-rotulo">Nome do campo</span>
            <input className="c-input" placeholder="O que ela digita" />
          </label>
        </section>

        <section className="c-bloco">
          <h2 className="c-cz-secao c-cz-secao--dentro">Avisos e estados</h2>
          <div className="c-es-pilha">
            <div className="c-aviso c-aviso-ok">Salvo.</div>
            <div className="c-aviso">Confira antes de enviar.</div>
            <div className="c-aviso c-aviso-erro">Não deu para salvar. Tente de novo.</div>
            <EstadoVazio icone="receita" titulo="Nada aqui ainda" descricao="Explica o que vai aparecer, em vez de parecer erro." />
            <Esqueleto />
          </div>
        </section>

        <section className="c-bloco">
          <h2 className="c-cz-secao c-cz-secao--dentro">Regras</h2>
          <ul className="c-es-regras">
            <li>Um elemento de apoio por tela ou por peça.</li>
            <li>Cards da mesma linha com a mesma altura.</li>
            <li>No PDF, o que não cabe vira outra página. Nunca encolher a letra para caber.</li>
            <li>Cabeçalho e rodapé com o CRN iguais em todo documento.</li>
            <li>Nenhum número sem origem: alimento pela tabela, produto pelo rótulo.</li>
            <li>Frases curtas, uma ideia por frase. Sem promessa de resultado nem medo.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
