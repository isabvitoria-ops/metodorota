import { useEffect, useRef, useState } from "react";
import { Receitas } from "./Receitas";
import { Agenda } from "./Agenda";
import { FeedDeFotos } from "./FeedDeFotos";
import { Notificacoes } from "./Notificacoes";
import { repositorio } from "@/central/dados/repositorio";
import { Icone } from "@/central/components/Icone";
import { PedidoDeExames } from "./PedidoDeExames";
import { EstiloDoApp } from "./EstiloDoApp";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Marca } from "@/central/components/Marca";
import { FaixaDemonstracao } from "@/central/components/FaixaDemonstracao";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";
import { Pacientes } from "./Pacientes";
import { Alimentos } from "./Alimentos";
import { Questionarios } from "./Questionarios";
import { Financeiro } from "./Financeiro";
import { Equivalencias } from "./Equivalencias";
import { Conteudos } from "./Conteudos";
import { ConfiguracoesAdmin } from "./Configuracoes";
import { Desafios } from "./Desafios";
import { RastreabilidadeAdmin } from "./Rastreabilidade";
import { Protocolos } from "./Protocolos";
import { Prontuario } from "./Prontuario";
import { Metas } from "./Metas";
import { Treinos } from "./Treinos";
import { CerebroDoNutri } from "./Cerebro";
import { HotSlimAdmin } from "./HotSlimAdmin";
import { Calculos } from "./Calculos";
import { MenuMais } from "@/central/components/MenuMais";

/**
 * Área da nutricionista.
 *
 * Mesma identidade visual da Central, com densidade maior: aqui a tarefa é
 * gerenciar, não consultar. As abas em vez de menu lateral porque isto
 * também vai ser aberto no celular entre um atendimento e outro.
 */
/**
 * As abas do menu dela.
 *
 * ALIMENTOS E CONTEUDOS SAIRAM DAQUI a pedido dela -- mas as TELAS
 * continuam de pe, e as rotas tambem (`/admin/alimentos` e
 * `/admin/conteudos` abrem normalmente se ela digitar o endereco).
 *
 * Apagar as telas junto seria outra coisa: ela perderia o unico lugar onde
 * se cadastra alimento novo, e as equivalencias -- que ela quer manter --
 * sao construidas em cima desses alimentos. Tirar do menu limpa a tela sem
 * tirar nada de dentro.
 */
const ABAS = [
  { rota: rotas.adminPacientes, rotulo: "Pacientes" },
  { rota: rotas.adminAgenda, rotulo: "Agenda" },
  { rota: rotas.adminQuestionarios, rotulo: "Check-in" },
  { rota: rotas.adminTreinos, rotulo: "Treino" },
  { rota: rotas.adminDesafios, rotulo: "Desafio" },
  { rota: rotas.adminFinanceiro, rotulo: "Cobrança" },
];

/**
 * O que ela abre de vez em quando fica no "Mais". Eram dez abas numa régua
 * que rolava de lado, e no celular metade ficava fora da tela.
 */
const MAIS = [
  { rota: rotas.adminFotos, rotulo: "Daily dos pacientes" },
  { rota: rotas.adminNotificacoes, rotulo: "Notificações" },
  { rota: rotas.adminProtocolos, rotulo: "Protocolo" },
  { rota: rotas.adminCalculos, rotulo: "Cálculos" },
  { rota: rotas.adminReceitas, rotulo: "Receitas" },
  { rota: rotas.adminExames, rotulo: "Pedido de exames" },
  { rota: rotas.adminMetas, rotulo: "Metas" },
  { rota: rotas.adminEquivalencias, rotulo: "Equivalências" },
  { rota: rotas.adminHotSlim, rotulo: "Hot Slim" },
  { rota: rotas.adminRastreabilidade, rotulo: "Rastreabilidade" },
  { rota: rotas.adminCerebro, rotulo: "Cérebro" },
  { rota: rotas.adminEstilo, rotulo: "Estilo do app" },
  { rota: rotas.adminConfiguracoes, rotulo: "Configurações" },
];

