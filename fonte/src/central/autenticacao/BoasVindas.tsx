import { useEffect } from "react";
import { Marca } from "@/central/components/Marca";
import { InstalarNaTela } from "@/central/components/InstalarNaTela";
import { jaEstaInstalado } from "@/central/utils/plataforma";
import { useSessao } from "./SessaoContexto";

/**
 * As boas-vindas da primeira entrada: ensina a colocar o site na tela inicial.
 *
 * Aparece UMA vez, depois do aceite do termo, e nunca mais — o registro fica no
 * banco, então trocar de telefone ou limpar o navegador não a traz de volta.
 * "Entendi" e "Agora não" contam igual: a nutricionista pediu que não repita. Quem
 * quiser rever encontra o guia em "Colocar na tela inicial", na tela inicial.
 *
 * Se o app já está aberto como aplicativo (ícone da tela inicial), ela já fez; nada a ensinar.
 */
export function BoasVindas() {
  const { concluirBoasVindas } = useSessao();
  const instalado = jaEstaInstalado(window as unknown as Parameters<typeof jaEstaInstalado>[0]);

  useEffect(() => {
    if (instalado) void concluirBoasVindas();
  }, [instalado, concluirBoasVindas]);

  if (instalado) return null;

  return (
    <div className="central">
      <div className="c-conta">
        <div className="c-conta-caixa c-termo">
          <Marca altura={40} />
          <h1 className="c-titulo" style={{ fontSize: 26, marginTop: 10 }}>
            Você é novo por aqui?
          </h1>
          <p className="c-subtitulo">
            Coloque o app na tela do seu celular, como qualquer outro aplicativo. Leva uns 20 segundos e você nunca mais
            precisa procurar o link.
          </p>
          <InstalarNaTela aoConcluir={() => void concluirBoasVindas()} aoPular={() => void concluirBoasVindas()} />
        </div>
      </div>
    </div>
  );
}
