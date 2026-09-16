import type { ButtonHTMLAttributes } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ativo?: boolean;
  variante?: "padrao" | "warn" | "sage";
  tamanho?: "padrao" | "sm";
}

export function Chip({ ativo, variante = "padrao", tamanho = "padrao", className = "", ...rest }: ChipProps) {
  const classes = [
    "chip",
    ativo ? "on" : "",
    variante !== "padrao" ? variante : "",
    tamanho === "sm" ? "sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type="button" className={classes} aria-pressed={ativo} {...rest} />;
}
