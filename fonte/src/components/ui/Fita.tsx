import { corBristol } from "@/constants/bristol";
import { rotuloDiaSemana } from "@/utils/datas";
import type { BristolTipo } from "@/types";

export interface PontoFita {
  dia: Date;
  bristol: BristolTipo | null;
  hoje?: boolean;
}

/** "Fita" — assinatura visual do histórico de Bristol. Porte literal do protótipo. */
export function Fita({ dados, altura = 46, mostrarDias = true }: { dados: PontoFita[]; altura?: number; mostrarDias?: boolean }) {
  return (
    <div>
      <div className="ribbon" style={{ height: altura }}>
        {dados.map((d, i) => {
          const h = 34 + (d.bristol ? Math.abs(4 - d.bristol) * 3 : 0);
          return (
            <div
              key={i}
              className={`tick ${d.hoje ? "today" : ""} ${!d.bristol ? "empty" : ""}`}
              style={{
                height: d.bristol ? `${Math.min(h, altura)}px` : `${altura * 0.5}px`,
                background: d.bristol ? corBristol(d.bristol) : "transparent",
                animationDelay: `${i * 26}ms`,
              }}
              title={d.bristol ? `Tipo ${d.bristol}` : "Sem registro"}
            />
          );
        })}
      </div>
      {mostrarDias && (
        <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
          {dados.map((d, i) => (
            <div
              key={i}
              className="mono"
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 9.5,
                color: d.hoje ? "var(--ink)" : "var(--ink-3)",
                fontWeight: d.hoje ? 500 : 400,
              }}
            >
              {rotuloDiaSemana(d.dia)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
