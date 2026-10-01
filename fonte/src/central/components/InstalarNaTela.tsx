import { useMemo, useState, type ReactNode } from "react";
import monogramaClaroUrl from "@/central/marca/monograma-claro.svg";
import {
  detectarPlataforma,
  estaEmNavegadorInterno,
  type Plataforma,
} from "@/central/utils/plataforma";

/**
 * "Coloque na tela do seu celular" — o passo a passo ilustrado.
 *
 * As figuras são desenhos (SVG) das telas do Safari e do Chrome, com o ponto
 * onde tocar em destaque. Não são fotos do aparelho: telas reais mudam de
 * versão para versão e envelhecem, o desenho continua certo. Cada passo também
 * tem a frase escrita, para quem lê melhor do que olha.
 *
 * O nome que aparece embaixo do ícone é o do `index.html` (`apple-mobile-web-app-title`).
 */
const NOME_DO_ICONE = "MARVIA";

const AZUL = "#38546c";
const DESTAQUE = "#c0852f";

/** Moldura comum das figuras: fundo claro, bordas finas, o destaque em âmbar. */
function Figura({ children, rotulo }: { children: ReactNode; rotulo: string }) {
  return (
    <svg className="c-passo-figura" viewBox="0 0 300 150" role="img" aria-label={rotulo}>
      <rect x="1" y="1" width="298" height="148" rx="14" fill="var(--surface-2)" stroke="var(--border)" />
      {children}
    </svg>
  );
}

function Anel({ cx, cy, r = 17 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="none" stroke={DESTAQUE} strokeWidth="3" />;
}

function IconeCompartilhar({ x, y, cor = AZUL }: { x: number; y: number; cor?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={cor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-8 -1 V9 a2 2 0 0 0 2 2 H6 a2 2 0 0 0 2 -2 V-1" />
      <path d="M0 6 V-10 M-5 -5 L0 -10 L5 -5" />
    </g>
  );
}

function Linha({ y, texto, destaque = false, icone }: { y: number; texto: string; destaque?: boolean; icone?: ReactNode }) {
  return (
    <g>
      {destaque && <rect x="30" y={y - 15} width="240" height="30" rx="8" fill="none" stroke={DESTAQUE} strokeWidth="3" />}
      <text x="46" y={y + 4} fontSize="12" fill="var(--text)" fontFamily="system-ui, sans-serif" fontWeight={destaque ? 700 : 400}>
        {texto}
      </text>
      {icone}
    </g>
  );
}

// ---------------------------------------------------------------- iPhone
function IosBarraDoSafari() {
  return (
    <Figura rotulo="Barra de baixo do Safari, com o botão Compartilhar em destaque">
      <rect x="20" y="14" width="260" height="42" rx="8" fill="var(--background)" stroke="var(--border)" />
      <text x="150" y="40" fontSize="11" fill="var(--text-muted)" textAnchor="middle" fontFamily="system-ui, sans-serif">
        o endereço do site
      </text>
      <rect x="1" y="96" width="298" height="53" rx="0" fill="var(--background)" stroke="var(--border)" />
      <path d="M40 122 l-8 8 l8 8" stroke={AZUL} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M92 122 l8 8 l-8 8" stroke="var(--icone)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <IconeCompartilhar x={150} y={130} />
      <Anel cx={150} cy={129} />
      <rect x="198" y="120" width="18" height="20" rx="2" fill="none" stroke="var(--icone)" strokeWidth="2" />
      <rect x="254" y="122" width="16" height="16" rx="3" fill="none" stroke="var(--icone)" strokeWidth="2" />
    </Figura>
  );
}

function IosLista() {
  return (
    <Figura rotulo="Lista que abre ao tocar em Compartilhar, com a opção Adicionar à Tela de Início em destaque">
      <Linha y={26} texto="Copiar" />
      <Linha y={60} texto="Adicionar aos Favoritos" />
      <Linha y={94} texto="Adicionar à Tela de Início" destaque icone={
        <g transform="translate(246 94)" stroke={AZUL} strokeWidth="2" fill="none" strokeLinecap="round">
          <rect x="-8" y="-8" width="16" height="16" rx="3" />
          <path d="M0 -4 V4 M-4 0 H4" />
        </g>
      } />
      <Linha y={128} texto="Marcar" />
    </Figura>
  );
}

function IosAdicionar() {
  return (
    <Figura rotulo="Tela de confirmação, com o botão Adicionar, no canto de cima à direita, em destaque">
      <text x="16" y="31" fontSize="11" fill="#2a6fd6" fontFamily="system-ui, sans-serif">Cancelar</text>
      <text x="140" y="31" fontSize="9" fill="var(--text)" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="600">
        Adicionar à Tela de Início
      </text>
      <rect x="226" y="14" width="62" height="26" rx="8" fill="none" stroke={DESTAQUE} strokeWidth="3" />
      <text x="257" y="31" fontSize="11" fill="#2a6fd6" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="700">Adicionar</text>
      <rect x="24" y="62" width="54" height="54" rx="12" fill={AZUL} />
      <image href={monogramaClaroUrl} x="30" y="68" width="42" height="42" />
      <text x="92" y="84" fontSize="13" fill="var(--text)" fontFamily="system-ui, sans-serif" fontWeight="600">{NOME_DO_ICONE}</text>
      <text x="92" y="102" fontSize="10" fill="var(--text-muted)" fontFamily="system-ui, sans-serif">o endereço do site</text>
    </Figura>
  );
}

// ---------------------------------------------------------------- Android
function AndroidBarra() {
  return (
    <Figura rotulo="Barra de cima do Chrome, com os três pontinhos no canto direito em destaque">
      <rect x="14" y="16" width="226" height="40" rx="20" fill="var(--background)" stroke="var(--border)" />
      <text x="127" y="41" fontSize="11" fill="var(--text-muted)" textAnchor="middle" fontFamily="system-ui, sans-serif">
        o endereço do site
      </text>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx="270" cy={26 + i * 10} r="2.8" fill={AZUL} />
      ))}
      <Anel cx={270} cy={36} r={20} />
    </Figura>
  );
}

