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
      {
        titulo: "Frutas",
        alimentos: [
          { nome: "Uva", porcao: "100g" },
          { nome: "Abacaxi", porcao: "130g" },
          { nome: "Laranja", porcao: "150g (1 unidade)" },
        ],
      },
      {
        titulo: "Vegetais",
        alimentos: [
          { nome: "Abobrinha italiana", porcao: "livre" },
          { nome: "Berinjela", porcao: "livre" },
        ],
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
          { nome: "Folhas verdes", porcao: "livre" },
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
          { nome: "Quinoa", porcao: "80g" },
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
          { nome: "Amendoim", porcao: "15g" },
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
        Sua nutricionista desbloqueia as fases conforme seu progresso.
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
            <div key={b.n} className="hs-list-item static" style={{ gap: 10 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: b.cor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {b.n}
              </span>
              <span className="hs-list-item-name" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{b.desc}</span>
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
