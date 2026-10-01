import { useNavigate } from "react-router-dom";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { InstalarNaTela } from "@/central/components/InstalarNaTela";
import { rotas } from "@/central/rotas";

/** O mesmo guia das boas-vindas, para quem quer rever depois. Aqui não registra nada. */
export function InstalarPagina() {
  const navegar = useNavigate();
  return (
    <>
      <CabecalhoPagina
        titulo="Colocar na tela inicial"
        descricao="Para abrir o app com um toque, como qualquer outro aplicativo."
        voltarPara={rotas.home}
      />
      <div className="c-conteudo">
        <InstalarNaTela aoConcluir={() => navegar(rotas.home)} rotuloDoBotao="Voltar ao início" />
      </div>
    </>
  );
}