export function AdminApp() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const { acesso, sair } = useSessao();
  const barraDeAbas = useRef<HTMLElement>(null);
  const secaoDoMais = MAIS.find((m) => pathname.startsWith(m.rota));
  const [novidades, definirNovidades] = useState(0);

  // O sino: quantas coisas novas as pacientes fizeram desde a última vez que
  // ela abriu as notificações. Confere ao entrar, a cada 2 minutos e quando
  // a tela de notificações avisa que marcou tudo como visto.
  useEffect(() => {
    if (acesso.papel !== "admin") return;
    let ativo = true;
    const conferir = () =>
      void repositorio
        .notificacoesDaNutri(14)
        .then((l) => ativo && definirNovidades(l.filter((n) => n.nova).length))
        // Sem saber (sem rede, 0098 ainda não aplicada), o sino fica sem número.
        .catch(() => ativo && definirNovidades(0));
    conferir();
    const relogio = window.setInterval(conferir, 120_000);
    const vistas = () => definirNovidades(0);
    window.addEventListener("central:notificacoes-vistas", vistas);
    return () => {
      ativo = false;
      window.clearInterval(relogio);
      window.removeEventListener("central:notificacoes-vistas", vistas);
    };
  }, [acesso.papel]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // A régua de abas rola de lado no celular, e não cabe inteira: com sete
  // abas, estando em "Rastreabilidade" ou "Configurações" a aba ativa ficava
  // fora da tela. A régua mostrava "Painel" no começo, e não havia como saber
  // em que seção ela estava. Trazer a ativa para o centro resolve, e no
  // computador — onde tudo cabe — não muda nada.
  useEffect(() => {
    const ativa = barraDeAbas.current?.querySelector(".ativo");
    ativa?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <div className="central">
      <div className="c-admin">
        <FaixaDemonstracao />
        <header className="c-admin-topo">
          <div className="c-admin-topo-linha">
            <div className="c-admin-marca">
              <Marca altura={34} />
              <span className="c-admin-papel">Área da nutricionista</span>
            </div>
            <div className="c-admin-topo-acoes">
              <NavLink
                to={rotas.adminNotificacoes}
                className="c-admin-sino"
                aria-label={novidades > 0 ? `Notificações: ${novidades} novas` : "Notificações"}
              >
                <Icone nome="sino" tamanho={22} />
                {novidades > 0 && <span className="c-admin-sino-conta">{novidades > 99 ? "99+" : novidades}</span>}
              </NavLink>
              <button
                type="button"
                className="c-botao c-botao-secundario c-botao-pequeno"
                onClick={() => navegar(rotas.home)}
              >
                Ver a Central
              </button>
            </div>
          </div>
          <div className="c-admin-abas-linha">
            <nav className="c-admin-abas" aria-label="Seções administrativas" ref={barraDeAbas}>
              {ABAS.map((aba) => (
                <NavLink
                  key={aba.rota}
                  to={aba.rota}
                  className={({ isActive }) =>
                    // O prontuário mora em /admin/paciente/:id -- sem o "s" --
                    // e é aberto de dentro de Pacientes. Sem isto, nenhuma aba
                    // ficava acesa enquanto ela estava na ficha clínica.
                    `c-admin-aba ${
                      isActive ||
                      (aba.rota === rotas.adminPacientes && pathname.startsWith("/admin/paciente/"))
                        ? "ativo"
                        : ""
                    }`
                  }
                >
                  {aba.rotulo}
                </NavLink>
              ))}
            </nav>
            {/* Fora da régua de propósito: dentro dela, que rola de lado, a
                lista aberta ficaria cortada. */}
            <MenuMais
              classe={`c-admin-aba c-admin-aba-mais ${secaoDoMais ? "ativo" : ""}`}
              gatilho={
                <>
                  <span className="c-aba-texto">{secaoDoMais?.rotulo ?? "Mais"}</span>{" "}
                  <span aria-hidden="true">▾</span>
                </>
              }
              itens={[
                ...MAIS.map((m) => ({
                  rotulo: m.rotulo,
                  ativo: m === secaoDoMais,
                  aoEscolher: () => navegar(m.rota),
                })),
                { rotulo: "Sair da conta", separar: true, aoEscolher: () => void sair() },
              ]}
            />
          </div>
        </header>

        <main className="c-admin-conteudo">
          {acesso.papel !== "admin" ? (
            <Navigate to={rotas.home} replace />
          ) : (
            <Routes>
              {/* Painel e Acompanhamento viraram a tela de Pacientes. Os
                  endereços antigos continuam valendo (favorito, link salvo)
                  e caem nela. */}
              <Route index element={<Navigate to={rotas.adminPacientes} replace />} />
              <Route path="pacientes" element={<Pacientes />} />
              <Route path="pacientes/:pacienteId" element={<Pacientes />} />
              <Route path="alimentos" element={<Alimentos />} />
              <Route path="equivalencias" element={<Equivalencias />} />
              <Route path="conteudos" element={<Conteudos />} />
              <Route path="desafios" element={<Desafios />} />
              <Route path="protocolos" element={<Protocolos />} />
              <Route path="protocolos/:pacienteId" element={<Protocolos />} />
              <Route path="calculos" element={<Calculos />} />
              <Route path="receitas" element={<Receitas />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="fotos" element={<FeedDeFotos />} />
              <Route path="notificacoes" element={<Notificacoes />} />
              <Route path="exames" element={<PedidoDeExames />} />
              <Route path="estilo" element={<EstiloDoApp />} />
              <Route path="treinos" element={<Treinos />} />
              <Route path="treinos/:pacienteId" element={<Treinos />} />
              <Route path="metas" element={<Metas />} />
              <Route path="metas/:pacienteId" element={<Metas />} />
              <Route path="questionarios" element={<Questionarios />} />
              <Route path="financeiro" element={<Financeiro />} />
              <Route path="acompanhamento" element={<Navigate to={rotas.adminPacientes} replace />} />
              {/* Sem aba propria: a ficha se abre pela lista, clicando na
                  paciente. Uma aba "Prontuario" no menu abriria em branco,
                  perguntando de quem. */}
              <Route path="paciente/:pacienteId" element={<Prontuario />} />
              <Route path="rastreabilidade" element={<RastreabilidadeAdmin />} />
              <Route path="rastreabilidade/:pacienteId" element={<RastreabilidadeAdmin />} />
              <Route path="cerebro" element={<CerebroDoNutri />} />
              <Route path="hotslim" element={<HotSlimAdmin />} />
              <Route path="configuracoes" element={<ConfiguracoesAdmin />} />
              <Route path="*" element={<Navigate to={rotas.admin} replace />} />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}
