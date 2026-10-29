import { useSessao } from "@/central/autenticacao/SessaoContexto";

interface Alimento {
  nome: string;
  porcao: string;
}

interface Categoria {
  titulo: string;
  alimentos: Alimento[];
}

interface Fase {
  semana: number;
  titulo: string;
  subtitulo: string;
  categorias: Categoria[];
  dica?: string;
}

const FASES: Fase[] = [
  {
    semana: 1,
    titulo: "Semana 1",
    subtitulo: "Primeiros passos",
    categorias: [
      {
        titulo: "Gorduras",
        alimentos: [{ nome: "Abacate", porcao: "45g (1/4 unidade)" }],
      },
      {
        titulo: "Frutas",
        alimentos: [
          { nome: "Pêra", porcao: "110g (1 unidade)" },
          { nome: "Pêssego", porcao: "130g (1 unidade)" },
          { nome: "Manga", porcao: "110g (1/2 unidade)" },
        ],
      },
    ],
    dica: "Introduza um alimento novo por vez. Observe como se sente nas 48h seguintes.",
  },
  {
    semana: 2,
    titulo: "Semana 2",
    subtitulo: "Expandindo",
    categorias: [
      {
        titulo: "Carboidratos",
        alimentos: [
          { nome: "Cará", porcao: "160g" },
          { nome: "Inhame", porcao: "160g" },
        ],
      },
      {
        titulo: "Gorduras",
        alimentos: [
          { nome: "Avelã", porcao: "15g" },
          { nome: "Azeitona", porcao: "40g" },
          { nome: "Chocolate amargo (70%+)", porcao: "20g" },
          { nome: "Nozes", porcao: "15g" },
        ],
      },
      {
        titulo: "Proteínas",
        alimentos: [{ nome: "Cottage", porcao: "60g" }],
      },
    ],
  },
  {
    semana: 3,
    titulo: "Semana 3",
    subtitulo: "Aprofundando",
    categorias: [
      {
        titulo: "Carboidratos",
        alimentos: [
          { nome: "Mel", porcao: "8g (1 colher de chá)" },
          { nome: "Batata doce", porcao: "160g" },
          { nome: "Pão", porcao: "1 fatia (30g)" },
        ],
      },
      {
        titulo: "Gorduras",
        alimentos: [
          { nome: "Manteiga", porcao: "5g" },
          { nome: "Queijo brie", porcao: "30g" },
          { nome: "Pistache", porcao: "15g" },
        ],
      },
      {
        titulo: "Proteínas",
        alimentos: [
          { nome: "Carnes vermelhas variadas", porcao: "120g" },
          { nome: "Whey protein", porcao: "30g" },
        ],
      },
      {
        titulo: "Frutas",
        alimentos: [{ nome: "Todas liberadas", porcao: "1 porção" }],
      },
      {
        titulo: "Vegetais",
        alimentos: [
          { nome: "Brócolis", porcao: "livre" },
          { nome: "Couve-flor", porcao: "livre" },
        ],
      },
    ],
  },
  {
    semana: 4,
    titulo: "Semana 4",
    subtitulo: "Consolidação",
    categorias: [
      {
        titulo: "Carboidratos",
        alimentos: [
          { nome: "Feijão", porcao: "85g" },
          { nome: "Lentilha", porcao: "85g" },
          { nome: "Grão-de-bico", porcao: "85g" },
        ],
      },
      {
        titulo: "Temperos",
        alimentos: [
          { nome: "Alho", porcao: "livre" },
          { nome: "Cebola", porcao: "livre" },
        ],
      },
      {
        titulo: "Laticínios e outros",
        alimentos: [
          { nome: "Leite", porcao: "200ml" },
          { nome: "Iogurte", porcao: "170g" },
          { nome: "Kefir", porcao: "200ml" },
          { nome: "Queijos", porcao: "30g" },
        ],
      },
      {
        titulo: "Vegetais",
        alimentos: [
          { nome: "Salada crua (folhas, legumes crus)", porcao: "livre" },
        ],
      },
    ],
  },
];

