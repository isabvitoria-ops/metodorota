import { useSessao } from "@/central/autenticacao/SessaoContexto";

interface Alimento {
  emoji: string;
  nome: string;
}

interface Categoria {
  titulo: string;
  emoji: string;
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
        emoji: "🥑",
        alimentos: [{ emoji: "🥑", nome: "Abacate" }],
      },
      {
        titulo: "Frutas",
        emoji: "🍑",
        alimentos: [
          { emoji: "🍐", nome: "Pêra" },
          { emoji: "🍑", nome: "Pêssego" },
          { emoji: "🥭", nome: "Manga" },
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
        emoji: "🍠",
        alimentos: [
          { emoji: "🍠", nome: "Cará" },
          { emoji: "🍠", nome: "Inhame" },
        ],
      },
      {
        titulo: "Gorduras",
        emoji: "🥜",
        alimentos: [
          { emoji: "🌰", nome: "Avelã" },
          { emoji: "🫒", nome: "Azeitona" },
          { emoji: "🍫", nome: "Chocolate amargo (70%+)" },
          { emoji: "🥜", nome: "Nozes" },
        ],
      },
      {
        titulo: "Proteínas",
        emoji: "🧀",
        alimentos: [{ emoji: "🧀", nome: "Cottage" }],
      },
      {
        titulo: "Frutas",
        emoji: "🍇",
        alimentos: [
          { emoji: "🍇", nome: "Uva" },
          { emoji: "🍍", nome: "Abacaxi" },
          { emoji: "🍊", nome: "Laranja" },
        ],
      },
      {
        titulo: "Vegetais",
        emoji: "🥒",
        alimentos: [
          { emoji: "🥒", nome: "Abobrinha italiana" },
          { emoji: "🍆", nome: "Berinjela" },
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
        emoji: "🍯",
        alimentos: [
          { emoji: "🍯", nome: "Mel" },
          { emoji: "🍠", nome: "Batata doce" },
        ],
      },
      {
        titulo: "Gorduras",
        emoji: "🧈",
        alimentos: [
          { emoji: "🧈", nome: "Manteiga" },
          { emoji: "🧀", nome: "Queijo brie" },
          { emoji: "🥜", nome: "Pistache" },
        ],
      },
      {
        titulo: "Proteínas",
        emoji: "🥩",
        alimentos: [
          { emoji: "🥩", nome: "Carnes vermelhas variadas" },
          { emoji: "🥛", nome: "Whey protein" },
        ],
      },
      {
        titulo: "Frutas",
        emoji: "🍊",
        alimentos: [{ emoji: "🍊", nome: "Todas liberadas" }],
      },
      {
        titulo: "Vegetais",
        emoji: "🥦",
        alimentos: [
          { emoji: "🥦", nome: "Brócolis" },
          { emoji: "🥦", nome: "Couve-flor" },
          { emoji: "🥬", nome: "Folhas verdes" },
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
        emoji: "🫘",
        alimentos: [
          { emoji: "🫘", nome: "Feijão" },
          { emoji: "🫘", nome: "Lentilha" },
          { emoji: "🫘", nome: "Grão-de-bico" },
          { emoji: "🌾", nome: "Quinoa" },
        ],
      },
      {
        titulo: "Vegetais",
        emoji: "🧄",
        alimentos: [
          { emoji: "🧄", nome: "Alho" },
          { emoji: "🧅", nome: "Cebola" },
        ],
      },
      {
        titulo: "Gorduras / Proteínas",
        emoji: "🥛",
        alimentos: [
          { emoji: "🥛", nome: "Leite" },
          { emoji: "🥛", nome: "Iogurte" },
          { emoji: "🥛", nome: "Kefir" },
          { emoji: "🧀", nome: "Queijos" },
          { emoji: "🥜", nome: "Amendoim" },
        ],
      },
    ],
  },
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
      <div style={{ marginBottom: 4 }}>
        <span className="hs-emoji">🔄</span>
      </div>
      <h1 className="hs-titulo hs-titulo-gradient">Mapa de Reintrodução</h1>
      <p className="hs-texto">Volte a comer com segurança, semana por semana</p>

      <div className="hs-dica" style={{ marginBottom: 20 }}>
        <strong>💡 Dica:</strong> Após os 6 dias de GUTCODE, começa a reintrodução guiada.
        Cada semana libera novos alimentos. Sua nutricionista desbloqueia as fases conforme
        seu progresso.
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
              <span className="hs-fase-lock">{aberta ? "🔓" : "🔒"}</span>
            </div>

            {aberta && (
              <div className="hs-fase-body">
                {fase.categorias.map((cat) => (
                  <div key={cat.titulo}>
                    <div className="hs-cat-header">
                      <span>{cat.emoji}</span> {cat.titulo}
                    </div>
                    <div className="hs-alimentos">
                      {cat.alimentos.map((a) => (
                        <span key={a.nome} className="hs-alimento">
                          {a.emoji} {a.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {fase.dica && (
                  <div className="hs-dica" style={{ marginTop: 12 }}>
                    <strong>💡</strong> {fase.dica}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="hs-dica">
        <strong>🔬 Atenção:</strong> Se algum alimento causar desconforto (gases, inchaço,
        dor), retire-o por mais uma semana e tente novamente. Isso é normal e faz parte do
        rastreio.
      </div>
    </div>
  );
}
