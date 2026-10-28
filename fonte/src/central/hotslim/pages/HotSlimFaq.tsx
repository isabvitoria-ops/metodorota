export function HotSlimFaq() {
  return (
    <div className="hs-pagina">
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div className="hs-emoji">❓</div>
        <h1 className="hs-titulo">Dúvidas Frequentes</h1>
        <p className="hs-texto">Tudo que você precisa saber sobre o desafio</p>
      </div>

      <Pergunta
        emoji="🍽️"
        titulo="Posso pular uma refeição?"
        resposta="Não! As 4 refeições são importantes para manter o metabolismo ativo e evitar compulsão. Se não estiver com fome, faça uma refeição menor, mas não pule."
      />
      <Pergunta
        emoji="☕"
        titulo="Posso tomar café?"
        resposta="Sim, mas limitado a 150mg de cafeína por dia — equivale a cerca de 1 xícara de café coado. Prefira café coado e evite espresso duplo. Chás também contam na cota de cafeína."
      />
      <Pergunta
        emoji="🍬"
        titulo="Posso mascar chiclete?"
        resposta="Evite durante o GUTCODE. Chicletes contêm adoçantes artificiais (sorbitol, xilitol) que podem causar gases e desconforto intestinal — justamente o que queremos evitar."
      />
      <Pergunta
        emoji="💊"
        titulo="Posso tomar suplementos?"
        resposta="Suplementos que você já usa com orientação médica podem continuar. Não inicie nenhum suplemento novo durante o desafio sem consultar sua nutricionista."
      />
      <Pergunta
        emoji="🏋️"
        titulo="Posso treinar durante o desafio?"
        resposta="Sim! Atividade física é bem-vinda. Nos primeiros dias do GUTCODE, você pode sentir menos energia — prefira treinos mais leves. A partir do dia 4, a disposição costuma voltar."
      />
      <Pergunta
        emoji="🍷"
        titulo="Posso beber álcool?"
        resposta="Não durante os 21 dias. O álcool irrita a mucosa intestinal e prejudica todo o trabalho de recuperação. Depois do desafio, com moderação."
      />
      <Pergunta
        emoji="🤢"
        titulo="Estou com gases/inchaço nos primeiros dias. É normal?"
        resposta="Pode acontecer nos primeiros 2-3 dias enquanto o intestino se adapta. Se persistir além do dia 4, avise no grupo do WhatsApp. Geralmente melhora muito a partir do dia 3."
      />
      <Pergunta
        emoji="🔄"
        titulo="O que faço se um alimento da reintrodução me causar desconforto?"
        resposta="Retire esse alimento por mais uma semana e tente novamente depois. Anote no seu checklist diário o que sentiu. Isso faz parte do rastreio — é assim que você descobre o que funciona para você."
      />
      <Pergunta
        emoji="📱"
        titulo="Onde tiro dúvidas durante o desafio?"
        resposta="No grupo de WhatsApp do desafio! Lá você tem suporte direto e pode trocar experiências com as outras participantes."
      />
      <Pergunta
        emoji="⏰"
        titulo="E depois dos 21 dias?"
        resposta="O desafio termina, mas o aprendizado fica! Você vai saber quais alimentos funcionam para você e terá uma rotina alimentar mais consciente. Use o mapa de reintrodução para continuar o rastreio."
      />

      <div className="hs-dica" style={{ marginTop: 24 }}>
        <strong>💬 Não encontrou sua dúvida?</strong> Mande no grupo do WhatsApp! Sua pergunta pode ajudar outras participantes também.
      </div>
    </div>
  );
}

function Pergunta({ emoji, titulo, resposta }: { emoji: string; titulo: string; resposta: string }) {
  return (
    <details className="hs-accordion">
      <summary>
        <span>{emoji}</span> {titulo}
      </summary>
      <div className="hs-accordion-body">{resposta}</div>
    </details>
  );
}