const BRISTOL = [
  { n: 1, label: "Tipo 1", desc: "Bolinhas duras separadas", hint: "Constipação severa", cor: "#7A4B3A" },
  { n: 2, label: "Tipo 2", desc: "Formato de salsicha com bolinhas", hint: "Constipação leve", cor: "#9A6B47" },
  { n: 3, label: "Tipo 3", desc: "Salsicha com fendas na superfície", hint: "Normal", cor: "#7E9163" },
  { n: 4, label: "Tipo 4", desc: "Salsicha lisa e macia", hint: "Ideal", cor: "#6E8168" },
  { n: 5, label: "Tipo 5", desc: "Pedaços macios com bordas definidas", hint: "Falta de fibra", cor: "#A99640" },
  { n: 6, label: "Tipo 6", desc: "Massa fofa com bordas irregulares", hint: "Inflamação leve", cor: "#C08540" },
  { n: 7, label: "Tipo 7", desc: "Totalmente líquida", hint: "Diarreia", cor: "#B0503C" },
];

function BristolIcon({ tipo, cor }: { tipo: number; cor: string }) {
  const w = 72;
  const h = 32;
  const darken = (c: string, amt: number) => {
    const n = parseInt(c.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) - amt);
    const g = Math.max(0, ((n >> 8) & 0xff) - amt);
    const b = Math.max(0, (n & 0xff) - amt);
    return `rgb(${r},${g},${b})`;
  };
  const stroke = darken(cor, 40);

  const shapes: Record<number, JSX.Element> = {
    1: (
      <>
        <circle cx="14" cy="14" r="5" fill={cor} stroke={stroke} strokeWidth="1" />
        <circle cx="28" cy="18" r="5.5" fill={cor} stroke={stroke} strokeWidth="1" />
        <circle cx="42" cy="13" r="4.5" fill={cor} stroke={stroke} strokeWidth="1" />
        <circle cx="54" cy="17" r="5" fill={cor} stroke={stroke} strokeWidth="1" />
        <circle cx="66" cy="14" r="4" fill={cor} stroke={stroke} strokeWidth="1" />
      </>
    ),
    2: (
      <path
        d="M8,16 Q12,8 18,12 Q24,6 30,14 Q36,8 42,12 Q48,6 54,14 Q60,8 64,16 Q60,24 54,20 Q48,26 42,20 Q36,26 30,18 Q24,26 18,20 Q12,24 8,16Z"
        fill={cor} stroke={stroke} strokeWidth="1"
      />
    ),
    3: (
      <>
        <ellipse cx="36" cy="16" rx="28" ry="10" fill={cor} stroke={stroke} strokeWidth="1" />
        <line x1="16" y1="10" x2="18" y2="14" stroke={stroke} strokeWidth="0.8" />
        <line x1="26" y1="8" x2="27" y2="13" stroke={stroke} strokeWidth="0.8" />
        <line x1="36" y1="7" x2="36" y2="12" stroke={stroke} strokeWidth="0.8" />
        <line x1="46" y1="8" x2="45" y2="13" stroke={stroke} strokeWidth="0.8" />
        <line x1="56" y1="10" x2="54" y2="14" stroke={stroke} strokeWidth="0.8" />
      </>
    ),
    4: (
      <ellipse cx="36" cy="16" rx="28" ry="9" fill={cor} stroke={stroke} strokeWidth="1.2" />
    ),
    5: (
      <>
        <ellipse cx="14" cy="16" rx="8" ry="7" fill={cor} stroke={stroke} strokeWidth="1" />
        <ellipse cx="32" cy="14" rx="9" ry="8" fill={cor} stroke={stroke} strokeWidth="1" />
        <ellipse cx="50" cy="17" rx="8" ry="6" fill={cor} stroke={stroke} strokeWidth="1" />
        <ellipse cx="65" cy="15" rx="6" ry="7" fill={cor} stroke={stroke} strokeWidth="1" />
      </>
    ),
    6: (
      <path
        d="M6,18 Q10,8 20,14 Q28,6 36,16 Q44,8 52,14 Q58,6 66,18 Q60,26 50,22 Q44,28 36,20 Q28,26 20,22 Q12,26 6,18Z"
        fill={cor} stroke={stroke} strokeWidth="1" opacity="0.85"
      />
    ),
    7: (
      <>
        <ellipse cx="36" cy="18" rx="30" ry="6" fill={cor} opacity="0.5" />
        <path
          d="M8,16 Q16,10 24,16 Q32,10 40,16 Q48,10 56,16 Q64,10 66,14"
          fill="none" stroke={cor} strokeWidth="2.5" strokeLinecap="round"
        />
      </>
    ),
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ flexShrink: 0 }}>
      {shapes[tipo]}
    </svg>
  );
}

