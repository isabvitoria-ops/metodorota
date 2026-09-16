import type { BristolTipo } from "@/types";

/** SVGs da escala de Bristol — porte literal do protótipo (`DesenhoBristol`). */
export function DesenhoBristol({ tipo, cor, size = 44 }: { tipo: BristolTipo; cor: string; size?: number }) {
  const p = { fill: cor };
  const shapes: Record<BristolTipo, JSX.Element> = {
    1: (
      <g>
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={12 + i * 10} cy={22} r={4.6} {...p} />
        ))}
      </g>
    ),
    2: (
      <g>
        <rect x="6" y="17" width="32" height="11" rx="5.5" {...p} />
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={11 + i * 7.5} cy={22} r={4.4} fill={cor} stroke="#fff" strokeWidth="1.1" />
        ))}
      </g>
    ),
    3: (
      <g>
        <rect x="5" y="18" width="34" height="9" rx="4.5" {...p} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={13 + i * 8} y="18" width="1.6" height="9" fill="#fff" opacity=".85" />
        ))}
      </g>
    ),
    4: <rect x="4" y="18.5" width="36" height="8" rx="4" {...p} />,
    5: (
      <g>
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx={12 + i * 10} cy={22} rx={5.6} ry={4.4} {...p} />
        ))}
      </g>
    ),
    6: <path d="M7 22c0-4 4-5 6-3s3-3 6-2 3 4 6 3 5 1 6 3-3 5-8 5-16 0-16-6z" {...p} />,
    7: (
      <g>
        <path d="M5 24c6-3 10 2 16 0s10-2 14 1c-3 3-9 4-15 4s-12-2-15-5z" {...p} />
        <ellipse cx="30" cy="19" rx="3" ry="2" {...p} opacity=".6" />
      </g>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      {shapes[tipo]}
    </svg>
  );
}
