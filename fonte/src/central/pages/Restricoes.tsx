import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { rotas } from "@/central/rotas";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import type { RestricaoAlimentar, GravidadeRestricao, TipoRestricao } from "@/central/types/restricao";
import { Esqueleto } from "@/central/components/Esqueleto";

function rotuloTipo(t: TipoRestricao): string {
  const m: Record<TipoRestricao, string> = {
    alergia: "Alergia",
    intolerancia: "Intolerância",
    sensibilidade: "Sensibilidade",
    preferencia: "Preferência",
  };
  return m[t];
}

function rotuloGravidade(g: GravidadeRestricao): string {
  const m: Record<GravidadeRestricao, string> = {
    grave: "Grave",
    moderada: "Moderada",
    leve: "Leve",
  };
  return m[g];
}

function seloGravidade(g: GravidadeRestricao): string {
  const m: Record<GravidadeRestricao, string> = {
    grave: "c-restricao-selo c-restricao-selo-grave",
    moderada: "c-restricao-selo c-restricao-selo-moderada",
    leve: "c-restricao-selo c-restricao-selo-leve",
  };
  return m[g];
}

export function Restricoes() {
  const { acesso } = useSessao();
  const [lista, definirLista] = useState<RestricaoAlimentar[]>([]);
  const [carregando, definirCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const r = await repositorio.minhasRestricoes();
      definirLista(r);
    } catch {
      /* silencioso */
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!acesso.restricoes) return <Navigate to={rotas.home} replace />;

  if (carregando) {
    return (
      <>
        <CabecalhoPagina titulo="Minhas restrições" voltarPara={rotas.home} />
        <Esqueleto linhas={4} />
      </>
    );
  }

  if (lista.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Minhas restrições" voltarPara={rotas.home} />
        <EstadoVazio
          icone="alerta"
          titulo="Nenhuma restrição cadastrada"
          descricao="Quando sua nutricionista registrar alergias, intolerâncias ou cuidados especiais, eles aparecem aqui."
        />
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Minhas restrições"
        descricao="Alergias, intolerâncias e cuidados com a sua alimentação."
        voltarPara={rotas.home}
      />

      <div className="c-restricao-lista">
        {lista.map((r) => (
          <div key={r.id} className="c-restricao-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong>{r.alimento}</strong>
              <span className={seloGravidade(r.gravidade)}>{rotuloGravidade(r.gravidade)}</span>
              <span className="c-restricao-tipo">{rotuloTipo(r.tipo)}</span>
            </div>
            {r.notas && <p className="c-texto-muted" style={{ margin: "4px 0 0" }}>{r.notas}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
