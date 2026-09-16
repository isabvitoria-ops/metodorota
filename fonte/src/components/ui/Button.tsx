import type { ButtonHTMLAttributes } from "react";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "solido" | "ghost" | "quiet" | "danger";
  full?: boolean;
}

export function Btn({ variante = "solido", full, className = "", ...rest }: BtnProps) {
  const classes = [
    "btn",
    variante === "ghost" ? "ghost" : "",
    variante === "quiet" ? "quiet" : "",
    variante === "danger" ? "danger" : "",
    full ? "full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type="button" className={classes} {...rest} />;
}
