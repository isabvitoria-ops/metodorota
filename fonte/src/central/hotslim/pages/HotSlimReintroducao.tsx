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
        <strong>Atenção:</strong> Após os 6 dias de repouso, começa a reintrodução guiada.
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

      <div className="hs-dica">
        <strong>Atenção:</strong> Se algum alimento causar desconforto (gases, inchaço,
        dor), retire-o por mais uma semana e tente novamente. Isso é normal e faz parte do
        rastreio.
      </div>
    </div>
  );
}
