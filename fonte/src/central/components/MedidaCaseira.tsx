/**
 * A medida caseira na tela da paciente: o desenho do utensílio, o texto,
 * o "ou" (quando dá para medir de dois jeitos) e, ao tocar, a explicação
 * "qual é essa colher?" com a fila de colheres e o rasa × cheia.
 */
import { useState } from "react";
import type { MedidaCaseira as Medida, Utensilio } from "@/central/types/protocolo";
import { ColherDeitada, IconeUtensilio, NivelDaColher } from "./Utensilios";
import { COLHERES, UTENSILIOS, nomeDoUtensilio } from "@/central/utils/utensilios";

const ehColher = (u: Utensilio) => COLHERES.includes(u);

export function LinhaDaMedida({ medida }: { medida: Medida }) {
  const [explicar, definirExplicar] = useState<Utensilio | null>(null);
  const nivel = medida.nivel ? (medida.nivel === "rasa" ? " rasa" : " cheia") : "";
  return (
    <>
      {medida.ou ? (
        <div className="c-md-ou">
          {[{ utensilio: medida.utensilio, texto: medida.texto + nivel }, medida.ou].map((m, i) => (
            <button key={i} type="button" className="c-md-op" onClick={() => definirExplicar(m.utensilio)}>
              <IconeUtensilio utensilio={m.utensilio} tamanho={46} />
              <span>{m.texto}</span>
            </button>
          ))}
          <span className="c-md-oux" aria-hidden="true">
            ou
          </span>
          <p className="c-md-ou-dica">Use um dos dois. Os dois dão a mesma quantidade.</p>
        </div>
      ) : (
        <button type="button" className="c-md-linha" onClick={() => definirExplicar(medida.utensilio)}>
          <span className="c-md-ic">
            <IconeUtensilio utensilio={medida.utensilio} tamanho={40} />
          </span>
          <span className="c-md-qtd">
            {medida.texto}
            {nivel}
            <small>Qual é essa medida?</small>
          </span>
        </button>
      )}
      {explicar && <QualEhAMedida utensilio={explicar} nivel={medida.nivel} aoFechar={() => definirExplicar(null)} />}
    </>
  );
}

export function QualEhAMedida({
  utensilio,
  nivel,
  aoFechar,
}: {
  utensilio: Utensilio;
  nivel?: "rasa" | "cheia";
  aoFechar: () => void;
}) {
  const info = UTENSILIOS.find((u) => u.chave === utensilio);
  return (
    <div className="c-md-veu" role="presentation" onClick={aoFechar}>
      <div
        className="c-md-folha"
        role="dialog"
        aria-modal="true"
        aria-label={`Qual é a ${nomeDoUtensilio(utensilio).toLowerCase()}?`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="c-md-alca" aria-hidden="true" />
        <p className="c-md-rot">Qual é {utensilio === "copo_americano" || utensilio === "file" || utensilio === "pedaco" || utensilio === "pegador" ? "o" : "a"} {nomeDoUtensilio(utensilio).toLowerCase()}?</p>
        <p className="c-md-desc">{info?.descricao}</p>
        {ehColher(utensilio) ? (
          <div className="c-md-fila">
            {COLHERES.map((c) => (
              <div key={c} className={c === utensilio ? "c-md-esta" : ""}>
                <span className="c-md-desenho">
                  <ColherDeitada utensilio={c} largura={160} />
                </span>
                <span>{nomeDoUtensilio(c)}</span>
                {c === utensilio && <span className="c-md-etiqueta">ESTA</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="c-md-grande">
            <IconeUtensilio utensilio={utensilio} tamanho={120} />
          </div>
        )}
        {ehColher(utensilio) && (
          <>
            <p className="c-md-rot" style={{ marginTop: 14 }}>
              Rasa ou cheia?
            </p>
            <div className="c-md-niveis">
              <div className={nivel === "rasa" ? "c-md-esta" : ""}>
                <NivelDaColher nivel="rasa" />
                <b>Rasa</b>
                <span>passe a faca por cima</span>
              </div>
              <div className={nivel === "cheia" ? "c-md-esta" : ""}>
                <NivelDaColher nivel="cheia" />
                <b>Cheia</b>
                <span>fica um montinho</span>
              </div>
            </div>
            <p className="c-md-desc" style={{ marginTop: 10 }}>
              {nivel ? `No seu plano está: ${nivel}.` : "Seu plano não diz rasa nem cheia: use do jeito de sempre."} Use sempre a mesma colher.
            </p>
          </>
        )}
        <button type="button" className="c-botao" onClick={aoFechar}>
          Entendi
        </button>
      </div>
    </div>
  );
}

/** A página "Minhas medidas": todos os utensílios, desenhados e descritos. */
export function GuiaDasMedidas() {
  return (
    <div className="c-md-grade">
      {UTENSILIOS.filter((u) => !["fatia", "unidade", "file", "pedaco"].includes(u.chave)).map((u) => (
        <div key={u.chave} className="c-md-ut">
          <IconeUtensilio utensilio={u.chave} tamanho={50} />
          <b>{u.nome}</b>
          <span>{u.descricao}</span>
        </div>
      ))}
    </div>
  );
}
