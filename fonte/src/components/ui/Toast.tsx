import { useToastStore } from "@/store/toastStore";

/**
 * Toast fixo no rodapé. `bottom` difere entre o app do paciente (acima da
 * barra de abas) e o painel (sem barra de abas) — cada shell passa o valor.
 */
export function Toast({ bottom = 22 }: { bottom?: number }) {
  const mensagem = useToastStore((s) => s.mensagem);
  if (!mensagem) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--ink)",
        color: "#fff",
        padding: "13px 20px",
        borderRadius: 13,
        fontSize: 14,
        zIndex: 60,
        maxWidth: 420,
        textAlign: "center",
      }}
    >
      {mensagem}
    </div>
  );
}
