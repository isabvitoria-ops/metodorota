interface SwitchProps {
  ativo: boolean;
  onClick: () => void;
  label: string;
}

/** Porte literal do `Switch` do painel — reaproveitado também no app do paciente (Lembretes). */
export function Switch({ ativo, onClick, label }: SwitchProps) {
  return (
    <button
      type="button"
      className="sw"
      onClick={onClick}
      aria-label={label}
      aria-pressed={ativo}
      style={{ background: ativo ? "var(--plum)" : "var(--line)" }}
    >
      <span style={{ left: ativo ? 23 : 3 }} />
    </button>
  );
}