function AndroidMenu() {
  return (
    <Figura rotulo="Menu do Chrome, com a opção Instalar app ou Adicionar à tela inicial em destaque">
      <Linha y={26} texto="Nova guia" />
      <Linha y={60} texto="Instalar app  (ou Adicionar à tela inicial)" destaque />
      <Linha y={94} texto="Histórico" />
      <Linha y={128} texto="Downloads" />
    </Figura>
  );
}

function AndroidConfirma() {
  return (
    <Figura rotulo="Janela de confirmação, com o botão Instalar em destaque">
      <rect x="40" y="18" width="220" height="114" rx="16" fill="var(--background)" stroke="var(--border)" />
      <rect x="56" y="34" width="36" height="36" rx="9" fill={AZUL} />
      <image href={monogramaClaroUrl} x="60" y="38" width="28" height="28" />
      <text x="102" y="50" fontSize="12" fill="var(--text)" fontFamily="system-ui, sans-serif" fontWeight="700">Instalar app?</text>
      <text x="102" y="66" fontSize="11" fill="var(--text-muted)" fontFamily="system-ui, sans-serif">{NOME_DO_ICONE}</text>
      <text x="168" y="112" fontSize="12" fill="var(--text-muted)" fontFamily="system-ui, sans-serif">Cancelar</text>
      <rect x="218" y="96" width="34" height="24" rx="12" fill="none" stroke={DESTAQUE} strokeWidth="3" />
      <text x="235" y="112" fontSize="11" fill="#2a6fd6" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="700">OK</text>
    </Figura>
  );
}

// ---------------------------------------------------------------- Computador
function ComputadorBarra() {
  return (
    <Figura rotulo="Barra de endereço do Chrome, com o ícone de instalar à direita em destaque">
      <rect x="14" y="52" width="272" height="40" rx="20" fill="var(--background)" stroke="var(--border)" />
      <text x="120" y="77" fontSize="11" fill="var(--text-muted)" textAnchor="middle" fontFamily="system-ui, sans-serif">
        o endereço do site
      </text>
      <g transform="translate(252 72)" stroke={AZUL} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="-9" y="-8" width="18" height="12" rx="2" />
        <path d="M0 -3 V8 M-4 4 L0 8 L4 4" />
      </g>
      <Anel cx={252} cy={72} r={19} />
    </Figura>
  );
}

function ComputadorConfirma() {
  return (
    <Figura rotulo="Janela do Chrome com o botão Instalar em destaque">
      <rect x="50" y="20" width="200" height="110" rx="12" fill="var(--background)" stroke="var(--border)" />
      <rect x="64" y="34" width="34" height="34" rx="8" fill={AZUL} />
      <image href={monogramaClaroUrl} x="68" y="38" width="26" height="26" />
      <text x="108" y="50" fontSize="12" fill="var(--text)" fontFamily="system-ui, sans-serif" fontWeight="700">Instalar app?</text>
      <text x="108" y="66" fontSize="11" fill="var(--text-muted)" fontFamily="system-ui, sans-serif">{NOME_DO_ICONE}</text>
      <text x="136" y="112" fontSize="12" fill="var(--text-muted)" fontFamily="system-ui, sans-serif">Cancelar</text>
      <rect x="196" y="96" width="42" height="24" rx="12" fill="none" stroke={DESTAQUE} strokeWidth="3" />
      <text x="217" y="112" fontSize="11" fill="#2a6fd6" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="700">Instalar</text>
    </Figura>
  );
}

