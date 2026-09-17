import { useEffect, useState, type ReactNode } from "react";
import { numeroDeTexto, textoDeNumero } from "@/central/utils/numero";

/**
 * Campos de formulário da área administrativa.
 *
 * Rótulo sempre visível, nunca só placeholder: quem está preenchendo dez
 * campos de cadastro precisa saber o que é cada um depois de já ter
 * digitado.
 */
export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="c-campo" style={{ display: "block" }}>
      <span className="c-rotulo">{rotulo}</span>
      {children}
      {dica && <span className="c-dica">{dica}</span>}
    </label>
  );
}

export function Texto({
  valor,
  aoMudar,
  tipo = "text",
  placeholder,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  tipo?: string;
  placeholder?: string;
}) {
  return (
    <input
      className="c-input"
      type={tipo}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );
}

export function AreaTexto({
  valor,
  aoMudar,
  placeholder,
  linhas = 4,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  linhas?: number;
}) {
  return (
    <textarea
      className="c-textarea"
      rows={linhas}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );
}

export function Selecao<T extends string>({
  valor,
  aoMudar,
  opcoes,
}: {
  valor: T;
  aoMudar: (v: T) => void;
  opcoes: { valor: T; rotulo: string }[];
}) {
  return (
    <select className="c-select" value={valor} onChange={(e) => aoMudar(e.target.value as T)}>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}

/** Lista escrita como texto, uma por linha — mais rápido que um editor de itens. */
export function listaDeLinhas(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function linhasDeLista(lista: string[]): string {
  return lista.join("\n");
}

/**
 * Lista escrita como texto, uma por linha — sem comer o que está sendo digitado.
 *
 * DEFEITO QUE ISTO CONSERTA: a caixa comum guardava a lista já limpa e
 * reescrevia o texto a partir dela a cada tecla. Como a limpeza tira espaço
 * do fim e joga linha vazia fora, digitar "pão " apagava o espaço no mesmo
 * instante — era impossível escrever "pão francês" — e apertar Enter não
 * abria linha nova. Da cadeira dela parecia que a tela não estava salvando.
 *
 * Agora o texto cru mora aqui dentro enquanto ela escreve, e a lista limpa
 * só sai para o pai. O texto só é reescrito quando a mudança vem de fora
 * (trocar de paciente, carregar outro rascunho) — comparando a lista, nunca
 * o texto, senão a ressincronização voltaria a comer o espaço.
 */
export function AreaDeLinhas({
  valor,
  aoMudar,
  placeholder,
  linhas = 2,
}: {
  valor: string[];
  aoMudar: (lista: string[]) => void;
  placeholder?: string;
  linhas?: number;
}) {
  const [texto, definirTexto] = useState(() => linhasDeLista(valor));

  useEffect(() => {
    if (linhasDeLista(listaDeLinhas(texto)) !== linhasDeLista(valor)) {
      definirTexto(linhasDeLista(valor));
    }
    // `texto` de propósito fora da lista: ele muda a cada tecla, e reagir a
    // isso traria de volta exatamente o defeito que este componente conserta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <textarea
      className="c-textarea"
      rows={linhas}
      value={texto}
      placeholder={placeholder}
      onChange={(e) => {
        definirTexto(e.target.value);
        aoMudar(listaDeLinhas(e.target.value));
      }}
    />
  );
}

/**
 * Um número decimal escrito do jeito daqui, com vírgula.
 *
 * `<input type="number">` parece a escolha óbvia e não é: o que ele aceita
 * depende do idioma do navegador. Num navegador em inglês, digitar "10,9"
 * não dá erro nenhum — o campo devolve vazio, e um percentual de gordura
 * some sem ninguém ver. Em avaliação física isso é número clínico indo
 * embora calado.
 *
 * Aqui o texto mora como ela digitou (inclusive estados no meio do caminho,
 * como "47," ou "-"), e só vira número na saída. Mesmo motivo do
 * `AreaDeLinhas` logo acima: normalizar a cada tecla briga com quem digita.
 */
export function NumeroDecimal({
  valor,
  aoMudar,
  placeholder,
}: {
  valor: number | null;
  aoMudar: (valor: number | null) => void;
  placeholder?: string;
}) {
  const [texto, definirTexto] = useState(() => textoDeNumero(valor));

  useEffect(() => {
    if (numeroDeTexto(texto) !== valor) definirTexto(textoDeNumero(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return (
    <input
      className="c-input"
      type="text"
      inputMode="decimal"
      value={texto}
      placeholder={placeholder}
      onChange={(e) => {
        definirTexto(e.target.value);
        aoMudar(numeroDeTexto(e.target.value));
      }}
    />
  );
}