export function HotSlimReintroducao() {
  const { acesso } = useSessao();
  const fasesLiberadas = acesso.hotslimFases ?? [];
  const isAdmin = acesso.papel === "admin";

  function liberada(semana: number): boolean {
    return isAdmin || fasesLiberadas.includes(semana);
  }

  return (
    <div className="hs-pagina">
      <h1 className="hs-titulo">Reintrodução</h1>
      <p className="hs-texto">Volte a comer com segurança, semana por semana</p>

      <div className="hs-dica" style={{ marginBottom: 20 }}>
        <strong>Como funciona:</strong> Após os 6 dias de repouso, começa a reintrodução guiada.
        Teste um alimento novo por vez e observe por 48 horas se há sintomas (gases, inchaço, dor, alteração intestinal).
        As fases desbloqueiam automaticamente conforme suas semanas avançam.
      </div>

      {FASES.map((fase) => {
        const aberta = liberada(fase.semana);
        return (
          <div
            key={fase.semana}
            className={`hs-fase ${aberta ? "desbloqueada" : "bloqueada"}`}
          >
            <div className="hs-fase-header">
              <span style={{ fontWeight: 700 }}>{fase.titulo}</span>
              <span className="hs-texto" style={{ margin: 0 }}>— {fase.subtitulo}</span>
              <span className="hs-fase-lock">{aberta ? "Liberada" : "Bloqueada"}</span>
            </div>

            {aberta && (
              <div className="hs-fase-body">
                {fase.categorias.map((cat) => (
                  <div className="hs-list-section" key={cat.titulo} style={{ marginBottom: 16 }}>
                    <div className="hs-list-header">{cat.titulo}</div>
                    <div className="hs-list-card">
                      {cat.alimentos.map((a) => (
                        <div key={a.nome} className="hs-list-item static">
                          <span className="hs-list-item-name">{a.nome}</span>
                          <span className="hs-list-item-detail">{a.porcao}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {fase.dica && (
                  <div className="hs-dica" style={{ marginTop: 4 }}>
                    <strong>Dica:</strong> {fase.dica}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="c-secao" style={{ marginTop: 28 }}>
        <h2 className="c-secao-titulo">Escala de Bristol</h2>
        <p className="hs-texto" style={{ marginBottom: 12 }}>
          Observe suas fezes durante a reintrodução — o formato diz muito sobre como seu intestino
          está reagindo aos alimentos testados. O ideal é ficar entre os tipos 3 e 4.
        </p>
        <div className="hs-list-card">
          {BRISTOL.map((b) => (
            <div key={b.n} className="hs-list-item static" style={{ gap: 10, alignItems: "center" }}>
              <BristolIcon tipo={b.n} cor={b.cor} />
              <span className="hs-list-item-name" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{b.label}: {b.desc}</span>
              </span>
              <span className="hs-list-item-detail" style={{
                color: b.n === 3 || b.n === 4 ? "var(--hs-green)" : "var(--hs-fg-soft)",
                fontWeight: b.n === 4 ? 700 : 400,
              }}>
                {b.hint}
              </span>
            </div>
          ))}
        </div>
        <div className="hs-dica" style={{ marginTop: 12, borderColor: "var(--hs-green)", background: "var(--hs-green-soft)" }}>
          <strong style={{ color: "var(--hs-green)" }}>Tipo 4 = ideal.</strong> Se após testar
          um alimento seu intestino sair do padrão 3–4 por mais de 1 dia, retire esse alimento e
          converse com sua nutricionista.
        </div>
      </div>

      <div className="hs-dica" style={{ marginTop: 16 }}>
        <strong>Atenção:</strong> Se algum alimento causar desconforto (gases, inchaço,
        dor, alteração na escala de Bristol), retire-o por mais uma semana e tente novamente.
        Isso é normal e faz parte do rastreio.
      </div>
    </div>
  );
}
