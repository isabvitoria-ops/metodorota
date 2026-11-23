import { rotas } from "@/central/rotas";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { GuiaDasMedidas } from "@/central/components/MedidaCaseira";

/** O que cada medida do plano quer dizer (plano em medidas caseiras). */
export function MinhasMedidas() {
  return (
    <>
      <CabecalhoPagina titulo="Minhas medidas" descricao="O que cada medida do seu plano quer dizer." voltarPara={rotas.protocolo} />
      <div className="c-conteudo">
        <GuiaDasMedidas />
        <p className="c-dica" style={{ marginTop: 14 }}>
          Os desenhos comparam os utensílios entre si. Na dúvida, mostre a sua colher para a sua nutricionista na consulta.
        </p>
      </div>
    </>
  );
}