interface Passo {
  titulo: string;
  texto: string;
  figura: ReactNode;
}

const PASSOS: Record<Plataforma, Passo[]> = {
  ios: [
    { titulo: "Toque em Compartilhar", texto: "É o quadradinho com uma seta para cima, na barra de baixo do Safari.", figura: <IosBarraDoSafari /> },
    { titulo: "Escolha “Adicionar à Tela de Início”", texto: "Deslize a lista para cima, se precisar, até achar essa opção.", figura: <IosLista /> },
    { titulo: "Toque em “Adicionar”", texto: `No canto de cima, à direita. O ícone ${NOME_DO_ICONE} aparece na sua tela, junto com os outros aplicativos.`, figura: <IosAdicionar /> },
  ],
  android: [
    { titulo: "Toque nos três pontinhos", texto: "No canto de cima, à direita do Chrome.", figura: <AndroidBarra /> },
    { titulo: "Toque em “Instalar app”", texto: "Em alguns celulares o nome é “Adicionar à tela inicial”. É a mesma coisa.", figura: <AndroidMenu /> },
    { titulo: "Confirme", texto: `Toque em Instalar (ou Adicionar). O ícone ${NOME_DO_ICONE} aparece na sua tela.`, figura: <AndroidConfirma /> },
  ],
  computador: [
    { titulo: "Clique no ícone de instalar", texto: "Fica no fim da barra de endereço do Chrome ou do Edge, à direita.", figura: <ComputadorBarra /> },
    { titulo: "Clique em “Instalar”", texto: `O ${NOME_DO_ICONE} abre numa janela própria e ganha um atalho no computador.`, figura: <ComputadorConfirma /> },
  ],
};

const ROTULOS: Record<Plataforma, string> = { ios: "iPhone", android: "Android", computador: "Computador" };

/**
 * O guia. `aoConcluir` recebe o clique em "Entendi"; quem decide o que isso
 * faz (registrar que viu, ou só voltar) é quem usa o componente.
 */
export function InstalarNaTela({
  aoConcluir,
  rotuloDoBotao = "Entendi",
  aoPular,
}: {
  aoConcluir: () => void;
  rotuloDoBotao?: string;
  aoPular?: () => void;
}) {
  const detectada = useMemo<Plataforma>(
    () => detectarPlataforma(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    [],
  );
  const interno = useMemo(() => estaEmNavegadorInterno(navigator.userAgent), []);
  const [plataforma, definirPlataforma] = useState<Plataforma>(detectada);
  const passos = PASSOS[plataforma];

  return (
    <div className="c-instalar">
      <div role="tablist" aria-label="Seu aparelho" className="c-instalar-abas">
        {(Object.keys(ROTULOS) as Plataforma[]).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === plataforma}
            className={`c-chip ${p === plataforma ? "c-chip-ativo" : ""}`}
            onClick={() => definirPlataforma(p)}
          >
            {ROTULOS[p]}
          </button>
        ))}
      </div>

      {plataforma === "ios" && interno && (
        <div className="c-aviso" role="status">
          <span>
            <strong>Você abriu por dentro de outro aplicativo</strong> (WhatsApp, Instagram…). Ali não dá para colocar na
            tela inicial. Toque nos três pontinhos ou no ícone de bússola, escolha <strong>Abrir no Safari</strong> e
            siga os passos abaixo.
          </span>
        </div>
      )}

      <ol className="c-passos">
        {passos.map((p, i) => (
          <li key={p.titulo} className="c-passo">
            <div className="c-passo-numero" aria-hidden="true">{i + 1}</div>
            <div className="c-passo-corpo">
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
              {p.figura}
            </div>
          </li>
        ))}
      </ol>

      <p className="c-dica">Depois é só tocar no ícone {NOME_DO_ICONE} da sua tela, como em qualquer aplicativo. Os seus dados e a sua senha continuam os mesmos.</p>

      <button type="button" className="c-botao" onClick={aoConcluir}>
        {rotuloDoBotao}
      </button>
      {aoPular && (
        <button type="button" className="c-link" onClick={aoPular}>
          Agora não
        </button>
      )}
    </div>
  );
}
