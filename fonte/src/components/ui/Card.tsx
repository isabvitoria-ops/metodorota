import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest} />;
}

/** Cartão clicável — mesmo visual do Card, mas como `<button>` para não perder semântica/teclado. */
export function CardBotao({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`card ${className}`}
      style={{ border: 0, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit", display: "block" }}
      {...rest}
    />
  );
}

export function Eyebrow({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`eyebrow ${className}`} {...rest} />;
}

export function Hair() {
  return <hr className="hair" />;
}
